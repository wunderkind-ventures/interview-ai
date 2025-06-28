package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	"catalyst-backend/config"
	"catalyst-backend/envconfig"
	"catalyst-backend/functions"
	"catalyst-backend/functions/component"
	"catalyst-backend/gateway"
	"catalyst-backend/iam"
	"catalyst-backend/monitoring"
	"catalyst-backend/storage"
	// tunnel "catalyst-backend/tunnel" // Uncomment when re-enabling tunnel deployment
	"catalyst-backend/utils"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg, err := config.Load(ctx)
		if err != nil {
			return err
		}

		nameSuffix := fmt.Sprintf("-%s", cfg.Environment)

		// IAM and Buckets
		sa, err := iam.CreateFunctionServiceAccount(ctx, cfg)
		if err != nil {
			return err
		}
		deploymentBucket, err := storage.CreateDeploymentBucket(ctx, cfg)
		if err != nil {
			return err
		}
		sourceBucket, err := storage.CreateSourceBucket(ctx, cfg)
		if err != nil {
			return err
		}

		setFn, err := component.NewGen1Function(ctx, "SetAPIKeyGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "SetAPIKeyGCF" + nameSuffix,
			EntryPoint:     "SetAPIKeyGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/setapikey",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		removeFn, err := component.NewGen1Function(ctx, "RemoveAPIKeyGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "RemoveAPIKeyGCF" + nameSuffix,
			EntryPoint:     "RemoveAPIKeyGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/removeapikey",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		getApiKeyStatusFn, err := component.NewGen1Function(ctx, "GetAPIKeyStatusGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "GetAPIKeyStatusGCF" + nameSuffix,
			EntryPoint:     "GetAPIKeyStatusGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/getapikeystatus",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		proxyFn, err := component.NewGen1Function(ctx, "ProxyToGenkitGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "ProxyToGenkitGCF" + nameSuffix,
			EntryPoint:     "ProxyToGenkitGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/proxytogenkit",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		// Deploy ParseResume Gen2 Function via ComponentResource
		parseResumeFn, err := component.NewGen2Function(ctx, "ParseResume"+nameSuffix, &component.Gen2FunctionArgs{
			Name:           "ParseResume" + nameSuffix,
			EntryPoint:     "ParseResume",
			SourcePath:     "../../backends/catalyst-interviewai/functions/docsupport/parseresume",
			Bucket:         sourceBucket,
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			Description:    "Parses uploaded resume/document files (docx, md) and returns text.",
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		// Deploy RAG Infrastructure
		ragInfra, err := functions.DeployRAGInfrastructure(ctx, cfg, sourceBucket, sa)
		if err != nil {
			return err
		}

		// Set up RAG IAM permissions
		err = functions.SetupRAGIAMPermissions(ctx, cfg, sa, ragInfra)
		if err != nil {
			return err
		}

		// Deploy Vertex AI Vector Search (manual setup required)
		err = functions.DeployVertexAIVectorSearch(ctx, cfg)
		if err != nil {
			return err
		}

		// Deploy Python ADK Agent Service using Hybrid Component
		// Using Cloud Run as FastAPI apps work better as containerized services
		// Cloud Functions Gen2 expects functions-framework compatible apps
		pythonAgentService, err := component.NewHybridService(ctx, "PythonADKAgents"+nameSuffix, &component.HybridServiceArgs{
			Name:           "python-adk-agents" + nameSuffix,
			DeploymentType: component.DeploymentTypeCloudRun, // Use Cloud Run for FastAPI compatibility
			Project:        cfg.GcpProject,
			Region:         cfg.GcpRegion,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"ENVIRONMENT":            pulumi.String("development"),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
				"ENABLE_TELEMETRY":       pulumi.String("true"),
				"LOG_LEVEL":              pulumi.String("info"),
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
			Description: "Python ADK Agent Service for Interview AI",

			// Function-specific configuration
			SourcePath:      "../../backends/catalyst-py",
			EntryPoint:      "function_main.start_server",
			Runtime:         "python311",
			Bucket:          sourceBucket,
			FunctionMemory:  "1024Mi",
			FunctionTimeout: 540, // 9 minutes

			// Cloud Run configuration (for future use)
			ContainerImage: fmt.Sprintf("gcr.io/%s/python-adk-agents:latest", cfg.GcpProject),
			Port:           8080,
			Memory:         "1Gi",
			CPU:            "1",
			MinInstances:   0,
			MaxInstances:   10,
		})
		if err != nil {
			return err
		}

		// Deploy Python Agent Gateway Functions
		startInterviewFn, err := component.NewGen1Function(ctx, "StartInterviewGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "StartInterviewGCF" + nameSuffix,
			EntryPoint:     "StartInterviewGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		responseInterviewFn, err := component.NewGen1Function(ctx, "InterviewResponseGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "InterviewResponseGCF" + nameSuffix,
			EntryPoint:     "InterviewResponseGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		statusInterviewFn, err := component.NewGen1Function(ctx, "InterviewStatusGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "InterviewStatusGCF" + nameSuffix,
			EntryPoint:     "InterviewStatusGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		endInterviewFn, err := component.NewGen1Function(ctx, "EndInterviewGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "EndInterviewGCF" + nameSuffix,
			EntryPoint:     "EndInterviewGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		getReportFn, err := component.NewGen1Function(ctx, "GetReportGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "GetReportGCF" + nameSuffix,
			EntryPoint:     "GetReportGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		agentHealthFn, err := component.NewGen1Function(ctx, "AgentHealthGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "AgentHealthGCF" + nameSuffix,
			EntryPoint:     "AgentHealthGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-interviewai/functions/pythonagentgateway",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
				"PYTHON_AGENT_BASE_URL":  pythonAgentService.GetURL(),
				"GCP_PROJECT_ID":         pulumi.String(cfg.GcpProject),
			},
		})
		if err != nil {
			return err
		}

		// Create the API Gateway API
		api, err := gateway.CreateApi(ctx, "catalyst-interviewai-api", cfg.GcpProject, cfg.Environment)
		if err != nil {
			return err
		}

		apiConfig, err := gateway.CreateApiConfig(ctx, "catalyst-api-config"+nameSuffix, api.ApiId, cfg.OpenapiSpecPath, []pulumi.StringInput{
			setFn.Function.HttpsTriggerUrl,                      // 1st - SetAPIKeyGCF OPTIONS
			setFn.Function.HttpsTriggerUrl,                      // 2nd - SetAPIKeyGCF POST
			removeFn.Function.HttpsTriggerUrl,                   // 3rd - RemoveAPIKeyGCF OPTIONS
			removeFn.Function.HttpsTriggerUrl,                   // 4th - RemoveAPIKeyGCF POST
			getApiKeyStatusFn.Function.HttpsTriggerUrl,          // 5th - GetAPIKeyStatusGCF GET
			getApiKeyStatusFn.Function.HttpsTriggerUrl,          // 6th - GetAPIKeyStatusGCF OPTIONS
			proxyFn.Function.HttpsTriggerUrl,                    // 7th - ProxyToGenkitGCF POST
			proxyFn.Function.HttpsTriggerUrl,                    // 8th - ProxyToGenkitGCF OPTIONS
			parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 9th - ParseResume POST
			parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 10th - ParseResume OPTIONS
			// ContentScraper URLs (11-14)
			ragInfra.ContentScraperFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 11th
			ragInfra.ContentScraperFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 12th
			ragInfra.ContentIndexerFunction.URL, // 13th - ContentIndexer POST
			ragInfra.ContentIndexerFunction.URL, // 14th - ContentIndexer OPTIONS
			// VectorSearch URLs (15-20)
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 15th
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 16th
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 17th
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 18th
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 19th
			ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput), // 20th
			// Python Agent Gateway Function URLs (21-32)
			startInterviewFn.Function.HttpsTriggerUrl,    // 21st - Start Interview POST
			startInterviewFn.Function.HttpsTriggerUrl,    // 22nd - Start Interview OPTIONS
			responseInterviewFn.Function.HttpsTriggerUrl, // 23rd - Interview Response POST
			responseInterviewFn.Function.HttpsTriggerUrl, // 24th - Interview Response OPTIONS
			statusInterviewFn.Function.HttpsTriggerUrl,   // 25th - Interview Status GET
			statusInterviewFn.Function.HttpsTriggerUrl,   // 26th - Interview Status OPTIONS
			endInterviewFn.Function.HttpsTriggerUrl,      // 27th - End Interview POST
			endInterviewFn.Function.HttpsTriggerUrl,      // 28th - End Interview OPTIONS
			getReportFn.Function.HttpsTriggerUrl,         // 29th - Get Report GET
			getReportFn.Function.HttpsTriggerUrl,         // 30th - Get Report OPTIONS
			agentHealthFn.Function.HttpsTriggerUrl,       // 31st - Agent Health GET
			agentHealthFn.Function.HttpsTriggerUrl,       // 32nd - Agent Health OPTIONS
		}, []pulumi.Resource{
			setFn.Function, removeFn.Function, getApiKeyStatusFn.Function, proxyFn.Function, ragInfra.ContentScraperFunction.Function, ragInfra.VectorSearchFunction.Function,
			startInterviewFn.Function, responseInterviewFn.Function, statusInterviewFn.Function, endInterviewFn.Function, getReportFn.Function, agentHealthFn.Function,
		}, cfg.GcpProject)
		if err != nil {
			return err
		}

		gatewayInstance, err := gateway.CreateGateway(ctx, "catalyst-gateway"+nameSuffix, api.ApiId, apiConfig.ID(), cfg.GcpProject, cfg.GcpRegion)
		if err != nil {
			return err
		}

		// Monitoring
		notificationChannel, err := monitoring.CreateEmailNotificationChannel(ctx, cfg)
		if err != nil {
			return err
		}
		logMetric, err := monitoring.CreateCriticalErrorLogMetric(ctx, cfg)
		if err != nil {
			return err
		}
		_, err = monitoring.CreateCriticalErrorAlertPolicy(ctx, cfg, logMetric, notificationChannel)
		if err != nil {
			return err
		}

		// TUNNEL DEPLOYMENT DISABLED: SSH key configuration needs to be fixed
		// The current configuration has a public SSH key instead of a private key
		// To re-enable:
		// 1. Set a valid SSH private key using: pulumi config set --secret catalyst-gcp-infra:sshPrivateKey "-----BEGIN RSA PRIVATE KEY-----..."
		// 2. Uncomment the code below
		/*
		if cfg.Environment == "dev" {
			tunnelDomain := cfg.TunnelDomain
			sshPrivateKey := cfg.SshPrivateKey

			// Only deploy tunnel if SSH key is provided
			if sshPrivateKey != nil {
				ip, url, err := tunnel.DeployTunnelStack(ctx, tunnel.TunnelConfig{
					Zone:      "us-central1-a",
					Username:  "tunneladmin",
					SSHKey:    sshPrivateKey,
					Machine:   "e2-micro",
					Image:     "ubuntu-os-cloud/ubuntu-2204-lts",
					PortRange: "9000-9100",
					Domain:    tunnelDomain,
				})
				if err != nil {
					return err
				}

				ctx.Export("tunnelVpsIp", ip)
				ctx.Export("tunnelUrl", url)
			}
		}
		*/

		// Export useful URLs
		utils.ExportURL(ctx, "apigatewayHostname", gatewayInstance.DefaultHostname)
		utils.ExportURL(ctx, "apiConfigId", apiConfig.ID().ApplyT(func(id pulumi.ID) string { return string(id) }).(pulumi.StringOutput))
		utils.ExportURL(ctx, "apiGatewayId", api.ApiId)

		utils.ExportURL(ctx, "catalystFunctionsServiceAccountEmail", sa.Email)

		utils.ExportURL(ctx, "setApiKeyFunctionUrl", setFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "removeApiKeyFunctionUrl", removeFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "getApiKeyStatusFunctionUrl", getApiKeyStatusFn.Function.HttpsTriggerUrl)

		utils.ExportURL(ctx, "proxyToGenkitFunctionUrl", proxyFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "parseResumeFunctionUrl", parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		utils.ExportURL(ctx, "pythonADKAgentServiceUrl", pythonAgentService.GetURL())

		// Export Python Agent Gateway Function URLs
		utils.ExportURL(ctx, "startInterviewFunctionUrl", startInterviewFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "responseInterviewFunctionUrl", responseInterviewFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "statusInterviewFunctionUrl", statusInterviewFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "endInterviewFunctionUrl", endInterviewFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "getReportFunctionUrl", getReportFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "agentHealthFunctionUrl", agentHealthFn.Function.HttpsTriggerUrl)

		utils.ExportURL(ctx, "gatewayHostname", gatewayInstance.DefaultHostname)
		utils.ExportURL(ctx, "functionSourceBucketName", sourceBucket.Name)
		utils.ExportURL(ctx, "gatewayId", gatewayInstance.GatewayId)
		utils.ExportURL(ctx, "deploymentBucketName", deploymentBucket.Name)
		utils.ExportURL(ctx, "emailNotificationChannelId", notificationChannel.ID().ApplyT(func(id pulumi.ID) string { return string(id) }).(pulumi.StringOutput))
		utils.ExportURL(ctx, "criticalErrorLogMetricName", logMetric.Name)

		// Export RAG Infrastructure URLs and IDs
		utils.ExportURL(ctx, "contentScraperFunctionUrl", ragInfra.ContentScraperFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		utils.ExportURL(ctx, "vectorSearchFunctionUrl", ragInfra.VectorSearchFunction.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		utils.ExportURL(ctx, "contentIndexerFunctionUrl", ragInfra.ContentIndexerFunction.URL)
		utils.ExportURL(ctx, "indexingTopicName", ragInfra.IndexingTopic.Name)
		utils.ExportURL(ctx, "indexingSubscriptionName", ragInfra.IndexingSubscription.Name)
		utils.ExportURL(ctx, "youtubeAPISecretName", ragInfra.YouTubeAPISecret.SecretId)
		utils.ExportURL(ctx, "embeddingAPISecretName", ragInfra.EmbeddingAPISecret.SecretId)

		// Import Firebase configuration from infrastructure stack
		firebaseConfig, err := envconfig.ImportFirebaseConfig(ctx)
		if err != nil {
			return err
		}

		// Generate environment file content
		envFileContent := envconfig.GenerateEnvFile(envconfig.EnvConfig{
			Environment:      cfg.Environment,
			BackendURL:       gatewayInstance.DefaultHostname,
			Firebase:         *firebaseConfig,
			DefaultGeminiKey: cfg.DefaultGeminiKey,
			YouTubeAPIKey:    ragInfra.YouTubeAPISecret.SecretId, // This should be the actual key value
		})

		// Export the environment file content
		ctx.Export("envFileContent", envFileContent)

		// Also export individual Firebase config values for convenience
		ctx.Export("firebaseApiKey", firebaseConfig.APIKey)
		ctx.Export("firebaseAuthDomain", firebaseConfig.AuthDomain)
		ctx.Export("firebaseProjectId", firebaseConfig.ProjectID)
		ctx.Export("firebaseStorageBucket", firebaseConfig.StorageBucket)
		ctx.Export("firebaseMessagingSenderId", firebaseConfig.MessagingSenderID)
		ctx.Export("firebaseAppId", firebaseConfig.AppID)

		return nil
	})
}
