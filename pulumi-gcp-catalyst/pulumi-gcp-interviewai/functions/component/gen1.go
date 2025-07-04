package component

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctions"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
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
	Runtime        string // Optional: defaults to "go121" if not specified
	MemoryMb       int    // Optional: defaults to 256 if not specified
}

type Gen1Function struct {
	pulumi.ResourceState
	Function *cloudfunctions.Function
}

func NewGen1Function(ctx *pulumi.Context, name string, args *Gen1FunctionArgs, opts ...pulumi.ResourceOption) (*Gen1Function, error) {
	component := &Gen1Function{}
	if err := ctx.RegisterComponentResource("catalyst:function:Gen1Function", name, component, opts...); err != nil {
		return nil, err
	}

	archive := pulumi.NewFileArchive(args.SourcePath)
	sourceObjectName := fmt.Sprintf("%s-source.zip", args.Name)

	sourceObject, err := storage.NewBucketObject(ctx, sourceObjectName, &storage.BucketObjectArgs{
		Bucket: args.BucketName,
		Name:   pulumi.String(sourceObjectName),
		Source: archive,
	})
	if err != nil {
		return nil, err
	}

	// Use provided runtime or default to go121
	runtime := args.Runtime
	if runtime == "" {
		runtime = "go121"
	}

	// Use provided memory or default to 256MB
	memoryMb := args.MemoryMb
	if memoryMb == 0 {
		memoryMb = 256
	}

	fn, err := cloudfunctions.NewFunction(ctx, args.Name, &cloudfunctions.FunctionArgs{
		Name:                 pulumi.String(args.Name),
		EntryPoint:           pulumi.String(args.EntryPoint),
		Runtime:              pulumi.String(runtime),
		AvailableMemoryMb:    pulumi.Int(memoryMb),
		SourceArchiveBucket:  args.BucketName,
		SourceArchiveObject:  sourceObject.Name,
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
