package project

import (
	"fmt"
	"catalyst-backend/config"
	
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/organizations"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// ProjectResources contains all project-level resources
type ProjectResources struct {
	Project        *organizations.Project
	BillingAccount *projects.BillingAccountAssociation
}

// CreateProject creates a new GCP project if it doesn't exist
func CreateProject(ctx *pulumi.Context, cfg *config.CatalystConfig, orgID, billingAccountID string) (*ProjectResources, error) {
	// Create the project
	project, err := organizations.NewProject(ctx, fmt.Sprintf("interviewai-%s", cfg.Environment), &organizations.ProjectArgs{
		ProjectId:      pulumi.String(cfg.GcpProject),
		Name:           pulumi.Sprintf("Interview AI %s", cfg.Environment),
		OrgId:          pulumi.String(orgID),
		BillingAccount: pulumi.String(billingAccountID),
		Labels: pulumi.StringMap{
			"environment": pulumi.String(cfg.Environment),
			"managed-by":  pulumi.String("pulumi"),
			"application": pulumi.String("interview-ai"),
		},
		AutoCreateNetwork: pulumi.Bool(false), // Don't create default VPC
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	// Associate billing account
	billing, err := projects.NewBillingAccountAssociation(ctx, 
		fmt.Sprintf("billing-%s", cfg.Environment), 
		&projects.BillingAccountAssociationArgs{
			ProjectId:      project.ProjectId,
			BillingAccount: pulumi.String(billingAccountID),
		})
	if err != nil {
		return nil, fmt.Errorf("failed to associate billing account: %w", err)
	}

	return &ProjectResources{
		Project:        project,
		BillingAccount: billing,
	}, nil
}

// EnableFirebase adds Firebase to an existing GCP project
// Note: This requires additional setup as Firebase API doesn't support
// full automation. Manual steps will still be needed in Firebase Console.
func EnableFirebase(ctx *pulumi.Context, projectID pulumi.StringOutput) error {
	// Firebase project creation is not fully supported via Pulumi
	// This would need to be done via Firebase Management API
	// or manually in the Firebase Console
	
	ctx.Export("firebaseSetupRequired", pulumi.String(
		"Please visit https://console.firebase.google.com and add this project to Firebase",
	))
	
	return nil
}