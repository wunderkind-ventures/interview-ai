package handlers

// Placeholder for API key management handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"interview-ai/catalyst-go-backend/middleware"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SetAPIKeyRequest defines the expected request body for setting an API key.
// We'll use a specific struct for this to make it clear, though Gin can bind to map[string]string.
type SetAPIKeyRequest struct {
	APIKey string `json:"apiKey" binding:"required"`
}

// secretNameForUser generates the Google Secret Manager secret name for a given user ID.
func secretNameForUser(userID string) string {
	return fmt.Sprintf("user-gemini-api-key-%s", userID)
}

// SetAPIKey handles the request to store a user's API key in Secret Manager.
func SetAPIKey(client *secretmanager.Client, gcpProjectID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		firebaseUser := middleware.GetFirebaseUser(c)
		if firebaseUser == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}
		userID := firebaseUser.UID

		var req SetAPIKeyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}

		if req.APIKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "API key cannot be empty"})
			return
		}

		ctx := context.Background()
		secretID := secretNameForUser(userID)
		parent := fmt.Sprintf("projects/%s", gcpProjectID)

		// Try to add a new version to an existing secret first.
		addVersionReq := &secretmanagerpb.AddSecretVersionRequest{
			Parent: fmt.Sprintf("%s/secrets/%s", parent, secretID),
			Payload: &secretmanagerpb.SecretPayload{
				Data: []byte(req.APIKey),
			},
		}

		_, err := client.AddSecretVersion(ctx, addVersionReq)
		if err != nil {
			// If the secret doesn't exist, create it and add the first version.
			st, ok := status.FromError(err)
			if ok && st.Code() == codes.NotFound { // Secret does not exist
				log.Printf("Secret %s not found for user %s. Creating it.", secretID, userID)
				createSecretReq := &secretmanagerpb.CreateSecretRequest{
					Parent:   parent,
					SecretId: secretID,
					Secret: &secretmanagerpb.Secret{
						Replication: &secretmanagerpb.Replication{
							Replication: &secretmanagerpb.Replication_Automatic_{ // Automatic replication
								Automatic: &secretmanagerpb.Replication_Automatic{},
							},
						},
					},
				}
				createdSecret, createErr := client.CreateSecret(ctx, createSecretReq)
				if createErr != nil {
					log.Printf("Failed to create secret %s for user %s: %v", secretID, userID, createErr)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create secret"})
					return
				}
				// Now add the first version to the newly created secret
				addVersionReq.Parent = createdSecret.Name
				if _, addVerErr := client.AddSecretVersion(ctx, addVersionReq); addVerErr != nil {
					log.Printf("Failed to add initial version to secret %s for user %s: %v", secretID, userID, addVerErr)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add secret version"})
					return
				}
				log.Printf("Successfully created secret %s and added first version for user %s.", secretID, userID)
			} else { // Some other error occurred when adding a version
				log.Printf("Failed to add secret version for secret %s, user %s: %v", secretID, userID, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add secret version"})
				return
			}
		} else {
			log.Printf("Successfully added new version to secret %s for user %s.", secretID, userID)
		}

		c.JSON(http.StatusOK, gin.H{"message": "API key stored successfully"})
	}
}

// RemoveAPIKey handles the request to delete a user's API key from Secret Manager.
// This will delete the secret itself, which removes all versions.
func RemoveAPIKey(client *secretmanager.Client, gcpProjectID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		firebaseUser := middleware.GetFirebaseUser(c)
		if firebaseUser == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}
		userID := firebaseUser.UID

		ctx := context.Background()
		secretID := secretNameForUser(userID)
		secretPath := fmt.Sprintf("projects/%s/secrets/%s", gcpProjectID, secretID)

		// First, try to disable all versions of the secret. This is a softer delete.
		// List versions to disable them one by one.
		// Note: A more direct approach might be to delete the secret, but disabling versions
		// can be useful if you want a recovery window or audit trail.
		// For simplicity here, we will directly delete the secret.

		deleteReq := &secretmanagerpb.DeleteSecretRequest{
			Name: secretPath,
		}

		if err := client.DeleteSecret(ctx, deleteReq); err != nil {
			st, ok := status.FromError(err)
			if ok && st.Code() == codes.NotFound {
				log.Printf("Secret %s for user %s not found. Nothing to delete.", secretID, userID)
				c.JSON(http.StatusOK, gin.H{"message": "API key not found, nothing to remove"})
				return
			}
			log.Printf("Failed to delete secret %s for user %s: %v", secretID, userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove API key"})
			return
		}

		log.Printf("Successfully deleted secret %s for user %s.", secretID, userID)
		c.JSON(http.StatusOK, gin.H{"message": "API key removed successfully"})
	}
}

// GetAPIKeyStatus handles the request to check if a user has an API key stored.
func GetAPIKeyStatus(client *secretmanager.Client, gcpProjectID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		firebaseUser := middleware.GetFirebaseUser(c)
		if firebaseUser == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}
		userID := firebaseUser.UID

		ctx := context.Background()
		secretID := secretNameForUser(userID)
		secretVersionName := fmt.Sprintf("projects/%s/secrets/%s/versions/latest", gcpProjectID, secretID)

		getRequest := &secretmanagerpb.GetSecretVersionRequest{
			Name: secretVersionName,
		}

		_, err := client.GetSecretVersion(ctx, getRequest) // We only care if it exists
		if err != nil {
			st, ok := status.FromError(err)
			// If it's NotFound, or if the secret exists but has no enabled versions (PERMISSION_DENIED on AccessSecretVersion)
			// or if the version is disabled (FAILED_PRECONDITION for GetSecretVersion on disabled version).
			if (ok && (st.Code() == codes.NotFound || st.Code() == codes.PermissionDenied || st.Code() == codes.FailedPrecondition)) ||
				(err.Error() == "rpc error: code = NotFound desc = secret version projects/your-gcp-project-id/secrets/user-gemini-api-key-some-user-id/versions/latest not found or is disabled") {
				c.JSON(http.StatusOK, gin.H{"hasKey": false, "status": "No active API key found for user."})
				return
			}
			// Any other error is unexpected
			log.Printf("Error checking secret version %s for user %s: %v", secretVersionName, userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check API key status"})
			return
		}

		// If we got here, the 'latest' version exists and is accessible (implies it's enabled).
		c.JSON(http.StatusOK, gin.H{"hasKey": true, "status": "API key is configured for user."}) // Don't return the key itself
	}
}

// Helper function to access a secret version. Used by the AI proxy.
// It's placed here as it's closely related to secret management.
func GetUserAPIKey(ctx context.Context, client *secretmanager.Client, gcpProjectID string, userID string) (string, error) {
	secretID := secretNameForUser(userID)
	secretVersionName := fmt.Sprintf("projects/%s/secrets/%s/versions/latest", gcpProjectID, secretID)

	accessRequest := &secretmanagerpb.AccessSecretVersionRequest{
		Name: secretVersionName,
	}

	result, err := client.AccessSecretVersion(ctx, accessRequest)
	if err != nil {
		st, ok := status.FromError(err)
		if ok && (st.Code() == codes.NotFound || st.Code() == codes.PermissionDenied || st.Code() == codes.FailedPrecondition) {
			// NotFound: Secret or version doesn't exist.
			// PermissionDenied: Secret might exist, but Access is denied (e.g. all versions disabled).
			// FailedPrecondition: Version exists but is disabled.
			return "", fmt.Errorf("no active API key found for user %s: %w", userID, err)
		}
		return "", fmt.Errorf("failed to access secret version for user %s: %w", userID, err)
	}

	return string(result.Payload.Data), nil
}
