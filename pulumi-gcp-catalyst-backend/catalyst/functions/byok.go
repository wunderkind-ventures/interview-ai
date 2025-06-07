package functions

import (
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctions"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateCloudFunction(ctx *pulumi.Context, name, entryPoint, bucketName, sourcePath, region, project string, saEmail pulumi.StringInput, envVars pulumi.StringMap) (*cloudfunctions.Function, error) {
	archive := pulumi.NewFileArchive(sourcePath)

	sourceObject, err := cloudfunctions.NewFunctionSourceArchive(ctx, name+"-source", &cloudfunctions.FunctionSourceArchiveArgs{
		Bucket: pulumi.String(bucketName),
		Object: pulumi.String(name + "-source.zip"),
		Source: archive,
	})
	if err != nil {
		return nil, err
	}

	fnArgs := &cloudfunctions.FunctionArgs{
		Name:                 pulumi.String(name),
		EntryPoint:           pulumi.String(entryPoint),
		Runtime:              pulumi.String("go121"),
		AvailableMemoryMb:    pulumi.Int(256),
		SourceArchiveBucket:  pulumi.String(bucketName),
		SourceArchiveObject:  sourceObject.Object,
		TriggerHttp:          pulumi.Bool(true),
		Project:              pulumi.String(project),
		Region:               pulumi.String(region),
		ServiceAccountEmail:  saEmail,
		EnvironmentVariables: envVars,
	}

	function, err := cloudfunctions.NewFunction(ctx, name, fnArgs)
	if err != nil {
		return nil, err
	}

	_, err = cloudfunctions.NewFunctionIamMember(ctx, name+"-invoker", &cloudfunctions.FunctionIamMemberArgs{
		Project:       pulumi.String(project),
		Region:        pulumi.String(region),
		CloudFunction: function.Name,
		Role:          pulumi.String("roles/cloudfunctions.invoker"),
		Member:        pulumi.String("allUsers"),
	})

	return function, err
}
