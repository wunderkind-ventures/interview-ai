package firebase

import (
	"fmt"

	firebase "github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/firebase"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/firestore"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/identityplatform"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// FirebaseConfig holds the configuration for Firebase setup
type FirebaseConfig struct {
	ProjectID   string
	Environment string
}

// FirebaseOutputs contains the Firebase configuration values to export
type FirebaseOutputs struct {
	APIKey               pulumi.StringOutput
	AuthDomain           pulumi.StringOutput
	ProjectID            pulumi.StringOutput
	StorageBucket        pulumi.StringOutput
	MessagingSenderID    pulumi.StringOutput
	AppID                pulumi.StringOutput
	MeasurementID        pulumi.StringOutput
	WebClientID          pulumi.StringOutput
	WebClientSecret      pulumi.StringOutput
}

// SetupFirebase initializes Firebase for a project
func SetupFirebase(ctx *pulumi.Context, cfg FirebaseConfig) (*FirebaseOutputs, error) {
	// Enable Firebase on the project
	firebaseProject, err := firebase.NewProject(ctx, fmt.Sprintf("%s-firebase-project", cfg.Environment), &firebase.ProjectArgs{
		Project: pulumi.String(cfg.ProjectID),
	})
	if err != nil {
		return nil, err
	}

	// Create a Firebase Web App
	webApp, err := firebase.NewWebApp(ctx, fmt.Sprintf("%s-firebase-webapp", cfg.Environment), &firebase.WebAppArgs{
		Project:     firebaseProject.Project,
		DisplayName: pulumi.String(fmt.Sprintf("InterviewAI %s Web App", cfg.Environment)),
		DeletionPolicy: pulumi.String("DELETE"),
	}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		return nil, err
	}

	// Configure Authentication
	authConfig, err := identityplatform.NewConfig(ctx, fmt.Sprintf("%s-auth-config", cfg.Environment), &identityplatform.ConfigArgs{
		Project: pulumi.String(cfg.ProjectID),
		SignIn: &identityplatform.ConfigSignInArgs{
			Email: &identityplatform.ConfigSignInEmailArgs{
				Enabled:          pulumi.Bool(true),
				PasswordRequired: pulumi.Bool(true),
			},
			Anonymous: &identityplatform.ConfigSignInAnonymousArgs{
				Enabled: pulumi.Bool(false),
			},
		},
		AuthorizedDomains: pulumi.StringArray{
			pulumi.String("localhost"),
			pulumi.String("localhost:9002"),
			pulumi.String(fmt.Sprintf("%s.firebaseapp.com", cfg.ProjectID)),
			pulumi.String(fmt.Sprintf("%s.web.app", cfg.ProjectID)),
			pulumi.String("interview-ai.ngrok.app"),
			pulumi.String("settled-merry-jaguar.ngrok-free.app"),
		},
	}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		return nil, err
	}

	// Enable Google Sign-In provider
	googleProvider, err := identityplatform.NewDefaultSupportedIdpConfig(ctx, fmt.Sprintf("%s-google-provider", cfg.Environment), &identityplatform.DefaultSupportedIdpConfigArgs{
		Project:   pulumi.String(cfg.ProjectID),
		IdpId:     pulumi.String("google.com"),
		Enabled:   pulumi.Bool(true),
		ClientId:  webApp.AppId,
		ClientSecret: pulumi.String(""), // Will be filled manually or via secret
	}, pulumi.DependsOn([]pulumi.Resource{authConfig}))
	if err != nil {
		return nil, err
	}

	// Create Firestore database
	_, err = firestore.NewDatabase(ctx, fmt.Sprintf("%s-firestore", cfg.Environment), &firestore.DatabaseArgs{
		Project:    pulumi.String(cfg.ProjectID),
		Name:       pulumi.String("(default)"),
		LocationId: pulumi.String("us-central1"),
		Type:       pulumi.String("FIRESTORE_NATIVE"),
	}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		return nil, err
	}

	// Create Storage bucket
	storageBucket, err := firebase.NewStorageBucket(ctx, fmt.Sprintf("%s-storage", cfg.Environment), &firebase.StorageBucketArgs{
		Project:  pulumi.String(cfg.ProjectID),
		BucketId: pulumi.String(fmt.Sprintf("%s.appspot.com", cfg.ProjectID)),
	}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		return nil, err
	}

	// Return the Firebase configuration
	// Note: Some fields need to be fetched from the Firebase console or via API
	// as they're not directly exposed by the Pulumi provider
	return &FirebaseOutputs{
		APIKey:            pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		AuthDomain:        pulumi.Sprintf("%s.firebaseapp.com", cfg.ProjectID),
		ProjectID:         pulumi.Sprintf("%s", cfg.ProjectID),
		StorageBucket:     storageBucket.Name,
		MessagingSenderID: pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		AppID:             webApp.AppId,
		MeasurementID:     pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		WebClientID:       googleProvider.ClientId,
		WebClientSecret:   googleProvider.ClientSecret,
	}, nil
}