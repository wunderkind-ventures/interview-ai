package removeapikey

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"interviewai.wkv.local/removeapikey/internal/auth"
	"interviewai.wkv.local/removeapikey/internal/httputils"
	"interviewai.wkv.local/removeapikey/internal/secrets"

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

func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}

	saKeyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
	var err error
	var firebaseOpt option.ClientOption
	if saKeyPath != "" {
		firebaseOpt = option.WithCredentialsFile(saKeyPath)
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil, firebaseOpt)
	} else {
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase.NewApp in init: %v", err)
	}

	secretClientSingleton, err = secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("secretmanager.NewClient in init: %v", err)
	}
	log.Println("RemoveAPIKey: Firebase App and Secret Manager Client initialized.")
}

// RemoveAPIKeyGCF is the HTTP Cloud Function for removing a user's API key.
func RemoveAPIKeyGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Assuming POST method for consistency with original Gin router for this action
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

	ctx := context.Background()
	secretID := secrets.SecretNameForUser(userID)
	secretPath := fmt.Sprintf("projects/%s/secrets/%s", gcpProjectIDEnv, secretID)

	deleteReq := &secretmanagerpb.DeleteSecretRequest{
		Name: secretPath,
	}

	if err := secretClientSingleton.DeleteSecret(ctx, deleteReq); err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.NotFound {
			log.Printf("RemoveAPIKeyGCF: Secret %s for user %s not found. Nothing to delete.", secretID, userID)
			httputils.RespondJSON(w, map[string]string{"message": "API key not found, nothing to remove"}, http.StatusOK)
			return
		}
		log.Printf("RemoveAPIKeyGCF: Failed to delete secret %s for user %s: %v", secretID, userID, err)
		httputils.ErrorJSON(w, "Failed to remove API key", http.StatusInternalServerError)
		return
	}

	log.Printf("RemoveAPIKeyGCF: Successfully deleted secret %s for user %s.", secretID, userID)
	httputils.RespondJSON(w, map[string]string{"message": "API key removed successfully"}, http.StatusOK)
}
