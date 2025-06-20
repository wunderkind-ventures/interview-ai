package gateway

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/apigateway"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

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

func CreateGateway(ctx *pulumi.Context, name string, apiId pulumi.StringInput, apiConfigId pulumi.IDInput, project, region string) (*apigateway.Gateway, error) {
	return apigateway.NewGateway(ctx, name, &apigateway.GatewayArgs{
		ApiConfig: apiConfigId.ToIDOutput().ToStringOutput(),
		Project:   pulumi.String(project),
		Region:    pulumi.String(region),
		GatewayId: pulumi.String(name),
	})
}
