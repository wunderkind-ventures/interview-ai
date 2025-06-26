package iam

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/secretmanager"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type ServiceAccountConfig struct {
	ProjectID   string
	Environment string
	Name        string
	DisplayName string
	Description string
	Roles       []string
}

// CreateInfrastructureServiceAccount creates a service account with the necessary roles for infrastructure management
func CreateInfrastructureServiceAccount(ctx *pulumi.Context, cfg ServiceAccountConfig) (*serviceaccount.Account, *serviceaccount.Key, error) {
	// Create service account
	sa, err := serviceaccount.NewAccount(ctx, fmt.Sprintf("%s-service-account", cfg.Environment), &serviceaccount.AccountArgs{
		Project:     pulumi.String(cfg.ProjectID),
		AccountId:   pulumi.String(fmt.Sprintf("%s-infra-service-account", cfg.Environment)),
		DisplayName: pulumi.String(cfg.DisplayName),
		Description: pulumi.String(cfg.Description),
	})
	if err != nil {
		return nil, nil, err
	}

	// Assign IAM roles to service account
	for _, role := range cfg.Roles {
		_, err := projects.NewIAMMember(ctx, fmt.Sprintf("%s-%s", cfg.ProjectID, role), &projects.IAMMemberArgs{
			Project: pulumi.String(cfg.ProjectID),
			Role:    pulumi.String(role),
			Member:  pulumi.Sprintf("serviceAccount:%s", sa.Email),
		})
		if err != nil {
			return nil, nil, err
		}
	}

	// Create service account key
	key, err := serviceaccount.NewKey(ctx, fmt.Sprintf("%s-service-account-key", cfg.Environment), &serviceaccount.KeyArgs{
		ServiceAccountId: sa.Name,
		KeyAlgorithm:     pulumi.String("KEY_ALG_RSA_2048"),
	}, pulumi.DependsOn([]pulumi.Resource{sa}))
	if err != nil {
		return nil, nil, err
	}

	_, err = secretmanager.NewSecret(ctx, fmt.Sprintf("%s-service-account-key", cfg.Environment), &secretmanager.SecretArgs{
		Project: pulumi.String(cfg.ProjectID),
		Replication: &secretmanager.SecretReplicationArgs{
			Auto: &secretmanager.SecretReplicationAutoArgs{},
			// UserManaged: &secretmanager.SecretReplicationUserManagedArgs{
			// 	Replicas: secretmanager.SecretReplicationUserManagedReplicaArray{
			// 		&secretmanager.SecretReplicationUserManagedReplicaArgs{
			// 			CustomerManagedEncryption: &secretmanager.SecretReplicationUserManagedReplicaCustomerManagedEncryptionArgs{
			// 				KmsKeyName: pulumi.String(fmt.Sprintf("projects/%s/locations/global/keyRings/%s/cryptoKeys/%s", cfg.ProjectID, cfg.Environment, cfg.Environment)),
			// 			},
			// 		},
			// 	},
			// },
		},
		SecretId: pulumi.String(fmt.Sprintf("%s-service-account-key", cfg.Environment)),
	}, pulumi.Protect(true))
	if err != nil {
		return nil, nil, err
	}

	return sa, key, nil
}

// StoreServiceAccountKeyInSecretManager stores the service account key in Google Secret Manager
func StoreServiceAccountKeyInSecretManager(ctx *pulumi.Context, projectID, environment string, key *serviceaccount.Key) error {
	// Store service account key in Secret Manager
	_, err := secretmanager.NewSecret(ctx, fmt.Sprintf("%s-service-account-key-secret", environment), &secretmanager.SecretArgs{
		Project:  pulumi.String(projectID),
		SecretId: pulumi.String(fmt.Sprintf("%s-service-account-key", environment)),
		Replication: &secretmanager.SecretReplicationArgs{
			Auto: &secretmanager.SecretReplicationAutoArgs{},
		},
	})
	if err != nil {
		return err
	}

	_, err = secretmanager.NewSecretVersion(ctx, fmt.Sprintf("%s-service-account-key-version", environment), &secretmanager.SecretVersionArgs{
		Secret:     pulumi.Sprintf("projects/%s/secrets/%s-service-account-key", projectID, environment),
		SecretData: key.PrivateKey,
	})
	return err
}

// GetInfrastructureRoles returns the standard roles needed for infrastructure service accounts
func GetInfrastructureRoles() []string {
	return []string{
		"roles/cloudfunctions.admin",
		"roles/firebase.admin",
		"roles/resourcemanager.projectIamAdmin",
		"roles/secretmanager.admin",
		"roles/aiplatform.user",
		"roles/apigateway.admin",
		"roles/compute.admin",
		"roles/firebasestorage.admin",
		"roles/iam.oauthClientAdmin",
		"roles/iam.serviceAccountUser",
		"roles/logging.admin",
		"roles/monitoring.admin",
		"roles/pubsub.admin",
		"roles/storage.objectViewer",
	}
}
