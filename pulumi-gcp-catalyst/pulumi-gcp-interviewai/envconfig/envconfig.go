package envconfig

import (
	"fmt"

	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// FirebaseConfig holds Firebase configuration from infrastructure stack
type FirebaseConfig struct {
	APIKey            pulumi.StringOutput
	AuthDomain        pulumi.StringOutput
	ProjectID         pulumi.StringOutput
	StorageBucket     pulumi.StringOutput
	MessagingSenderID pulumi.StringOutput
	AppID             pulumi.StringOutput
	MeasurementID     pulumi.StringOutput
	WebClientID       pulumi.StringOutput
	WebClientSecret   pulumi.StringOutput
}

// EnvConfig holds all environment configuration
type EnvConfig struct {
	Environment       string
	BackendURL        pulumi.StringOutput
	Firebase          FirebaseConfig
	DefaultGeminiKey  pulumi.StringInput
	YouTubeAPIKey     pulumi.StringInput
}

// GenerateEnvFile generates the content for .env.local file
func GenerateEnvFile(cfg EnvConfig) pulumi.StringOutput {
	return pulumi.All(
		cfg.BackendURL,
		cfg.Firebase.APIKey,
		cfg.Firebase.AuthDomain,
		cfg.Firebase.ProjectID,
		cfg.Firebase.StorageBucket,
		cfg.Firebase.MessagingSenderID,
		cfg.Firebase.AppID,
		cfg.Firebase.WebClientID,
		cfg.Firebase.WebClientSecret,
		cfg.DefaultGeminiKey,
		cfg.YouTubeAPIKey,
	).ApplyT(func(args []interface{}) string {
		backendURL := args[0].(string)
		firebaseAPIKey := args[1].(string)
		firebaseAuthDomain := args[2].(string)
		firebaseProjectID := args[3].(string)
		firebaseStorageBucket := args[4].(string)
		firebaseMessagingSenderID := args[5].(string)
		firebaseAppID := args[6].(string)
		webClientID := args[7].(string)
		webClientSecret := args[8].(string)
		geminiKey := args[9].(string)
		youtubeKey := args[10].(string)

		return fmt.Sprintf(`NEXT_PUBLIC_GO_BACKEND_URL=%s
NEXT_PUBLIC_FIREBASE_API_KEY=%s
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=%s
NEXT_PUBLIC_FIREBASE_PROJECT_ID=%s
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=%s
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=%s
NEXT_PUBLIC_FIREBASE_APP_ID=%s
GAUTH_WEB_CLIENT_ID=%s
GAUTH_WEB_CLIENT_SECRET=%s
DEFAULT_GEMINI_API_KEY=%s
YOUTUBE_API_KEY=%s`,
			backendURL,
			firebaseAPIKey,
			firebaseAuthDomain,
			firebaseProjectID,
			firebaseStorageBucket,
			firebaseMessagingSenderID,
			firebaseAppID,
			webClientID,
			webClientSecret,
			geminiKey,
			youtubeKey,
		)
	}).(pulumi.StringOutput)
}

// ImportFirebaseConfig imports Firebase configuration from infrastructure stack
func ImportFirebaseConfig(ctx *pulumi.Context) (*FirebaseConfig, error) {
	// Create a stack reference to the infrastructure stack
	infraStack, err := pulumi.NewStackReference(ctx, "wkv/wkv-catalyst-gcp/catalyst-dev", nil)
	if err != nil {
		return nil, err
	}

	// Import Firebase configuration (no environment prefix needed since each stack is single-environment)
	return &FirebaseConfig{
		APIKey:            infraStack.GetStringOutput(pulumi.String("firebase_api_key")),
		AuthDomain:        infraStack.GetStringOutput(pulumi.String("firebase_auth_domain")),
		ProjectID:         infraStack.GetStringOutput(pulumi.String("firebase_project_id")),
		StorageBucket:     infraStack.GetStringOutput(pulumi.String("firebase_storage_bucket")),
		MessagingSenderID: infraStack.GetStringOutput(pulumi.String("firebase_messaging_sender_id")),
		AppID:             infraStack.GetStringOutput(pulumi.String("firebase_app_id")),
		MeasurementID:     infraStack.GetStringOutput(pulumi.String("firebase_measurement_id")),
		WebClientID:       infraStack.GetStringOutput(pulumi.String("firebase_web_client_id")),
		WebClientSecret:   infraStack.GetStringOutput(pulumi.String("firebase_web_client_secret")),
	}, nil
}