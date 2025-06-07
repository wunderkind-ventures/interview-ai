package main

import (
	"fmt"

	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	tunnel "interview-ai/pulumi-gcp-catalyst-backend/tunnel"

	"./config"
	"./functions"
	"./functions/component"
	"./gateway"
	"./iam"
	"./monitoring"
	"./storage"
	"./utils"
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

		// Deploy Cloud Functions (Gen1)
		setFn, err := functions.CreateCloudFunction(ctx, "SetAPIKeyGCF"+nameSuffix, "SetAPIKeyGCF", deploymentBucket.Name, "../backends/catalyst-go-backend/functions/setapikey", cfg.GcpRegion, cfg.GcpProject, sa.Email, pulumi.StringMap{})
		if err != nil {
			return err
		}
		removeFn, err := functions.CreateCloudFunction(ctx, "RemoveAPIKeyGCF"+nameSuffix, "RemoveAPIKeyGCF", deploymentBucket.Name, "../backends/catalyst-go-backend/functions/removeapikey", cfg.GcpRegion, cfg.GcpProject, sa.Email, pulumi.StringMap{})
		if err != nil {
			return err
		}
		proxyFn, err := functions.CreateCloudFunction(ctx, "ProxyToGenkitGCF"+nameSuffix, "ProxyToGenkitGCF", deploymentBucket.Name, "../backends/catalyst-go-backend/functions/proxytogenkit", cfg.GcpRegion, cfg.GcpProject, sa.Email, pulumi.StringMap{
			"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
			"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
		})
		if err != nil {
			return err
		}

		// Deploy ParseResume Gen2 Function via ComponentResource
		parseResumeFn, err := component.NewGen2Function(ctx, "ParseResume"+nameSuffix, &component.Gen2FunctionArgs{
			Name:        "ParseResume" + nameSuffix,
			EntryPoint:  "ParseResume",
			SourcePath:  "../backends/catalyst-go-backend/functions/docsupport/parseresume",
			Bucket:      sourceBucket,
			Region:      cfg.GcpRegion,
			Project:     cfg.GcpProject,
			Description: "Parses uploaded resume/document files (docx, md) and returns text.",
			EnvVars:     pulumi.StringMap{},
		})
		if err != nil {
			return err
		}

		// Create the API Gateway API
		api, err := gateway.CreateApi(ctx, "catalyst-backend-api"+nameSuffix, cfg.GcpProject, cfg.Environment)
		if err != nil {
			return err
		}

		apiConfig, err := gateway.CreateApiConfig(ctx, "catalyst-api-config"+nameSuffix, api.ApiId, cfg.OpenapiSpecPath, []pulumi.StringInput{
			setFn.HttpsTriggerUrl,
			removeFn.HttpsTriggerUrl,
			proxyFn.HttpsTriggerUrl,
			parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *functions.CloudFunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput),
		}, pulumi.ResourceArray{setFn, removeFn, proxyFn}, cfg.GcpProject)
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
			tunnelVpsIp, err := tunnel.DeployTunnelInstance(ctx, tunnel.TunnelConfig{
				Zone:      "us-central1-a",
				Username:  "tunneladmin",
				SSHKey:    "ssh-rsa AAAA...your_key...",
				Machine:   "e2-micro",
				Image:     "ubuntu-os-cloud/ubuntu-2204-lts",
				PortRange: "9000-9100",
			})
			if err != nil {
				return err
			}
			// Export useful URLs
			ctx.Export("tunnelVpsIp", tunnelVpsIp)
		}

		utils.ExportURL(ctx, "setApiKeyUrl"+nameSuffix, setFn.HttpsTriggerUrl)
		utils.ExportURL(ctx, "removeApiKeyUrl"+nameSuffix, removeFn.HttpsTriggerUrl)
		utils.ExportURL(ctx, "proxyToGenkitUrl"+nameSuffix, proxyFn.HttpsTriggerUrl)
		utils.ExportURL(ctx, "parseResumeUrl"+nameSuffix, parseResumeFn.Function.ServiceConfig.ApplyT(func(sc *functions.CloudFunctionServiceConfig) string {
			if sc != nil && sc.Uri != nil {
				return *sc.Uri
			}
			return ""
		}).(pulumi.StringOutput))
		utils.ExportURL(ctx, "gatewayHostname"+nameSuffix, gatewayInstance.DefaultHostname)

		return nil
	})
}
