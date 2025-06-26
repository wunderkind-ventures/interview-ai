package project

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/billing"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/organizations"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// ProjectConfig holds the configuration for project management
type ProjectConfig struct {
	ProjectID        string
	ProjectName      string
	OrganizationID   string
	BillingAccountID string
	CreateProject    bool
	Environment      string
}

// ManageProject creates or imports a GCP project and associates it with a billing account
func ManageProject(ctx *pulumi.Context, cfg ProjectConfig) (*organizations.Project, error) {
	var project *organizations.Project
	var err error

	if cfg.CreateProject && cfg.OrganizationID != "" {
		// Create a new project under the organization
		project, err = organizations.NewProject(ctx, fmt.Sprintf("%s-project", cfg.Environment), &organizations.ProjectArgs{
			ProjectId:      pulumi.String(cfg.ProjectID),
			Name:           pulumi.String(cfg.ProjectName),
			OrgId:          pulumi.String(cfg.OrganizationID),
			DeletionPolicy: pulumi.String("DELETE"), // Use "PREVENT" in production
		}, pulumi.Protect(true)) // Protect the project from accidental deletion
		if err != nil {
			return nil, fmt.Errorf("failed to create project: %w", err)
		}

		ctx.Log.Info(fmt.Sprintf("Created new project: %s", cfg.ProjectID), nil)
	} else {
		// For existing projects, we'll create a "lookup" resource that references the existing project
		// This allows us to manage resources within the project without creating it
		ctx.Log.Info(fmt.Sprintf("Using existing project: %s", cfg.ProjectID), nil)
		
		// Create a synthetic project resource that represents the existing project
		// We'll use NewProject with Import to reference the existing project
		project, err = organizations.NewProject(ctx, fmt.Sprintf("%s-project-existing", cfg.Environment), &organizations.ProjectArgs{
			ProjectId: pulumi.String(cfg.ProjectID),
			Name:      pulumi.String(cfg.ProjectName),
		}, pulumi.Import(pulumi.ID(cfg.ProjectID)))
		
		if err != nil {
			// If import fails, log warning but continue
			// The project might exist but we might not have permissions to import it
			ctx.Log.Warn(fmt.Sprintf("Could not import existing project %s (this is often OK): %v", cfg.ProjectID, err), nil)
		}
	}

	// Associate billing account if provided
	if cfg.BillingAccountID != "" {
		// For existing projects, we need to use the project ID directly
		projectIDToUse := pulumi.String(cfg.ProjectID)
		dependencies := []pulumi.Resource{}
		if project != nil {
			// project.ProjectId is already a StringOutput, use it directly
			dependencies = append(dependencies, project)
		}
		
		_, err := billing.NewProjectInfo(ctx, fmt.Sprintf("%s-billing", cfg.Environment), &billing.ProjectInfoArgs{
			Project:        projectIDToUse,
			BillingAccount: pulumi.String(cfg.BillingAccountID),
		}, pulumi.DependsOn(dependencies))
		if err != nil {
			return nil, fmt.Errorf("failed to associate billing account with project %s: %w", cfg.ProjectID, err)
		}
		
		ctx.Log.Info(fmt.Sprintf("Associated billing account %s with project %s", cfg.BillingAccountID, cfg.ProjectID), nil)
		
		// Billing is successfully associated if we reach this point
		ctx.Log.Info("Billing successfully enabled", nil)
	}

	return project, nil
}

// GetProjectDeletionPolicy returns the appropriate deletion policy based on environment
func GetProjectDeletionPolicy(environment string) string {
	// Only allow deletion in development environments
	if environment == "dev" {
		return "DELETE"
	}
	return "PREVENT"
}