package main

import (
	"fmt"

	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	"interviewai-gcp-infrastructure/iam"
)

type ProjectConfig struct {
	ID          string
	Name        string
	Environment string
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Project configurations
		projectConfigs := []ProjectConfig{
			{ID: "wkv-interviewai-dev", Name: "InterviewAI Development", Environment: "dev"},
			{ID: "wkv-interviewai-stg", Name: "InterviewAI Staging", Environment: "staging"},
		}

		for _, proj := range projectConfigs {
			// Create infrastructure service account with necessary permissions
			sa, key, err := iam.CreateInfrastructureServiceAccount(ctx, iam.ServiceAccountConfig{
				ProjectID:   proj.ID,
				Environment: proj.Environment,
				Name:        fmt.Sprintf("%s-infra-service-account", proj.Environment),
				DisplayName: fmt.Sprintf("%s Service Account", proj.Name),
				Description: fmt.Sprintf("Service account for %s with infrastructure management permissions", proj.Environment),
				Roles:       iam.GetInfrastructureRoles(),
			})
			if err != nil {
				return err
			}

			// Store service account key in Secret Manager
			err = iam.StoreServiceAccountKeyInSecretManager(ctx, proj.ID, proj.Environment, key)
			if err != nil {
				return err
			}

			// Export service account key for dev/staging environments
			if proj.Environment == "dev" || proj.Environment == "staging" {
				ctx.Export(fmt.Sprintf("%s_service_account_key", proj.Environment), key.PrivateKey)
			}

			// Export important values for use by other stacks
			ctx.Export(fmt.Sprintf("%s_project_id", proj.Environment), pulumi.String(proj.ID))
			ctx.Export(fmt.Sprintf("%s_service_account_email", proj.Environment), sa.Email)
			ctx.Export(fmt.Sprintf("%s_service_account_name", proj.Environment), sa.Name)
		}

		return nil
	})
}
