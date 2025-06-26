package project

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// EnableAPIs enables a list of APIs for a given project
func EnableAPIs(ctx *pulumi.Context, projectID string, apis []string) error {
	// List of restricted APIs that should be skipped
	restrictedAPIs := map[string]bool{
		"source.googleapis.com":                  true,
		"dataproc-control.googleapis.com":        true,
		"stackdriverprovisioning.googleapis.com": true,
		"bigquery-json.googleapis.com":           true,
	}

	failedAPIs := []string{}

	for _, api := range apis {
		// Skip restricted APIs
		if restrictedAPIs[api] {
			ctx.Log.Info(fmt.Sprintf("Skipping restricted API: %s", api), nil)
			continue
		}

		_, err := projects.NewService(ctx, fmt.Sprintf("%s-%s", projectID, api), &projects.ServiceArgs{
			Project: pulumi.String(projectID),
			Service: pulumi.String(api),
		})
		if err != nil {
			// Log the error but continue with other APIs
			ctx.Log.Warn(fmt.Sprintf("Failed to enable API %s: %v", api, err), nil)
			failedAPIs = append(failedAPIs, api)
			// Continue instead of returning error
			continue
		}
	}

	// Only return error if critical APIs failed
	if len(failedAPIs) > 0 {
		criticalAPIs := []string{
			"cloudfunctions.googleapis.com",
			"firebase.googleapis.com",
			"firestore.googleapis.com",
			"secretmanager.googleapis.com",
			"apigateway.googleapis.com",
		}

		for _, failed := range failedAPIs {
			for _, critical := range criticalAPIs {
				if failed == critical {
					return fmt.Errorf("failed to enable critical API: %s", failed)
				}
			}
		}

		// Log non-critical failures
		ctx.Log.Info(fmt.Sprintf("Some non-critical APIs failed to enable: %v", failedAPIs), nil)
	}

	return nil
}

// GetCoreAPIs returns the list of core APIs needed for the InterviewAI platform
func GetCoreAPIs() []string {
	return []string{
		"aiplatform.googleapis.com",
		"analyticshub.googleapis.com",
		"apigateway.googleapis.com",
		"appengine.googleapis.com",
		"artifactregistry.googleapis.com",
		"bigquery.googleapis.com",
		"bigqueryconnection.googleapis.com",
		"bigquerydatapolicy.googleapis.com",
		"bigquerymigration.googleapis.com",
		"bigqueryreservation.googleapis.com",
		"bigquerystorage.googleapis.com",
		"blockchain.googleapis.com",
		"cloudbilling.googleapis.com",
		"cloudaicompanion.googleapis.com",
		"cloudapis.googleapis.com",
		"cloudasset.googleapis.com",
		"cloudbuild.googleapis.com",
		"cloudfunctions.googleapis.com",
		"cloudkms.googleapis.com",
		"cloudresourcemanager.googleapis.com",
		"cloudscheduler.googleapis.com",
		"cloudtrace.googleapis.com",
		"compute.googleapis.com",
		"containerregistry.googleapis.com",
		"dataform.googleapis.com",
		"dataplex.googleapis.com",
		"datastore.googleapis.com",
		"deploymentmanager.googleapis.com",
		"developerconnect.googleapis.com",
		"eventarc.googleapis.com",
		"eventarcpublishing.googleapis.com",
		"fcm.googleapis.com",
		"fcmregistrations.googleapis.com",
		"firebase.googleapis.com",
		"firebaseappcheck.googleapis.com",
		"firebaseappdistribution.googleapis.com",
		"firebaseapphosting.googleapis.com",
		"firebasedynamiclinks.googleapis.com",
		"firebaseextensions.googleapis.com",
		"firebasehosting.googleapis.com",
		"firebaseinstallations.googleapis.com",
		"firebaseml.googleapis.com",
		"firebaseremoteconfig.googleapis.com",
		"firebaseremoteconfigrealtime.googleapis.com",
		"firebaserules.googleapis.com",
		"firebasestorage.googleapis.com",
		"firebasevertexai.googleapis.com",
		"firestore.googleapis.com",
		"geminicloudassist.googleapis.com",
		"generativelanguage.googleapis.com",
		"iam.googleapis.com",
		"iamcredentials.googleapis.com",
		"identitytoolkit.googleapis.com",
		"logging.googleapis.com",
		"mlkit.googleapis.com",
		"monitoring.googleapis.com",
		"oslogin.googleapis.com",
		"pubsub.googleapis.com",
		"recaptchaenterprise.googleapis.com",
		"recommender.googleapis.com",
		"run.googleapis.com",
		"runtimeconfig.googleapis.com",
		"secretmanager.googleapis.com",
		"securetoken.googleapis.com",
		"servicemanagement.googleapis.com",
		"serviceusage.googleapis.com",
		// "source.googleapis.com", // Restricted API - auto-enabled when needed
		"speech.googleapis.com",
		"sql-component.googleapis.com",
		"storage-api.googleapis.com",
		"storage-component.googleapis.com",
		"storage.googleapis.com",
		"testing.googleapis.com",
		"vision.googleapis.com",
		"youtube.googleapis.com",
	}
}
