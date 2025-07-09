package iam

import (
	"encoding/base64"
	"fmt"

	"catalyst-backend/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/secretmanager"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// GitHubActionsServiceAccount creates a service account for GitHub Actions CI/CD
type GitHubActionsServiceAccount struct {
	ServiceAccount *serviceaccount.Account
	KeySecret      *secretmanager.Secret
}

// CreateGitHubActionsServiceAccount creates a service account with all necessary permissions for CI/CD
func CreateGitHubActionsServiceAccount(ctx *pulumi.Context, cfg *config.CatalystConfig) (*GitHubActionsServiceAccount, error) {
	// Create the service account
	saName := fmt.Sprintf("github-actions-%s", cfg.Environment)
	sa, err := serviceaccount.NewAccount(ctx, saName, &serviceaccount.AccountArgs{
		AccountId:   pulumi.String(saName),
		DisplayName: pulumi.Sprintf("GitHub Actions CI/CD (%s)", cfg.Environment),
		Description: pulumi.String("Service account for GitHub Actions deployment workflows"),
		Project:     pulumi.String(cfg.GcpProject),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create service account: %w", err)
	}

	// Define all required roles for CI/CD
	roles := []string{
		// Cloud Functions management
		"roles/cloudfunctions.admin",
		"roles/iam.serviceAccountUser",
		
		// Storage management (for function source code)
		"roles/storage.admin",
		
		// API Gateway management
		"roles/apigateway.admin",
		
		// Secret Manager (for accessing secrets)
		"roles/secretmanager.admin",
		
		// Firebase Admin (for Firebase deployments)
		"roles/firebase.admin",
		
		// Cloud Run (for containerized services)
		"roles/run.admin",
		
		// Service Usage (for enabling APIs)
		"roles/serviceusage.serviceUsageAdmin",
		
		// Monitoring (for viewing logs and metrics)
		"roles/monitoring.viewer",
		"roles/logging.viewer",
		
		// Firestore (for backup operations)
		"roles/datastore.owner",
		
		// BigQuery (for analytics)
		"roles/bigquery.dataEditor",
		"roles/bigquery.jobUser",
	}

	// Grant all necessary roles
	for i, role := range roles {
		memberName := fmt.Sprintf("%s-binding-%d", saName, i)
		_, err = projects.NewIAMMember(ctx, memberName, &projects.IAMMemberArgs{
			Project: pulumi.String(cfg.GcpProject),
			Role:    pulumi.String(role),
			Member:  pulumi.Sprintf("serviceAccount:%s", sa.Email),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to grant role %s: %w", role, err)
		}
	}

	// Create a service account key
	key, err := serviceaccount.NewKey(ctx, fmt.Sprintf("%s-key", saName), &serviceaccount.KeyArgs{
		ServiceAccountId: sa.Name,
		PublicKeyType:    pulumi.String("TYPE_X509_PEM_FILE"),
		PrivateKeyType:   pulumi.String("TYPE_GOOGLE_CREDENTIALS_FILE"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create service account key: %w", err)
	}

	// Store the key in Secret Manager for secure access
	secretName := fmt.Sprintf("github-actions-sa-key-%s", cfg.Environment)
	keySecret, err := secretmanager.NewSecret(ctx, secretName, &secretmanager.SecretArgs{
		SecretId: pulumi.String(secretName),
		Project:  pulumi.String(cfg.GcpProject),
		Replication: &secretmanager.SecretReplicationArgs{
			UserManaged: &secretmanager.SecretReplicationUserManagedArgs{
				Replicas: secretmanager.SecretReplicationUserManagedReplicaArray{
					&secretmanager.SecretReplicationUserManagedReplicaArgs{
						Location: pulumi.String(cfg.GcpRegion),
					},
				},
			},
		},
		Labels: pulumi.StringMap{
			"environment": pulumi.String(cfg.Environment),
			"purpose":     pulumi.String("github-actions-ci-cd"),
			"managed-by":  pulumi.String("pulumi"),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create secret: %w", err)
	}

	// Create a secret version with the key content
	_, err = secretmanager.NewSecretVersion(ctx, fmt.Sprintf("%s-version", secretName), &secretmanager.SecretVersionArgs{
		Secret: keySecret.ID(),
		SecretData: key.PrivateKey.ApplyT(func(privateKey string) string {
			return privateKey
		}).(pulumi.StringOutput),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create secret version: %w", err)
	}

	// Export useful information
	ctx.Export(fmt.Sprintf("githubActionsServiceAccount_%s", cfg.Environment), sa.Email)
	ctx.Export(fmt.Sprintf("githubActionsKeySecretName_%s", cfg.Environment), keySecret.Name)
	
	// Export the base64-encoded key for easy copying to GitHub Secrets
	ctx.Export(fmt.Sprintf("githubActionsKeyBase64_%s", cfg.Environment), key.PrivateKey.ApplyT(func(privateKey string) string {
		return base64.StdEncoding.EncodeToString([]byte(privateKey))
	}).(pulumi.StringOutput))

	// Also create a convenient gcloud command to retrieve the key
	ctx.Export(fmt.Sprintf("githubActionsKeyRetrieveCommand_%s", cfg.Environment), pulumi.Sprintf(
		"gcloud secrets versions access latest --secret=%s --project=%s | base64",
		keySecret.Name, cfg.GcpProject,
	))

	return &GitHubActionsServiceAccount{
		ServiceAccount: sa,
		KeySecret:      keySecret,
	}, nil
}

// RotateGitHubActionsKey creates a new key version for rotation
func RotateGitHubActionsKey(ctx *pulumi.Context, cfg *config.CatalystConfig, sa *serviceaccount.Account, keySecret *secretmanager.Secret) error {
	// Create a new key
	keyName := fmt.Sprintf("github-actions-%s-key-rotated", cfg.Environment)
	newKey, err := serviceaccount.NewKey(ctx, keyName, &serviceaccount.KeyArgs{
		ServiceAccountId: sa.Name,
		PublicKeyType:    pulumi.String("TYPE_X509_PEM_FILE"),
		PrivateKeyType:   pulumi.String("TYPE_GOOGLE_CREDENTIALS_FILE"),
	})
	if err != nil {
		return fmt.Errorf("failed to create new service account key: %w", err)
	}

	// Add new version to existing secret
	_, err = secretmanager.NewSecretVersion(ctx, fmt.Sprintf("%s-rotated", keySecret.SecretId), &secretmanager.SecretVersionArgs{
		Secret: keySecret.ID(),
		SecretData: newKey.PrivateKey.ApplyT(func(privateKey string) string {
			return privateKey
		}).(pulumi.StringOutput),
	})
	if err != nil {
		return fmt.Errorf("failed to create new secret version: %w", err)
	}

	// Export the new base64-encoded key
	ctx.Export(fmt.Sprintf("githubActionsKeyBase64_rotated_%s", cfg.Environment), newKey.PrivateKey.ApplyT(func(privateKey string) string {
		return base64.StdEncoding.EncodeToString([]byte(privateKey))
	}).(pulumi.StringOutput))

	return nil
}