package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/secretmanager"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type ProjectConfig struct {
	ID          string
	Name        string
	Environment string
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		// Project configurations
		projects := []ProjectConfig{
			{ID: "wkv-interviewai-dev", Name: "InterviewAI Development", Environment: "dev"},
			{ID: "wkv-interviewai-stg", Name: "InterviewAI Staging", Environment: "staging"},
		}

		billingAccount := "01F9C0-CF9DFB-DB01DF"

		// Core APIs to enable (matching your production setup)
		enabledApis := []string{
			"aiplatform.googleapis.com",
			"analyticshub.googleapis.com",
			"apigateway.googleapis.com",
			"artifactregistry.googleapis.com",
			"bigquery.googleapis.com",
			"cloudaicompanion.googleapis.com",
			"cloudapis.googleapis.com",
			"cloudasset.googleapis.com",
			"cloudbuild.googleapis.com",
			"cloudfunctions.googleapis.com",
			"cloudkms.googleapis.com",
			"cloudresourcemanager.googleapis.com",
			"cloudscheduler.googleapis.com",
			"cloudtrace.googleapis.com",
			"compute.googleapis.com",
			"containerregistry.googleapis.com",
			"datastore.googleapis.com",
			"eventarc.googleapis.com",
			"firebase.googleapis.com",
			"firebaseappcheck.googleapis.com",
			"firebasehosting.googleapis.com",
			"firebaseml.googleapis.com",
			"firebaseremoteconfig.googleapis.com",
			"firebaserules.googleapis.com",
			"firebasestorage.googleapis.com",
			"firestore.googleapis.com",
			"generativelanguage.googleapis.com",
			"iam.googleapis.com",
			"iamcredentials.googleapis.com",
			"identitytoolkit.googleapis.com",
			"logging.googleapis.com",
			"monitoring.googleapis.com",
			"pubsub.googleapis.com",
			"recaptchaenterprise.googleapis.com",
			"run.googleapis.com",
			"secretmanager.googleapis.com",
			"serviceusage.googleapis.com",
			"speech.googleapis.com",
			"storage.googleapis.com",
			"vision.googleapis.com",
		}

		// Service Account roles (matching your production setup)
		serviceAccountRoles := []string{
			"roles/cloudfunctions.admin",
			"roles/firebase.admin",
			"roles/resourcemanager.projectIamAdmin",
			"roles/secretmanager.admin",
			"roles/aiplatform.user",
		}

		for _, proj := range projects {
			// Create project (Note: You may need to handle existing projects)
			project, err := projects.NewProject(ctx, proj.ID, &projects.ProjectArgs{
				Name:           pulumi.String(proj.Name),
				ProjectId:      pulumi.String(proj.ID),
				BillingAccount: pulumi.String(billingAccount),
				SkipDelete:     pulumi.Bool(true), // Prevent accidental deletion
			}, pulumi.Protect(true)) // Protect from deletion
			if err != nil {
				return err
			}

			// Enable APIs
			for _, api := range enabledApis {
				_, err := gcp.NewProjectService(ctx, fmt.Sprintf("%s-%s", proj.ID, api), &gcp.ProjectServiceArgs{
					Project:                   project.ProjectId,
					Service:                   pulumi.String(api),
					DisableOnDestroy:          pulumi.Bool(false), // Keep APIs enabled when destroying stack
					DisableDependentServices:  pulumi.Bool(false),
				}, pulumi.DependsOn([]pulumi.Resource{project}))
				if err != nil {
					return err
				}
			}

			// Create service account
			serviceAccount, err := serviceaccount.NewAccount(ctx, fmt.Sprintf("%s-service-account", proj.Environment), &serviceaccount.AccountArgs{
				Project:     project.ProjectId,
				AccountId:   pulumi.String(fmt.Sprintf("%s-infra-service-account", proj.Environment)),
				DisplayName: pulumi.String(fmt.Sprintf("%s Service Account", proj.Name)),
				Description: pulumi.String(fmt.Sprintf("Service account for %s with Cloud Functions Admin, Firebase Admin, Project IAM Admin, and Secret Manager Admin permissions", proj.Environment)),
			}, pulumi.DependsOn([]pulumi.Resource{project}))
			if err != nil {
				return err
			}

			// Assign IAM roles to service account
			for _, role := range serviceAccountRoles {
				_, err := projects.NewIAMMember(ctx, fmt.Sprintf("%s-%s", proj.ID, role), &projects.IAMMemberArgs{
					Project: project.ProjectId,
					Role:    pulumi.String(role),
					Member: pulumi.Sprintf("serviceAccount:%s", serviceAccount.Email),
				}, pulumi.DependsOn([]pulumi.Resource{serviceAccount}))
				if err != nil {
					return err
				}
			}

			// Create service account key
			serviceAccountKey, err := serviceaccount.NewKey(ctx, fmt.Sprintf("%s-service-account-key", proj.Environment), &serviceaccount.KeyArgs{
				ServiceAccountId: serviceAccount.Name,
				KeyAlgorithm:     pulumi.String("KEY_ALG_RSA_2048"),
			}, pulumi.DependsOn([]pulumi.Resource{serviceAccount}))
			if err != nil {
				return err
			}

			// Store service account key in Secret Manager
			_, err = secretmanager.NewSecret(ctx, fmt.Sprintf("%s-service-account-key-secret", proj.Environment), &secretmanager.SecretArgs{
				Project:  project.ProjectId,
				SecretId: pulumi.String(fmt.Sprintf("%s-service-account-key", proj.Environment)),
				Replication: &secretmanager.SecretReplicationArgs{
					Auto: &secretmanager.SecretReplicationAutoArgs{},
				},
			}, pulumi.DependsOn([]pulumi.Resource{project}))
			if err != nil {
				return err
			}

			_, err = secretmanager.NewSecretVersion(ctx, fmt.Sprintf("%s-service-account-key-version", proj.Environment), &secretmanager.SecretVersionArgs{
				Secret:     pulumi.Sprintf("projects/%s/secrets/%s-service-account-key", project.ProjectId, proj.Environment),
				SecretData: serviceAccountKey.PrivateKey,
			})
			if err != nil {
				return err
			}

			// Export important values
			ctx.Export(fmt.Sprintf("%s_project_id", proj.Environment), project.ProjectId)
			ctx.Export(fmt.Sprintf("%s_service_account_email", proj.Environment), serviceAccount.Email)
			ctx.Export(fmt.Sprintf("%s_service_account_name", proj.Environment), serviceAccount.Name)
		}

		return nil
	})
}

