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

		defaultGeminiApiKey := cfg.RequireSecret("defaultGeminiApiKey")
		nextjsBaseUrl := cfg.Require("nextjsBaseUrl") 

		openapiSpecPath := "../backends/byot-go-backend/openapi-spec.yaml"

		// --- Service Account for Cloud Functions ---
		functionsServiceAccount, err := serviceaccount.NewAccount(ctx, "byot-functions-sa", &serviceaccount.AccountArgs{
			AccountId:   pulumi.String("byot-functions-sa"),
			DisplayName: pulumi.String("Service Account for BYOT Cloud Functions"),
			Project:     pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}

		_, err = projects.NewIAMMember(ctx, "functionsSaSecretAccessor", &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/secretmanager.secretAccessor"),
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}
		
		// Allow functions to verify Firebase ID tokens (needed for Firebase Admin SDK)
		// This role is often included in broader Firebase roles like 'Firebase Admin'
		// but 'roles/firebaseauth.viewer' or a custom role with 'firebaseauth.tokens.verify' might be sufficient.
		// For simplicity and if functions already have broader Firebase access, this might be covered.
		// If not, add:
		_, err = projects.NewIAMMember(ctx, "functionsSaFirebaseTokenVerifier", &projects.IAMMemberArgs{
			Project: pulumi.String(gcpProject),
			Role:    pulumi.String("roles/firebase.tokenVerifier"), // or a more specific permission if possible
			Member:  pulumi.Sprintf("serviceAccount:%s", functionsServiceAccount.Email),
		})
		if err != nil {
			return err
		}


		// --- Cloud Functions ---
		deploymentBucket, err := storage.NewBucket(ctx, "functions-deployment-bucket", &storage.BucketArgs{
			Project:  pulumi.String(gcpProject),
			Location: pulumi.String(gcpRegion),
			// UniformBucketLevelAccess: pulumi.Bool(true), // Recommended
		})
		if err != nil {
			return err
		}

		commonFunctionEnvVars := pulumi.StringMap{
			"GCP_PROJECT_ID": pulumi.String(gcpProject),
		}

		createCloudFunction := func(name, entryPoint, sourceDir string, specificEnvVars pulumi.StringMap) (*cloudfunctions.Function, error) {
			archive := pulumi.NewFileArchive(sourceDir)
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


			function, err := cloudfunctions.NewFunction(ctx, name, functionArgs, resourceOpts...)
			if err != nil {
				return nil, err
			}

			// For API Gateway to invoke the function, the function needs to allow invocations
			// from the API Gateway's service account OR be public if Gateway handles auth.
			// If functions are private & Gateway authenticates TO them, use Gateway's SA.
			// If Gateway passes user's JWT for function to verify, function invoker can be more specific.
			// For simplicity with x-google-backend.jwt_audience, making functions invokable by 'allUsers'
			// as API Gateway will perform the auth check.
			_, err = cloudfunctions.NewFunctionIamMember(ctx, fmt.Sprintf("%s-invoker", name), &cloudfunctions.FunctionIamMemberArgs{
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

		setApiKeyFunction, err := createCloudFunction("SetAPIKeyGCF", "SetAPIKeyGCF",
			"../backends/byot-go-backend/functions/setapikey", 
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		removeApiKeyFunction, err := createCloudFunction("RemoveAPIKeyGCF", "RemoveAPIKeyGCF",
			"../backends/byot-go-backend/functions/removeapikey", 
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		getApiKeyStatusFunction, err := createCloudFunction("GetAPIKeyStatusGCF", "GetAPIKeyStatusGCF",
			"../backends/byot-go-backend/functions/getapikeystatus", 
			pulumi.StringMap{})
		if err != nil {
			return err
		}

		proxyToGenkitFunction, err := createCloudFunction("ProxyToGenkitGCF", "ProxyToGenkitGCF",
			"../backends/byot-go-backend/functions/proxytogenkit", 
			pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(nextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": defaultGeminiApiKey,
			})
		if err != nil {
			return err
		}

		// --- API Gateway ---
		api, err := apigateway.NewApi(ctx, "byot-backend-api", &apigateway.ApiArgs{
			ApiId:   pulumi.String("byot-backend-api"),
			Project: pulumi.String(gcpProject),
		})
		if err != nil {
			return err
		}
		
		// Construct OpenAPI spec content dynamically
		// Order of args MUST match the order of %s in the modified openapi-spec.yaml
		openapiContent := pulumi.All(
			// /api/user/set-api-key OPTIONS (1st placeholder)
			setApiKeyFunction.HttpsTriggerUrl,
			// /api/user/set-api-key POST (2nd, 3rd placeholders)
			setApiKeyFunction.HttpsTriggerUrl, 
			pulumi.String(gcpProject),         // jwt_audience for POST
			// /api/user/remove-api-key OPTIONS (4th)
			removeApiKeyFunction.HttpsTriggerUrl,
			// /api/user/remove-api-key POST (5th, 6th)
			removeApiKeyFunction.HttpsTriggerUrl, 
			pulumi.String(gcpProject),            // jwt_audience for POST
			// /api/user/api-key-status OPTIONS (7th)
			getApiKeyStatusFunction.HttpsTriggerUrl,
			// /api/user/api-key-status GET (8th, 9th)
			getApiKeyStatusFunction.HttpsTriggerUrl, 
			pulumi.String(gcpProject),               // jwt_audience for GET
			// /api/ai/genkit/{flowName} OPTIONS (10th)
			proxyToGenkitFunction.HttpsTriggerUrl,
			// /api/ai/genkit/{flowName} POST (11th, 12th)
			proxyToGenkitFunction.HttpsTriggerUrl, 
			pulumi.String(gcpProject),             // jwt_audience for POST
		).ApplyT(func(args []interface{}) (string, error) {
			// Ensure all elements are strings, as expected by fmt.Sprintf
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


		apiConfig, err := apigateway.NewApiConfig(ctx, "byot-api-config-v1", &apigateway.ApiConfigArgs{
			Api:         api.ApiId,
			Project:     pulumi.String(gcpProject),
			DisplayName: pulumi.String("BYOT API Config v1"),
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
			// GatewayConfig: &apigateway.ApiConfigGatewayConfigArgs{ // Optional: if you need to specify backend for all paths
			// 	BackendConfig: &apigateway.ApiConfigGatewayConfigBackendConfigArgs{
			// 		GoogleServiceAccount: functionsServiceAccount.Email,
			// 	},
			// },
		}, pulumi.DependsOn([]pulumi.Resource{
			setApiKeyFunction, removeApiKeyFunction, getApiKeyStatusFunction, proxyToGenkitFunction,
		}))
		if err != nil {
			return err
		}

		gateway, err := apigateway.NewGateway(ctx, "byot-gateway", &apigateway.GatewayArgs{
			ApiConfig: apiConfig.ID(),
			GatewayId: pulumi.String("byot-gateway"),
			Project:   pulumi.String(gcpProject),
			Region:    pulumi.String(gcpRegion), 
		})
		if err != nil {
			return err
		}

		ctx.Export("gatewayUrl", gateway.DefaultHostname)
		ctx.Export("setApiKeyFunctionUrl", setApiKeyFunction.HttpsTriggerUrl)
		ctx.Export("removeApiKeyFunctionUrl", removeApiKeyFunction.HttpsTriggerUrl)
		ctx.Export("getApiKeyStatusFunctionUrl", getApiKeyStatusFunction.HttpsTriggerUrl)
		ctx.Export("proxyToGenkitFunctionUrl", proxyToGenkitFunction.HttpsTriggerUrl)


		return nil
	})
}


    