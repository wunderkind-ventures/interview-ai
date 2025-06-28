package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"

	"interviewai-gcp-infrastructure/firebase"
	"interviewai-gcp-infrastructure/iam"
	"interviewai-gcp-infrastructure/project"
)

type InfrastructureConfig struct {
	Environment string
	ProjectID   string
	ProjectName string
}

func loadConfig(ctx *pulumi.Context) (*InfrastructureConfig, error) {
	cfg := config.New(ctx, "")

	// Get configuration values
	environment := cfg.Require("environment")
	projectID := cfg.Require("projectId")
	projectName := cfg.Get("projectName")

	// Set default project name if not provided
	if projectName == "" {
		projectName = fmt.Sprintf("InterviewAI %s", environment)
	}

	return &InfrastructureConfig{
		Environment: environment,
		ProjectID:   projectID,
		ProjectName: projectName,
	}, nil
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Load configuration for the specific environment
		cfg, err := loadConfig(ctx)
		if err != nil {
			return err
		}

		// Configure GCP provider with explicit project and quota project
		_, err = gcp.NewProvider(ctx, "gcp-provider", &gcp.ProviderArgs{
			Project:             pulumi.String(cfg.ProjectID),
			UserProjectOverride: pulumi.Bool(true),
			BillingProject:      pulumi.String("01F9C0-CF9DFB-DB01DF"),
		})
		if err != nil {
			return err
		}

		// Skip project management for existing projects to avoid billing conflicts
		ctx.Log.Info(fmt.Sprintf("Using existing project: %s", cfg.ProjectID), nil)
		// Note: Billing should be managed directly in GCP Console or via Firebase to avoid conflicts

		// Enable required APIs
		err = project.EnableAPIs(ctx, cfg.ProjectID, project.GetCoreAPIs())
		if err != nil {
			return err
		}

		// App Engine removed - Firestore is managed directly in firebase.SetupFirebase

		// _, err = serviceaccount.NewAccount(ctx, "dev-service-account", &serviceaccount.AccountArgs{
		// 	AccountId:   pulumi.String("dev-infra-service-account"),
		// 	Description: pulumi.String("Service account for dev with infrastructure management permissions"),
		// 	DisplayName: pulumi.String("InterviewAI Development Service Account"),
		// 	Project:     pulumi.String("wkv-interviewai-dev"),
		// })
		// if err != nil {
		// 	return err
		// }

		// Create infrastructure service account with necessary permissions
		sa, key, err := iam.CreateInfrastructureServiceAccount(ctx, iam.ServiceAccountConfig{
			ProjectID:   cfg.ProjectID,
			Environment: cfg.Environment,
			Name:        fmt.Sprintf("%s-infra-service-account", cfg.Environment),
			DisplayName: fmt.Sprintf("%s Service Account", cfg.ProjectName),
			Description: fmt.Sprintf("Service account for %s with infrastructure management permissions", cfg.Environment),
			Roles:       iam.GetInfrastructureRoles(),
		})
		if err != nil {
			return err
		}

		// Store service account key in Secret Manager
		err = iam.StoreServiceAccountKeyInSecretManager(ctx, cfg.ProjectID, cfg.Environment, key)
		if err != nil {
			return err
		}

		// Setup Firebase
		firebaseOutputs, err := firebase.SetupFirebase(ctx, firebase.FirebaseConfig{
			ProjectID:   cfg.ProjectID,
			Environment: cfg.Environment,
		}, []pulumi.Resource{})
		if err != nil {
			return err
		}

		// Export service account key for dev/stage environments
		if cfg.Environment == "dev" || cfg.Environment == "stage" {
			ctx.Export("service_account_key", key.PrivateKey)
		}

		// Export important values for use by other stacks
		ctx.Export("project_id", pulumi.String(cfg.ProjectID))
		ctx.Export("environment", pulumi.String(cfg.Environment))
		ctx.Export("service_account_email", sa.Email)
		ctx.Export("service_account_name", sa.Name)

		// Export Firebase configuration
		ctx.Export("firebase_api_key", firebaseOutputs.APIKey)
		ctx.Export("firebase_auth_domain", firebaseOutputs.AuthDomain)
		ctx.Export("firebase_project_id", firebaseOutputs.ProjectID)
		ctx.Export("firebase_storage_bucket", firebaseOutputs.StorageBucket)
		ctx.Export("firebase_messaging_sender_id", firebaseOutputs.MessagingSenderID)
		ctx.Export("firebase_app_id", firebaseOutputs.AppID)
		ctx.Export("firebase_measurement_id", firebaseOutputs.MeasurementID)
		ctx.Export("firebase_web_client_id", firebaseOutputs.WebClientID)
		ctx.Export("firebase_web_client_secret", firebaseOutputs.WebClientSecret)

		return nil
	})
}
