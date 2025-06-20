package secrets

// Secret Manager helpers for GCF

import (
	"context"
	"fmt"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SecretNameForUser generates the Google Secret Manager secret name for a given user ID.
func SecretNameForUser(userID string) string {
	return fmt.Sprintf("user-gemini-api-key-%s", userID)
}

// GetUserAPIKey accesses a secret version from Secret Manager.
// It expects the Secret Manager client and GCP Project ID to be passed or be accessible.
func GetUserAPIKey(ctx context.Context, client *secretmanager.Client, gcpProjectID string, userID string) (string, error) {
	if client == nil {
		return "", fmt.Errorf("Secret Manager client not initialized")
	}
	secretID := SecretNameForUser(userID)
	secretVersionName := fmt.Sprintf("projects/%s/secrets/%s/versions/latest", gcpProjectID, secretID)

	accessRequest := &secretmanagerpb.AccessSecretVersionRequest{
		Name: secretVersionName,
	}

	result, err := client.AccessSecretVersion(ctx, accessRequest)
	if err != nil {
		st, ok := status.FromError(err)
		if ok && (st.Code() == codes.NotFound || st.Code() == codes.PermissionDenied || st.Code() == codes.FailedPrecondition) {
			return "", fmt.Errorf("no active API key found for user %s: %w", userID, err) // Specific error for not found/disabled
		}
		return "", fmt.Errorf("failed to access secret version for user %s: %w", userID, err) // General error
	}

	return string(result.Payload.Data), nil
}