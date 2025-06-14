package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	"catalyst-backend/config"
	"catalyst-backend/functions/component"
	"catalyst-backend/gateway"
	"catalyst-backend/iam"
	"catalyst-backend/monitoring"
	"catalyst-backend/storage"
	tunnel "catalyst-backend/tunnel"
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
			SourcePath:     "../../backends/catalyst-backend/functions/setapikey",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
		})
		if err != nil {
			return err
		}

		removeFn, err := component.NewGen1Function(ctx, "RemoveAPIKeyGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "RemoveAPIKeyGCF" + nameSuffix,
			EntryPoint:     "RemoveAPIKeyGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-backend/functions/removeapikey",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
		})
		if err != nil {
			return err
		}

		getApiKeyStatusFn, err := component.NewGen1Function(ctx, "GetAPIKeyStatusGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "GetAPIKeyStatusGCF" + nameSuffix,
			EntryPoint:     "GetAPIKeyStatusGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-backend/functions/getapikeystatus",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
		})
		if err != nil {
			return err
		}

		proxyFn, err := component.NewGen1Function(ctx, "ProxyToGenkitGCF"+nameSuffix, &component.Gen1FunctionArgs{
			Name:           "ProxyToGenkitGCF" + nameSuffix,
			EntryPoint:     "ProxyToGenkitGCF",
			BucketName:     deploymentBucket.Name,
			SourcePath:     "../../backends/catalyst-backend/functions/proxytogenkit",
			Region:         cfg.GcpRegion,
			Project:        cfg.GcpProject,
			ServiceAccount: sa.Email,
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
		})
		if err != nil {
			return err
		}

		// Deploy ParseResume Gen2 Function via ComponentResource
		parseResumeFn, err := component.NewGen2Function(ctx, "ParseResume"+nameSuffix, &component.Gen2FunctionArgs{
			Name:        "ParseResume" + nameSuffix,
			EntryPoint:  "ParseResume",
			SourcePath:  "../../backends/catalyst-backend/functions/docsupport/parseresume",
			Bucket:      sourceBucket,
			Region:      cfg.GcpRegion,
			Project:     cfg.GcpProject,
			Description: "Parses uploaded resume/document files (docx, md) and returns text.",
			EnvVars: pulumi.StringMap{
				"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
				"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			},
		})
		if err != nil {
			return err
		}

		// Create the API Gateway API
		api, err := gateway.CreateApi(ctx, "catalyst-backend-api", cfg.GcpProject, cfg.Environment)
		if err != nil {
			return err
		}

		apiConfig, err := gateway.CreateApiConfig(ctx, "catalyst-api-config"+nameSuffix, api.ApiId, cfg.OpenapiSpecPath, []pulumi.StringInput{
			setFn.Function.HttpsTriggerUrl,
			removeFn.Function.HttpsTriggerUrl,
			proxyFn.Function.HttpsTriggerUrl,
			parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput),
		}, []pulumi.Resource{setFn.Function, removeFn.Function, proxyFn.Function}, cfg.GcpProject)
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

		if cfg.Environment == "dev" {
			tunnelDomain := cfg.TunnelDomain
			sshPrivateKey := cfg.SshPrivateKey

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

		// Export useful URLs
		utils.ExportURL(ctx, "apigatewayHostname"+nameSuffix, gatewayInstance.DefaultHostname)
		utils.ExportURL(ctx, "apiConfigId"+nameSuffix, apiConfig.ID().ToStringOutput())
		utils.ExportURL(ctx, "apiGatewayId"+nameSuffix, api.ApiId.ToStringOutput())

		utils.ExportURL(ctx, "catalystFunctionsServiceAccountEmail"+nameSuffix, sa.Email)

		utils.ExportURL(ctx, "setApiKeyFunctionUrl"+nameSuffix, setFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "removeApiKeyFunctionUrl"+nameSuffix, removeFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "getApiKeyStatusFunctionUrl"+nameSuffix, getApiKeyStatusFn.Function.HttpsTriggerUrl)

		utils.ExportURL(ctx, "proxyToGenkitFunctionUrl"+nameSuffix, proxyFn.Function.HttpsTriggerUrl)
		utils.ExportURL(ctx, "parseResumeFunctionUrl"+nameSuffix, parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		utils.ExportURL(ctx, "gatewayHostname"+nameSuffix, gatewayInstance.DefaultHostname)
		utils.ExportURL(ctx, "functionSourceBucketName"+nameSuffix, sourceBucket.Name)
		utils.ExportURL(ctx, "gatewayId"+nameSuffix, gatewayInstance.GatewayId)
		utils.ExportURL(ctx, "deploymentBucketName"+nameSuffix, deploymentBucket.Name)
		utils.ExportURL(ctx, "emailNotificationChannelId"+nameSuffix, notificationChannel.ID().ToStringOutput())
		utils.ExportURL(ctx, "criticalErrorLogMetricName"+nameSuffix, logMetric.Name)

		return nil
	})
}
