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
func SetupFirebase(ctx *pulumi.Context, cfg FirebaseConfig, dependencies []pulumi.Resource) (*FirebaseOutputs, error) {
	// Enable Firebase on the project
	firebaseProject, err := firebase.NewProject(ctx, fmt.Sprintf("%s-firebase-project", cfg.Environment), &firebase.ProjectArgs{
		Project: pulumi.String(cfg.ProjectID),
	})
	if err != nil {
		return nil, err
	}

	// Wait for Firebase project to be fully initialized
	ctx.Export("firebase-project-init", firebaseProject.Project)
	
	// Create a Firebase Web App
	webApp, err := firebase.NewWebApp(ctx, fmt.Sprintf("%s-firebase-webapp", cfg.Environment), &firebase.WebAppArgs{
		Project:     firebaseProject.Project,
		DisplayName: pulumi.String(fmt.Sprintf("InterviewAI %s Web App", cfg.Environment)),
		DeletionPolicy: pulumi.String("DELETE"),
	}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		return nil, err
	}

	// Configure Authentication - try to import existing config first
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
			pulumi.String(fmt.Sprintf("%s.firebaseapp.com", cfg.ProjectID)),
			pulumi.String(fmt.Sprintf("%s.web.app", cfg.ProjectID)),
			pulumi.String("interview-ai.ngrok.app"),
			pulumi.String("settled-merry-jaguar.ngrok-free.app"),
		},
	}, pulumi.Import(pulumi.ID(fmt.Sprintf("projects/%s/config", cfg.ProjectID))), pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		// If import fails, try creating new one
		ctx.Log.Warn(fmt.Sprintf("Could not import Identity Platform config, trying to create new: %v", err), nil)
		authConfig, err = identityplatform.NewConfig(ctx, fmt.Sprintf("%s-auth-config", cfg.Environment), &identityplatform.ConfigArgs{
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
				pulumi.String(fmt.Sprintf("%s.firebaseapp.com", cfg.ProjectID)),
				pulumi.String(fmt.Sprintf("%s.web.app", cfg.ProjectID)),
				pulumi.String("interview-ai.ngrok.app"),
				pulumi.String("settled-merry-jaguar.ngrok-free.app"),
			},
		}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
		if err != nil {
			return nil, err
		}
	}

	// Export auth config status
	ctx.Export("auth-config-ready", authConfig.ID())

	// Enable Google Sign-In provider
	// Note: Client secret must be configured manually in Firebase Console
	// googleProvider, err := identityplatform.NewDefaultSupportedIdpConfig(ctx, fmt.Sprintf("%s-google-provider", cfg.Environment), &identityplatform.DefaultSupportedIdpConfigArgs{
	// 	Project:   pulumi.String(cfg.ProjectID),
	// 	IdpId:     pulumi.String("google.com"),
	// 	Enabled:   pulumi.Bool(true),
	// 	ClientId:  webApp.AppId,
	// 	ClientSecret: pulumi.String(""), // Will be filled manually or via secret
	// }, pulumi.DependsOn([]pulumi.Resource{authConfig}))
	// if err != nil {
	// 	return nil, err
	// }

	// Create or import Firestore database
	// Try to import existing database first
	firestoreDB, err := firestore.NewDatabase(ctx, fmt.Sprintf("%s-firestore", cfg.Environment), &firestore.DatabaseArgs{
		Project:    pulumi.String(cfg.ProjectID),
		Name:       pulumi.String("(default)"),
		LocationId: pulumi.String("us-central1"),
		Type:       pulumi.String("FIRESTORE_NATIVE"),
	}, pulumi.Import(pulumi.ID(fmt.Sprintf("projects/%s/databases/(default)", cfg.ProjectID))), pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
	if err != nil {
		// If import fails, try creating new one
		ctx.Log.Warn(fmt.Sprintf("Could not import Firestore database, trying to create new: %v", err), nil)
		firestoreDB, err = firestore.NewDatabase(ctx, fmt.Sprintf("%s-firestore", cfg.Environment), &firestore.DatabaseArgs{
			Project:    pulumi.String(cfg.ProjectID),
			Name:       pulumi.String("(default)"),
			LocationId: pulumi.String("us-central1"),
			Type:       pulumi.String("FIRESTORE_NATIVE"),
		}, pulumi.DependsOn([]pulumi.Resource{firebaseProject}))
		if err != nil {
			return nil, err
		}
	}

	// Create Storage bucket with Firestore dependency
	storageDeps := []pulumi.Resource{firebaseProject, webApp, firestoreDB}
	storageDeps = append(storageDeps, dependencies...)
	
	// Skip storage bucket creation for now - needs to be done manually in Firebase Console
	ctx.Log.Info("Firebase Storage bucket creation skipped - please create manually in Firebase Console", nil)
	storageBucketName := pulumi.Sprintf("%s.appspot.com", cfg.ProjectID)

	// Return the Firebase configuration
	// Note: Some fields need to be fetched from the Firebase console or via API
	// as they're not directly exposed by the Pulumi provider
	return &FirebaseOutputs{
		APIKey:            pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		AuthDomain:        pulumi.Sprintf("%s.firebaseapp.com", cfg.ProjectID),
		ProjectID:         pulumi.Sprintf("%s", cfg.ProjectID),
		StorageBucket:     storageBucketName,
		MessagingSenderID: pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		AppID:             webApp.AppId,
		MeasurementID:     pulumi.String("").ToStringOutput(), // This needs to be set from Firebase console
		WebClientID:       webApp.AppId, // Using App ID as placeholder
		WebClientSecret:   pulumi.String("").ToStringOutput(), // Will be configured manually
	}, nil
}