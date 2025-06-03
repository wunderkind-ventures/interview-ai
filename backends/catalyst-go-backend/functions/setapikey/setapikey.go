package setapikey

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"interviewai.wkv.local/setapikey/internal/auth"
	"interviewai.wkv.local/setapikey/internal/httputils"
	"interviewai.wkv.local/setapikey/internal/secrets"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	firebaseAppSingleton  *firebase.App
	secretClientSingleton *secretmanager.Client
	gcpProjectIDEnv       string
)

// init runs during cold start or new instance creation, initializing shared clients.
// It is run once per function instance.
func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}

	// Initialize Firebase App Singleton
	saKeyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
	var err error
	var firebaseOpt option.ClientOption
	if saKeyPath != "" {
		firebaseOpt = option.WithCredentialsFile(saKeyPath)
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil, firebaseOpt)
	} else {
		// For GCF, if SA key path isn't set, it might use default credentials from the runtime service account
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase.NewApp in init: %v", err)
	}

	// Initialize Secret Manager Client Singleton
	secretClientSingleton, err = secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("secretmanager.NewClient in init: %v", err)
	}
	log.Println("SetAPIKey: Firebase App and Secret Manager Client initialized.")
}

// SetAPIKeyRequest defines the expected request body for setting an API key.
type SetAPIKeyRequest struct {
	APIKey string `json:"apiKey"`
}

// SetAPIKeyGCF is the HTTP Cloud Function for setting a user's API key.
func SetAPIKeyGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}
	userID := authedUser.UID

	var req SetAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputils.ErrorJSON(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if req.APIKey == "" {
		httputils.ErrorJSON(w, "API key cannot be empty", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	secretID := secrets.SecretNameForUser(userID)
	parentProject := fmt.Sprintf("projects/%s", gcpProjectIDEnv)
	secretFullName := fmt.Sprintf("%s/secrets/%s", parentProject, secretID)

	addVersionReq := &secretmanagerpb.AddSecretVersionRequest{
		Parent: secretFullName,
		Payload: &secretmanagerpb.SecretPayload{
			Data: []byte(req.APIKey),
		},
	}

	_, err = secretClientSingleton.AddSecretVersion(ctx, addVersionReq)
	if err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.NotFound { // Secret does not exist, create it
			log.Printf("SetAPIKeyGCF: Secret %s not found for user %s. Creating it.", secretID, userID)
			createSecretReq := &secretmanagerpb.CreateSecretRequest{
				Parent:   parentProject,
				SecretId: secretID,
				Secret: &secretmanagerpb.Secret{
					Replication: &secretmanagerpb.Replication{
						Replication: &secretmanagerpb.Replication_Automatic_{ // Automatic replication
							Automatic: &secretmanagerpb.Replication_Automatic{},
						},
					},
				},
			}
			createdSecret, createErr := secretClientSingleton.CreateSecret(ctx, createSecretReq)
			if createErr != nil {
				log.Printf("SetAPIKeyGCF: Failed to create secret %s for user %s: %v", secretID, userID, createErr)
				httputils.ErrorJSON(w, "Failed to create secret store", http.StatusInternalServerError)
				return
			}
			// Now add the first version to the newly created secret
			addVersionReq.Parent = createdSecret.Name // Use the full name of the created secret
			if _, addVerErr := secretClientSingleton.AddSecretVersion(ctx, addVersionReq); addVerErr != nil {
				log.Printf("SetAPIKeyGCF: Failed to add initial version to secret %s for user %s: %v", secretID, userID, addVerErr)
				httputils.ErrorJSON(w, "Failed to add initial secret version", http.StatusInternalServerError)
				return
			}
			log.Printf("SetAPIKeyGCF: Successfully created secret %s and added first version for user %s.", secretID, userID)
		} else { // Some other error occurred when adding a version
			log.Printf("SetAPIKeyGCF: Failed to add secret version for secret %s, user %s: %v", secretID, userID, err)
			httputils.ErrorJSON(w, "Failed to store API key", http.StatusInternalServerError)
			return
		}
	} else {
		log.Printf("SetAPIKeyGCF: Successfully added new version to secret %s for user %s.", secretID, userID)
	}

	httputils.RespondJSON(w, map[string]string{"message": "API key stored successfully"}, http.StatusOK)
}
