package getapikeystatus

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"interviewai.wkv.local/getapikeystatus/internal/auth"
	"interviewai.wkv.local/getapikeystatus/internal/httputils"
	"interviewai.wkv.local/getapikeystatus/internal/secrets"

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
	log.Println("GetAPIKeyStatus: Firebase App and Secret Manager Client initialized.")
}

// GetAPIKeyStatusGCF is the HTTP Cloud Function for checking a user's API key status.
func GetAPIKeyStatusGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
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
	secretVersionName := fmt.Sprintf("projects/%s/secrets/%s/versions/latest", gcpProjectIDEnv, secretID)

	getRequest := &secretmanagerpb.GetSecretVersionRequest{
		Name: secretVersionName,
	}

	// We try to get the secret version. If it fails with specific codes, key is not active.
	_, err = secretClientSingleton.GetSecretVersion(ctx, getRequest)
	if err != nil {
		st, ok := status.FromError(err)
		if ok && (st.Code() == codes.NotFound || st.Code() == codes.PermissionDenied || st.Code() == codes.FailedPrecondition) {
			log.Printf("GetAPIKeyStatusGCF: No active API key found for user %s (secret: %s, error code: %s).", userID, secretID, st.Code())
			httputils.RespondJSON(w, map[string]interface{}{"hasKey": false, "status": "No active API key found for user."}, http.StatusOK)
			return
		}
		// Any other error is unexpected
		log.Printf("GetAPIKeyStatusGCF: Error checking secret version %s for user %s: %v", secretVersionName, userID, err)
		httputils.ErrorJSON(w, "Failed to check API key status", http.StatusInternalServerError)
		return
	}

	// If GetSecretVersion succeeds, the 'latest' version exists and is enabled (or AccessSecretVersion would be needed and might fail differently).
	log.Printf("GetAPIKeyStatusGCF: Active API key found for user %s (secret: %s).", userID, secretID)
	httputils.RespondJSON(w, map[string]interface{}{"hasKey": true, "status": "API key is configured for user."}, http.StatusOK)
}
