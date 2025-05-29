package main

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/apigateway"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctions"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// --- Configuration ---
		cfg := config.New(ctx, "")
		gcpProject := cfg.Require("gcpProject") // From Pulumi.<stack>.yaml or `pulumi config set gcpProject your-project-id`
		gcpRegion := cfg.Require("gcpRegion")   // e.g., "us-central1"

		// These sensitive values should ideally come from Pulumi config (secrets) or environment variables
		// that Pulumi can access during `pulumi up`.
		// For Pulumi config: `pulumi config set --secret defaultGeminiApiKey YOUR_KEY`
		defaultGeminiApiKey := cfg.RequireSecret("defaultGeminiApiKey")
		nextjsBaseUrl := cfg.Require("nextjsBaseUrl") // e.g., "https://your-nextjs-app.com"

		// Path to your OpenAPI spec, relative to this Pulumi program's location or absolute.
		// This assumes openapi-spec.yaml is in the parent directory relative to this Pulumi program,
		// which might not be ideal. Better to copy it into the Pulumi project or reference it carefully.
		// For simplicity here, let's assume it's accessible.
		openapiSpecPath := "../backends/byot-go-backend/openapi-spec.yaml" // ADJUST PATH

		// --- Service Account for Cloud Functions ---
		functionsServiceAccount, err := serviceaccount.NewAccount(ctx, "byot-functions-sa", &serviceaccount.AccountArgs{
			AccountId:   pulumi.String("byot-functions-sa"),
			DisplayName: pulumi.String("Service Account for BYOT Cloud Functions"),
			Project:     pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		// Grant necessary roles to the functions' service account
		// Secret Manager Accessor
		_, err = projects.NewIAMMember(ctx, "functionsSaSecretAccessor", &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/secretmanager.secretAccessor"),
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}
		// Add other roles: Firebase Admin (if needed beyond ADC), etc.
		// e.g., roles/firebase.admin if functions need broad Firebase access

		// --- Cloud Functions ---
		// Create a GCS bucket for storing function source archives
		deploymentBucket, err := storage.NewBucket(ctx, "functions-deployment-bucket", &storage.BucketArgs{
			Project:  pulumi.String(gcpProject),
			Location: pulumi.String(gcpRegion),
		})
		if err != nil {
			return err
		}

		// Define common environment variables for all functions
		commonFunctionEnvVars := pulumi.StringMap{
			"GCP_PROJECT_ID": pulumi.String(gcpProject),
			// "FIREBASE_SERVICE_ACCOUNT_KEY_PATH": pulumi.String(""), // Typically not needed if using runtime SA
		}

		// Helper function to create a Cloud Function resource
		createCloudFunction := func(name, entryPoint, sourceDir string, specificEnvVars pulumi.StringMap) (*cloudfunctions.Function, error) {
			// Package the source code from the given directory.
			archive := pulumi.NewFileArchive(sourceDir)

			// Upload archive to GCS bucket for Cloud Function source
			sourceObject, err := storage.NewBucketObject(ctx, name+"-source", &storage.BucketObjectArgs{
				Bucket: deploymentBucket.Name,
				Name:   pulumi.String(name + "-source.zip"),
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
				Name:                 pulumi.String(name),
				EntryPoint:           pulumi.String(entryPoint),
				Runtime:              pulumi.String("go121"),
				AvailableMemoryMb:    pulumi.Int(256),
				SourceArchiveBucket:  deploymentBucket.Name,
				SourceArchiveObject:  sourceObject.Name,
				TriggerHttp:          pulumi.Bool(true),
				Project:              pulumi.String(gcpProject),
				Region:               pulumi.String(gcpRegion),
				ServiceAccountEmail:  functionsServiceAccount.Email,
				EnvironmentVariables: allEnvVars,
			}

			function, err := cloudfunctions.NewFunction(ctx, name, functionArgs)
			if err != nil {
				return nil, err
			}

			// Allow unauthenticated invocations for now (or configure IAM if you use API Gateway to auth to function)
			// This is simpler if API Gateway is the one controlling public access.
			// If your function is private and API Gateway calls it via IAM, then you don't set this.
			_, err = cloudfunctions.NewFunctionIamMember(ctx, fmt.Sprintf("%s-invoker", name), &cloudfunctions.FunctionIamMemberArgs{
				Project:       function.Project,
				Region:        function.Region,
				CloudFunction: function.Name,
				Role:          pulumi.String("roles/cloudfunctions.invoker"),
				Member:        pulumi.String("allUsers"), // For public access
			})
			if err != nil {
				return nil, err
			}
			return function, nil
		}

		// Deploy SetAPIKeyGCF
		setApiKeyFunction, err := createCloudFunction("SetAPIKeyGCF", "SetAPIKeyGCF",
			"../backends/byot-go-backend/functions/setapikey", // ADJUST PATH
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		// Deploy RemoveAPIKeyGCF
		removeApiKeyFunction, err := createCloudFunction("RemoveAPIKeyGCF", "RemoveAPIKeyGCF",
			"../backends/byot-go-backend/functions/removeapikey", // ADJUST PATH
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		// Deploy GetAPIKeyStatusGCF
		getApiKeyStatusFunction, err := createCloudFunction("GetAPIKeyStatusGCF", "GetAPIKeyStatusGCF",
			"../backends/byot-go-backend/functions/getapikeystatus", // ADJUST PATH
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		// Deploy ProxyToGenkitGCF
		proxyToGenkitFunction, err := createCloudFunction("ProxyToGenkitGCF", "ProxyToGenkitGCF",
			"../backends/byot-go-backend/functions/proxytogenkit", // ADJUST PATH
			pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(nextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": defaultGeminiApiKey,
			})
		if err != nil {
			return err
		}

		// --- API Gateway ---
		// 1. Create the API resource
		api, err := apigateway.NewApi(ctx, "byot-backend-api", &apigateway.ApiArgs{
			ApiId:   pulumi.String("byot-backend-api"),
			Project: pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		// 2. Create the API Config (using the OpenAPI spec)
		// The content of the OpenAPI spec needs to be dynamically updated with deployed function URLs
		// This is a bit advanced with Pulumi string interpolations directly in YAML.
		// A common pattern is to use Pulumi to generate the OpenAPI spec content as a string.
		// For now, let's assume you will manually update openapi-spec.yaml with deployed URLs
		// or we can explore generating it.
		// Simpler approach: Upload the openapi-spec.yaml as-is after ensuring it has
		// placeholder URLs that are either resolvable or you accept they are illustrative.
		// Better: dynamically construct the OpenAPI spec string.

		// Construct OpenAPI spec content dynamically
		openapiContent := pulumi.All(
			setApiKeyFunction.HttpsTriggerUrl,       // 1st URL for Sprintf
			setApiKeyFunction.HttpsTriggerUrl,       // 2nd URL for Sprintf (for jwt_audience)
			removeApiKeyFunction.HttpsTriggerUrl,    // 3rd
			removeApiKeyFunction.HttpsTriggerUrl,    // 4th
			getApiKeyStatusFunction.HttpsTriggerUrl, // 5th
			getApiKeyStatusFunction.HttpsTriggerUrl, // 6th
			proxyToGenkitFunction.HttpsTriggerUrl,   // 7th
			proxyToGenkitFunction.HttpsTriggerUrl,   // 8th
		).ApplyT(func(args []interface{}) (string, error) {
			urls := make([]interface{}, len(args))
			for i, arg := range args {
				urls[i] = arg.(string)
			}

			contentBytes, err := os.ReadFile(openapiSpecPath) // Ensure openapiSpecPath is correct
			if err != nil {
				return "", fmt.Errorf("failed to read openapi spec file %s: %w", openapiSpecPath, err)
			}
			templateContent := string(contentBytes)

			// Use fmt.Sprintf to replace placeholders
			// The order of urls here MUST match the order of %s in your YAML file
			finalContent := fmt.Sprintf(templateContent, urls...)

			return finalContent, nil
		}).(pulumi.StringOutput)

		apiConfig, err := apigateway.NewApiConfig(ctx, "byot-api-config-v1", &apigateway.ApiConfigArgs{
			Api:         api.ApiId,
			Project:     pulumi.String(gcpProject),
			DisplayName: pulumi.String("BYOT API Config v1"),
			OpenapiDocuments: apigateway.ApiConfigOpenapiDocumentArray{
				&apigateway.ApiConfigOpenapiDocumentArgs{
					Document: &apigateway.ApiConfigOpenapiDocumentDocumentArgs{
						Path: pulumi.String("openapi-spec.yaml"), // This is a conceptual path for the document within the config
						Contents: openapiContent.ApplyT(func(content string) string {
							return base64.StdEncoding.EncodeToString([]byte(content)) // Content MUST be base64 encoded
						}).(pulumi.StringOutput),
					},
				},
			},
		}, pulumi.DependsOn([]pulumi.Resource{
			setApiKeyFunction, removeApiKeyFunction, getApiKeyStatusFunction, proxyToGenkitFunction,
		}))
		if err != nil {
			return err
		}

		// 3. Create the Gateway
		gateway, err := apigateway.NewGateway(ctx, "byot-gateway", &apigateway.GatewayArgs{
			ApiConfig: apiConfig.ID(), // Use .ID() or .SelfLink for the config
			GatewayId: pulumi.String("byot-gateway"),
			Project:   pulumi.String(gcpProject),
			Region:    pulumi.String(gcpRegion), // Must be a supported region for API Gateway
		})
		if err != nil {
			return err
		}

		// --- IAM for API Gateway to invoke Cloud Functions (if functions are private) ---
		// If functions are public (allUsers invoker), this might not be strictly necessary,
		// but it's good practice if you make functions private.
		// API Gateway uses a Google-managed service account: service-PROJECT_NUMBER@gcp-sa-apigateway.iam.gserviceaccount.com
		// Or you can assign a custom SA to the Gateway if needed (more advanced).

		// Output the Gateway URL
		ctx.Export("gatewayUrl", gateway.DefaultHostname)
		ctx.Export("setApiKeyFunctionUrl", setApiKeyFunction.HttpsTriggerUrl)
		// ... export other function URLs if needed for direct testing

		return nil
	})
}
