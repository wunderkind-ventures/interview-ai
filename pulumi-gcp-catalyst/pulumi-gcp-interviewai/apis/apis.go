package apis

import (
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// EnableRequiredAPIs enables all required Google Cloud APIs for the project
func EnableRequiredAPIs(ctx *pulumi.Context, project string, environment string) error {
	// List of APIs required for Interview AI
	requiredAPIs := []string{
		"cloudfunctions.googleapis.com",
		"cloudbuild.googleapis.com",
		"run.googleapis.com",
		"secretmanager.googleapis.com",
		"firebase.googleapis.com",
		"firebasehosting.googleapis.com",
		"firestore.googleapis.com",
		"pubsub.googleapis.com",
		"storage.googleapis.com",
		"apigateway.googleapis.com",
		"servicecontrol.googleapis.com",
		"servicemanagement.googleapis.com",
		"logging.googleapis.com",
		"monitoring.googleapis.com",
		"cloudtrace.googleapis.com",
		"aiplatform.googleapis.com",
		"generativelanguage.googleapis.com", // Gemini API
	}

	// Enable each API
	for _, api := range requiredAPIs {
		_, err := projects.NewService(ctx, api+"-"+environment, &projects.ServiceArgs{
			Project: pulumi.String(project),
			Service: pulumi.String(api),
			// Disable dependent services on destroy to avoid issues
			DisableDependentServices: pulumi.Bool(true),
			// Don't disable the service on destroy to avoid breaking other resources
			DisableOnDestroy: pulumi.Bool(false),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
