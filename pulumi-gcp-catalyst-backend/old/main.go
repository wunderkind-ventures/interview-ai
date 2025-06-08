package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/apigateway"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctions"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/logging"    // Added import
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/monitoring" // Added import
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// --- Configuration ---
		cfg := config.New(ctx, "catalyst-gcp-infra")

		// encryptionKey := cfg.RequireSecret("ENCRYPTION_KEY") // For secrets
		environment := cfg.Require("environment") // Added: Read environment name

		gcpProject := cfg.Require("gcpProject")
		gcpRegion := cfg.Require("gcpRegion")
		alertEmail := cfg.Require("alertEmail")

		defaultGeminiApiKey := cfg.RequireSecret("defaultGeminiApiKey")
		nextjsBaseUrl := cfg.Require("nextjsBaseUrl")

		openapiSpecPath := "../backends/catalyst-go-backend/openapi-spec.yaml"

		// --- Service Account for Cloud Functions ---
		functionsServiceAccountName := fmt.Sprintf("catalyst-functions-sa-%s", environment)
		functionsServiceAccount, err := serviceaccount.NewAccount(ctx, functionsServiceAccountName, &serviceaccount.AccountArgs{
			AccountId:   pulumi.String(functionsServiceAccountName),
			DisplayName: pulumi.Sprintf("Service Account for Catalyst Cloud Functions (%s)", environment),
			Project:     pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		_, err = projects.NewIAMMember(ctx, fmt.Sprintf("functionsSaSecretAccessor-%s", environment), &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/secretmanager.secretAccessor"),
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}

		_, err = projects.NewIAMMember(ctx, fmt.Sprintf("functionsSaSecretAdmin-%s", environment), &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/secretmanager.admin"),
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}

		// Add Secret Manager Admin role to allow creating and managing secrets
		_, err = projects.NewIAMMember(ctx, fmt.Sprintf("functionsSaSecretVersionManager-%s", environment), &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/secretmanager.secretVersionManager"),
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}

		// --- Cloud Functions ---
		deploymentBucketName := fmt.Sprintf("functions-deployment-bucket-%s", environment)
		deploymentBucket, err := storage.NewBucket(ctx, deploymentBucketName, &storage.BucketArgs{
			Project:  pulumi.String(gcpProject),
			Location: pulumi.String(gcpRegion),
			Name:     pulumi.String(deploymentBucketName), // Explicitly set bucket name for uniqueness
			// UniformBucketLevelAccess: pulumi.Bool(true), // Recommended
		})
		if err != nil {
			return err
		}

		commonFunctionEnvVars := pulumi.StringMap{
			"GCP_PROJECT_ID": pulumi.String(gcpProject),
		}

		createCloudFunction := func(name, entryPoint, sourceDir string, specificEnvVars pulumi.StringMap) (*cloudfunctions.Function, error) {
			functionResourceName := fmt.Sprintf("%s-%s", name, environment)
			archive := pulumi.NewFileArchive(sourceDir)
			sourceObject, err := storage.NewBucketObject(ctx, functionResourceName+"-source", &storage.BucketObjectArgs{
				Bucket: deploymentBucket.Name,
				Name:   pulumi.String(functionResourceName + "-source.zip"),
				Source: archive,
			})
			if err != nil {
				return nil, err
			}

			allEnvVars := pulumi.StringMap{}
			for k, v := range commonFunctionEnvVars {
				allEnvVars[k] = v
			}
			for k, v := range specificEnvVars {
				allEnvVars[k] = v
			}

			functionArgs := &cloudfunctions.FunctionArgs{
				Name:                 pulumi.String(functionResourceName),
				EntryPoint:           pulumi.String(entryPoint),
				Runtime:              pulumi.String("go121"), // Ensure this matches your Go version
				AvailableMemoryMb:    pulumi.Int(256),
				SourceArchiveBucket:  deploymentBucket.Name,
				SourceArchiveObject:  sourceObject.Name,
				TriggerHttp:          pulumi.Bool(true),
				Project:              pulumi.String(gcpProject),
				Region:               pulumi.String(gcpRegion),
				ServiceAccountEmail:  functionsServiceAccount.Email,
				EnvironmentVariables: allEnvVars,
			}

			resourceOpts := []pulumi.ResourceOption{
				pulumi.DeleteBeforeReplace(true),
				pulumi.ReplaceOnChanges([]string{"name", "entryPoint", "runtime", "serviceAccountEmail"}),
			}

			function, err := cloudfunctions.NewFunction(ctx, functionResourceName, functionArgs, resourceOpts...)
			if err != nil {
				return nil, err
			}

			_, err = cloudfunctions.NewFunctionIamMember(ctx, fmt.Sprintf("%s-invoker-%s", name, environment), &cloudfunctions.FunctionIamMemberArgs{
				Project:       function.Project,
				Region:        function.Region,
				CloudFunction: function.Name,
				Role:          pulumi.String("roles/cloudfunctions.invoker"),
				Member:        pulumi.String("allUsers"),
			})
			if err != nil {
				return nil, err
			}
			return function, nil
		}

		// The Gen1 definition for removeApiKeyFunction is being removed.
		// removeApiKeyFunction, err := createCloudFunction("RemoveAPIKeyGCF", "RemoveAPIKeyGCF",
		// 	"../backends/catalyst-go-backend/functions/removeapikey",
		// 	pulumi.StringMap{})
		// if err != nil {
		// 	return err
		// }

		// ========================================================================
		// START: Updates for docsupport/parseresume Cloud Function
		// ========================================================================

		// Create a GCS bucket to store function source archives.
		// This bucket is intended to be shared by multiple functions for their source code.
		sourceBucket, err := storage.NewBucket(ctx, "pulumi-function-source-bucket", &storage.BucketArgs{
			Name:                     pulumi.Sprintf("%s-function-sources", ctx.Project()), // Globally unique name
			Location:                 pulumi.String("US"),                                  // Or your preferred region
			UniformBucketLevelAccess: pulumi.Bool(true),
		})
		if err != nil {
			return fmt.Errorf("failed to create source code bucket: %w", err)
		}

		// ========================================================================
		// docsupport/parseresume Gen 2 Cloud Function
		// This function handles parsing of resume files (.md, .docx).
		// ========================================================================
		// Path to the function code, relative to this Pulumi program
		docsupportParseResumePath := filepath.Join("..", "backends", "catalyst-go-backend", "functions", "docsupport", "parseresume")
		parseResumeArchive := pulumi.NewFileArchive(docsupportParseResumePath)

		// Using a fixed name for the GCS object. Pulumi handles content-based updates.
		parseResumeSourceArchiveObjectName := "docsupport-parseresume-source.zip"

		parseResumeSourceArchiveObject, err := storage.NewBucketObject(ctx, "docsupport-parseresume-source-zip", &storage.BucketObjectArgs{
			Bucket: sourceBucket.Name, // CORRECTLY Use the shared sourceBucket
			Source: parseResumeArchive,
			Name:   pulumi.String(parseResumeSourceArchiveObjectName),
		})
		if err != nil {
			return fmt.Errorf("failed to upload parseresume source archive: %w", err)
		}

		parseResumeFunction, err := cloudfunctionsv2.NewFunction(ctx, "docsupport-parseresume-function", &cloudfunctionsv2.FunctionArgs{
			Project:  pulumi.String(gcpProject),
			Location: pulumi.String(gcpRegion),
			BuildConfig: &cloudfunctionsv2.FunctionBuildConfigArgs{
				Runtime:    pulumi.String("go122"),       // Ensure this is the Go version used in your function's go.mod
				EntryPoint: pulumi.String("ParseResume"), // The Go function name in its main.go
				Source: &cloudfunctionsv2.FunctionBuildConfigSourceArgs{
					StorageSource: &cloudfunctionsv2.FunctionBuildConfigSourceStorageSourceArgs{
						Bucket: sourceBucket.Name,
						Object: parseResumeSourceArchiveObject.Name,
					},
				},
				// Add environment variables if your function needs them
				// EnvironmentVariables: pulumi.StringMap{
				//  "MY_ENV_VAR": pulumi.String("my_value"),
				// },
			},
			ServiceConfig: &cloudfunctionsv2.FunctionServiceConfigArgs{
				MaxInstanceCount: pulumi.Int(2), // Adjust based on expected load
				MinInstanceCount: pulumi.Int(0), // Can be 0 to scale to zero for cost savings
				AvailableMemory:  pulumi.String("256MiB"),
				TimeoutSeconds:   pulumi.Int(60),
				IngressSettings:  pulumi.String("ALLOW_ALL"), // Allows public HTTP access
				// AllTrafficOnLatestRevision: pulumi.Bool(true), // Default behavior
			},
			Description: pulumi.String("Parses uploaded resume/document files (docx, md) and returns text."),
		})
		if err != nil {
			return fmt.Errorf("failed to create parseresume function: %w", err)
		}

		// Allow unauthenticated (public) invocations for the HTTP trigger
		_, err = cloudfunctionsv2.NewFunctionIamMember(ctx, "docsupport-parseresume-invoker", &cloudfunctionsv2.FunctionIamMemberArgs{
			Project:       parseResumeFunction.Project,
			Location:      parseResumeFunction.Location,
			CloudFunction: parseResumeFunction.Name,
			Role:          pulumi.String("roles/cloudfunctions.invoker"),
			Member:        pulumi.String("allUsers"),
		})
		if err != nil {
			return fmt.Errorf("failed to set IAM invoker for parseresume function: %w", err)
		}

		// ========================================================================
		// END: Updates for docsupport/parseresume Cloud Function
		// ========================================================================

		setApiKeyFunction, err := createCloudFunction("SetAPIKeyGCF", "SetAPIKeyGCF",
			"../backends/catalyst-go-backend/functions/setapikey",
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		removeApiKeyFunction, err := createCloudFunction("RemoveAPIKeyGCF", "RemoveAPIKeyGCF",
			"../backends/catalyst-go-backend/functions/removeapikey",
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		getApiKeyStatusFunction, err := createCloudFunction("GetAPIKeyStatusGCF", "GetAPIKeyStatusGCF",
			"../backends/catalyst-go-backend/functions/getapikeystatus",
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		proxyToGenkitFunction, err := createCloudFunction("ProxyToGenkitGCF", "ProxyToGenkitGCF",
			"../backends/catalyst-go-backend/functions/proxytogenkit",
			pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(nextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": defaultGeminiApiKey,
			})
		if err != nil {
			return err
		}

		// --- API Gateway ---
		apiName := fmt.Sprintf("catalyst-backend-api-%s", environment)
		api, err := apigateway.NewApi(ctx, apiName, &apigateway.ApiArgs{
			ApiId:   pulumi.String(apiName),
			Project: pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		openapiContent := pulumi.All(
			setApiKeyFunction.HttpsTriggerUrl,
			removeApiKeyFunction.HttpsTriggerUrl,
			getApiKeyStatusFunction.HttpsTriggerUrl,
			proxyToGenkitFunction.HttpsTriggerUrl,
			parseResumeFunction.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput),
		).ApplyT(func(args []interface{}) (string, error) {
			stringArgs := make([]interface{}, len(args))
			for i, arg := range args {
				stringArgs[i] = arg.(string)
			}

			contentBytes, err := os.ReadFile(openapiSpecPath)
			if err != nil {
				return "", fmt.Errorf("failed to read openapi spec file %s: %w", openapiSpecPath, err)
			}
			templateContent := string(contentBytes)

			finalContent := fmt.Sprintf(templateContent, stringArgs...)
			return finalContent, nil
		}).(pulumi.StringOutput)

		apiConfigName := fmt.Sprintf("catalyst-api-config-v1-%s", environment)
		apiConfig, err := apigateway.NewApiConfig(ctx, apiConfigName, &apigateway.ApiConfigArgs{
			Api:         api.ApiId,
			Project:     pulumi.String(gcpProject),
			DisplayName: pulumi.Sprintf("Catalyst API Config v1 (%s)", environment),
			OpenapiDocuments: apigateway.ApiConfigOpenapiDocumentArray{
				&apigateway.ApiConfigOpenapiDocumentArgs{
					Document: &apigateway.ApiConfigOpenapiDocumentDocumentArgs{
						Path: pulumi.String("openapi-spec.yaml"),
						Contents: openapiContent.ApplyT(func(content string) string {
							return base64.StdEncoding.EncodeToString([]byte(content))
						}).(pulumi.StringOutput),
					},
				},
			},
		}, pulumi.DependsOn([]pulumi.Resource{
			setApiKeyFunction,
			removeApiKeyFunction,
			getApiKeyStatusFunction,
			proxyToGenkitFunction,
		}))
		if err != nil {
			return err
		}

		gatewayName := fmt.Sprintf("catalyst-backend-gateway-%s", environment)
		gateway, err := apigateway.NewGateway(ctx, gatewayName, &apigateway.GatewayArgs{
			ApiConfig: apiConfig.ID(),
			Project:   pulumi.String(gcpProject),
			Region:    pulumi.String(gcpRegion),
			GatewayId: pulumi.String(gatewayName),
		})
		if err != nil {
			return err
		}

		// --- Cloud Monitoring & Logging ---

		// 1. Create a Notification Channel (Email)
		emailChannelName := fmt.Sprintf("emailNotificationChannel-%s", environment)
		emailChannel, err := monitoring.NewNotificationChannel(ctx, emailChannelName, &monitoring.NotificationChannelArgs{
			DisplayName: pulumi.Sprintf("Email Alert Channel (%s)", environment),
			Type:        pulumi.String("email"),
			Labels: pulumi.StringMap{
				"email_address": pulumi.String(alertEmail),
			},
			Project: pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		// 2. Create a Log-Based Metric for Critical Errors in Cloud Functions
		filter := `resource.type="cloud_function" severity>=ERROR textPayload:"CRITICAL_ERROR"`

		criticalErrorLogMetricName := fmt.Sprintf("cloud-function-critical-errors-%s", environment)
		criticalErrorLogMetric, err := logging.NewMetric(ctx, criticalErrorLogMetricName, &logging.MetricArgs{
			Project:     pulumi.String(gcpProject),
			Name:        pulumi.String(criticalErrorLogMetricName),
			Description: pulumi.Sprintf("Counts critical errors logged by Cloud Functions in %s environment.", environment),
			Filter:      pulumi.String(filter),
			MetricDescriptor: &logging.MetricMetricDescriptorArgs{
				MetricKind: pulumi.String("DELTA"),
				ValueType:  pulumi.String("INT64"),
				Unit:       pulumi.String("1"),
				Labels: logging.MetricMetricDescriptorLabelArray{
					&logging.MetricMetricDescriptorLabelArgs{
						Key:         pulumi.String("function_name"),
						ValueType:   pulumi.String("STRING"),
						Description: pulumi.String("Name of the Cloud Function"),
					},
				},
			},
			LabelExtractors: pulumi.StringMap{
				"function_name": pulumi.String("EXTRACT(resource.labels.function_name)"),
			},
		})
		if err != nil {
			return err
		}

		// 3. Create an Alert Policy for the Log-Based Metric
		alertPolicyName := fmt.Sprintf("criticalErrorAlertPolicy-%s", environment)
		_, err = monitoring.NewAlertPolicy(ctx, alertPolicyName, &monitoring.AlertPolicyArgs{
			Project:     pulumi.String(gcpProject),
			DisplayName: pulumi.Sprintf("Critical Errors in Cloud Functions Alert (%s)", environment),
			Combiner:    pulumi.String("OR"),
			Conditions: monitoring.AlertPolicyConditionArray{
				&monitoring.AlertPolicyConditionArgs{
					DisplayName: pulumi.String("Log-based metric: Critical Errors > 0"),
					ConditionThreshold: &monitoring.AlertPolicyConditionConditionThresholdArgs{
						Filter:         pulumi.Sprintf("metric.type=\"logging.googleapis.com/user/%s\" resource.type=\"cloud_function\"", criticalErrorLogMetric.Name),
						Comparison:     pulumi.String("COMPARISON_GT"),
						ThresholdValue: pulumi.Float64(0),
						Duration:       pulumi.String("300s"), // 5 minutes
						Aggregations: monitoring.AlertPolicyConditionConditionThresholdAggregationArray{
							&monitoring.AlertPolicyConditionConditionThresholdAggregationArgs{
								AlignmentPeriod:  pulumi.String("300s"),
								PerSeriesAligner: pulumi.String("ALIGN_COUNT"),
							},
						},
					},
				},
			},
			NotificationChannels: pulumi.StringArray{
				emailChannel.ID(),
			},
			Documentation: &monitoring.AlertPolicyDocumentationArgs{
				Content:  pulumi.Sprintf("One or more Cloud Functions in the %s environment have logged a CRITICAL_ERROR message. Please investigate the logs for details.", environment),
				MimeType: pulumi.String("text/markdown"),
			},
		})
		if err != nil {
			return err
		}

		// --- Outputs ---
		ctx.Export("catalystFunctionsServiceAccountEmail", functionsServiceAccount.Email)
		ctx.Export("functionSourceBucketName", sourceBucket.Name)
		ctx.Export("setApiKeyFunctionUrl", setApiKeyFunction.HttpsTriggerUrl)
		ctx.Export("removeApiKeyFunctionUrl", removeApiKeyFunction.HttpsTriggerUrl)
		ctx.Export("getApiKeyStatusFunctionUrl", getApiKeyStatusFunction.HttpsTriggerUrl)
		ctx.Export("proxyToGenkitFunctionUrl", proxyToGenkitFunction.HttpsTriggerUrl)
		ctx.Export("parseResumeFunctionUrl", parseResumeFunction.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		ctx.Export("docsupportParseResumeFunctionUrl", parseResumeFunction.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) (string, error) {
			if sc == nil || sc.Uri == nil {
				// During initial creation, Uri might be nil briefly.
				// Returning an empty string is okay; Pulumi will update the export once the URI is available.
				return "", nil
			}
			return *sc.Uri, nil
		}).(pulumi.StringOutput))
		ctx.Export("apiGatewayDefaultHostname", gateway.DefaultHostname)
		ctx.Export("apiGatewayId", api.ApiId)
		ctx.Export("apiConfigId", apiConfig.ID())
		ctx.Export("gatewayId", gateway.GatewayId)
		ctx.Export("deploymentBucketName", deploymentBucket.Name)
		ctx.Export("emailNotificationChannelId", emailChannel.ID())
		ctx.Export("criticalErrorLogMetricName", criticalErrorLogMetric.Name)

		return nil
	})
}
