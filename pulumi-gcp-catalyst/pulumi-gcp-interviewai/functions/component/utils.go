package component

import (
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudrun"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// convertEnvVars converts pulumi.StringMap to Cloud Run environment variable format
func convertEnvVars(envVars pulumi.StringMap) cloudrun.ServiceTemplateSpecContainerEnvArray {
	if envVars == nil {
		return cloudrun.ServiceTemplateSpecContainerEnvArray{}
	}

	var envs cloudrun.ServiceTemplateSpecContainerEnvArray
	for key, value := range envVars {
		envs = append(envs, &cloudrun.ServiceTemplateSpecContainerEnvArgs{
			Name:  pulumi.String(key),
			Value: value,
		})
	}
	return envs
}
