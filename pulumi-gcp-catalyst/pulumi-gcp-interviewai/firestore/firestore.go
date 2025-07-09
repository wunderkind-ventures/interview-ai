package firestore

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/firestore"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// CreateFirestoreDatabase creates a Firestore database for the project
func CreateFirestoreDatabase(ctx *pulumi.Context, project string, region string) (*firestore.Database, error) {
	// Create Firestore database (Native mode)
	database, err := firestore.NewDatabase(ctx, "firestore-database", &firestore.DatabaseArgs{
		Name:                     pulumi.String("(default)"),
		LocationId:               pulumi.String(region),
		Type:                     pulumi.String("FIRESTORE_NATIVE"),
		Project:                  pulumi.String(project),
		ConcurrencyMode:          pulumi.String("OPTIMISTIC"),
		AppEngineIntegrationMode: pulumi.String("DISABLED"),
		PointInTimeRecoveryEnablement: pulumi.String("POINT_IN_TIME_RECOVERY_DISABLED"),
	})
	if err != nil {
		return nil, fmt.Errorf("error creating Firestore database: %w", err)
	}

	// Export database information
	ctx.Export("firestoreDatabase", database.Name)
	ctx.Export("firestoreLocation", database.LocationId)

	return database, nil
}

// CreateFirestoreIndexes creates composite indexes for better query performance
func CreateFirestoreIndexes(ctx *pulumi.Context, project string, database *firestore.Database) error {
	// Index for interviews collection - sort by userId and createdAt
	_, err := firestore.NewIndex(ctx, "interviews-user-created-index", &firestore.IndexArgs{
		Collection: pulumi.String("interviews"),
		Database:   database.Name,
		Project:    pulumi.String(project),
		Fields: firestore.IndexFieldArray{
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("userId"),
				Order:     pulumi.String("ASCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("createdAt"),
				Order:     pulumi.String("DESCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("__name__"),
				Order:     pulumi.String("DESCENDING"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("error creating interviews index: %w", err)
	}

	// Index for achievements collection
	_, err = firestore.NewIndex(ctx, "achievements-user-created-index", &firestore.IndexArgs{
		Collection: pulumi.String("achievements"),
		Database:   database.Name,
		Project:    pulumi.String(project),
		Fields: firestore.IndexFieldArray{
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("userId"),
				Order:     pulumi.String("ASCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("createdAt"),
				Order:     pulumi.String("DESCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("__name__"),
				Order:     pulumi.String("DESCENDING"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("error creating achievements index: %w", err)
	}

	// Index for sharedAssessments - public assessments sorted by date
	_, err = firestore.NewIndex(ctx, "assessments-public-created-index", &firestore.IndexArgs{
		Collection: pulumi.String("sharedAssessments"),
		Database:   database.Name,
		Project:    pulumi.String(project),
		Fields: firestore.IndexFieldArray{
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("isPublic"),
				Order:     pulumi.String("ASCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("createdAt"),
				Order:     pulumi.String("DESCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("__name__"),
				Order:     pulumi.String("DESCENDING"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("error creating shared assessments index: %w", err)
	}

	// Index for resumes collection
	_, err = firestore.NewIndex(ctx, "resumes-user-updated-index", &firestore.IndexArgs{
		Collection: pulumi.String("resumes"),
		Database:   database.Name,
		Project:    pulumi.String(project),
		Fields: firestore.IndexFieldArray{
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("userId"),
				Order:     pulumi.String("ASCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("updatedAt"),
				Order:     pulumi.String("DESCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("__name__"),
				Order:     pulumi.String("DESCENDING"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("error creating resumes index: %w", err)
	}

	// Index for jobDescriptions collection
	_, err = firestore.NewIndex(ctx, "jobdescriptions-user-updated-index", &firestore.IndexArgs{
		Collection: pulumi.String("jobDescriptions"),
		Database:   database.Name,
		Project:    pulumi.String(project),
		Fields: firestore.IndexFieldArray{
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("userId"),
				Order:     pulumi.String("ASCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("updatedAt"),
				Order:     pulumi.String("DESCENDING"),
			},
			&firestore.IndexFieldArgs{
				FieldPath: pulumi.String("__name__"),
				Order:     pulumi.String("DESCENDING"),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("error creating job descriptions index: %w", err)
	}

	return nil
}

// CreateBackupSchedule creates a daily backup schedule for Firestore
func CreateBackupSchedule(ctx *pulumi.Context, project string, database *firestore.Database) error {
	// Note: Firestore backup schedules require additional configuration
	// This is a placeholder for when backup functionality is needed
	
	ctx.Export("firestoreBackupNote", pulumi.String("Firestore backups should be configured via Firebase Console or gcloud CLI"))
	
	return nil
}