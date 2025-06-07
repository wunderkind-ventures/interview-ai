package iam

import (
	"fmt"

	"pulumi_modular_scaffold/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/projects"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateFunctionServiceAccount(ctx *pulumi.Context, cfg *config.CatalystConfig) (*serviceaccount.Account, error) {
	saName := fmt.Sprintf("catalyst-functions-sa-%s", cfg.Environment)

	sa, err := serviceaccount.NewAccount(ctx, saName, &serviceaccount.AccountArgs{
		AccountId:   pulumi.String(saName),
		DisplayName: pulumi.Sprintf("Service Account for Catalyst Cloud Functions (%s)", cfg.Environment),
		Project:     pulumi.String(cfg.GcpProject),
	})
	if err != nil {
		return nil, err
	}

	roles := []string{
		"roles/secretmanager.secretAccessor",
		"roles/secretmanager.admin",
		"roles/secretmanager.secretVersionManager",
	}

	for _, role := range roles {
		_, err = projects.NewIAMMember(ctx, fmt.Sprintf("%s-%s", saName, role), &projects.IAMMemberArgs{
			Project: pulumi.String(cfg.GcpProject),
			Role:    pulumi.String(role),
			Member:  pulumi.Sprintf("serviceAccount:%s", sa.Email),
		})
		if err != nil {
			return nil, err
		}
	}

	return sa, nil
}
