package gateway

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/apigateway"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// CreateApi defines the API Gateway API resource (not the config).
func CreateApi(ctx *pulumi.Context, name string, project string, environment string) (*apigateway.Api, error) {
	apiName := fmt.Sprintf("%s-%s", name, environment)

	api, err := apigateway.NewApi(ctx, apiName, &apigateway.ApiArgs{
		ApiId:   pulumi.String(apiName),
		Project: pulumi.String(project),
	})
	if err != nil {
		return nil, err
	}

	return api, nil
}
