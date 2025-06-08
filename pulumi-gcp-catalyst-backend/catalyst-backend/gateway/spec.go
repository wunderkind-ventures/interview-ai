package gateway

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/apigateway"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateApiConfig(
	ctx *pulumi.Context,
	name string,
	apiId pulumi.StringInput,
	openapiSpecPath string,
	triggerUrls []pulumi.StringInput,
	dependsOn pulumi.ResourceArray,
	project string,
) (*apigateway.ApiConfig, error) {
	// Combine function URLs and apply to interpolate the spec file
	openapiContent := pulumi.All(triggerUrls...).ApplyT(func(args []interface{}) (string, error) {
		replacements := make([]string, len(args))
		for i, arg := range args {
			replacements[i] = arg.(string)
		}

		rawBytes, err := os.ReadFile(openapiSpecPath)
		if err != nil {
			return "", fmt.Errorf("error reading OpenAPI spec file: %w", err)
		}
		template := string(rawBytes)

		// Simple template formatting using Sprintf
		spec := fmt.Sprintf(template, convertToInterfaces(replacements)...)
		return base64.StdEncoding.EncodeToString([]byte(spec)), nil
	}).(pulumi.StringOutput)

	return apigateway.NewApiConfig(ctx, name, &apigateway.ApiConfigArgs{
		Api:         apiId,
		Project:     pulumi.String(project),
		DisplayName: pulumi.Sprintf("%s config", name),
		OpenapiDocuments: apigateway.ApiConfigOpenapiDocumentArray{
			&apigateway.ApiConfigOpenapiDocumentArgs{
				Document: &apigateway.ApiConfigOpenapiDocumentDocumentArgs{
					Path:     pulumi.String("openapi-spec.yaml"),
					Contents: openapiContent,
				},
			},
		},
		DependsOn: dependsOn,
	})
}

// helper to convert []string to []interface{} for fmt.Sprintf
func convertToInterfaces(values []string) []interface{} {
	args := make([]interface{}, len(values))
	for i, v := range values {
		args[i] = v
	}
	return args
}
