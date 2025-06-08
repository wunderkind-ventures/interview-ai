package component

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctions"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type Gen1FunctionArgs struct {
	Name           string
	EntryPoint     string
	BucketName     pulumi.StringInput
	SourcePath     string
	Region         string
	Project        string
	ServiceAccount pulumi.StringInput
	EnvVars        pulumi.StringMap
}

type Gen1Function struct {
	pulumi.ResourceState
	Function *cloudfunctions.Function
}

func NewGen1Function(ctx *pulumi.Context, name string, args *Gen1FunctionArgs, opts ...pulumi.ResourceOption) (*Gen1Function, error) {
	component := &Gen1Function{}
	err := ctx.RegisterComponentResource("catalyst:function:Gen1Function", name, component, opts...)
	if err != nil {
		return nil, err
	}

	archive := pulumi.NewFileArchive(args.SourcePath)
	sourceObjectName := fmt.Sprintf("%s-source.zip", args.Name)

	sourceObject, err := cloudfunctions.NewFunctionSourceArchive(ctx, sourceObjectName, &cloudfunctions.FunctionSourceArchiveArgs{
		Bucket: args.BucketName,
		Object: pulumi.String(sourceObjectName),
		Source: archive,
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	fn, err := cloudfunctions.NewFunction(ctx, args.Name, &cloudfunctions.FunctionArgs{
		Name:                 pulumi.String(args.Name),
		EntryPoint:           pulumi.String(args.EntryPoint),
		Runtime:              pulumi.String("go121"),
		AvailableMemoryMb:    pulumi.Int(256),
		SourceArchiveBucket:  args.BucketName,
		SourceArchiveObject:  sourceObject.Object,
		TriggerHttp:          pulumi.Bool(true),
		Project:              pulumi.String(args.Project),
		Region:               pulumi.String(args.Region),
		ServiceAccountEmail:  args.ServiceAccount,
		EnvironmentVariables: args.EnvVars,
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	_, err = cloudfunctions.NewFunctionIamMember(ctx, args.Name+"-invoker", &cloudfunctions.FunctionIamMemberArgs{
		Project:       pulumi.String(args.Project),
		Region:        pulumi.String(args.Region),
		CloudFunction: fn.Name,
		Role:          pulumi.String("roles/cloudfunctions.invoker"),
		Member:        pulumi.String("allUsers"),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	component.Function = fn
	return component, nil
}

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
