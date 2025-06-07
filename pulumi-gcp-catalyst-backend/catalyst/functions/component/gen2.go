package component

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type Gen2FunctionArgs struct {
	Name        string
	EntryPoint  string
	SourcePath  string
	Bucket      *storage.Bucket
	Region      string
	Project     string
	Description string
	EnvVars     pulumi.StringMap
}

type Gen2Function struct {
	pulumi.ResourceState
	Function *cloudfunctionsv2.Function
}

func NewGen2Function(ctx *pulumi.Context, name string, args *Gen2FunctionArgs, opts ...pulumi.ResourceOption) (*Gen2Function, error) {
	component := &Gen2Function{}
	if err := ctx.RegisterComponentResource("catalyst:function:Gen2Function", name, component, opts...); err != nil {
		return nil, err
	}

	archive := pulumi.NewFileArchive(args.SourcePath)
	objectName := fmt.Sprintf("%s-source.zip", args.Name)

	sourceObject, err := storage.NewBucketObject(ctx, objectName, &storage.BucketObjectArgs{
		Bucket: args.Bucket.Name,
		Source: archive,
		Name:   pulumi.String(objectName),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	fn, err := cloudfunctionsv2.NewFunction(ctx, args.Name, &cloudfunctionsv2.FunctionArgs{
		Project:  pulumi.String(args.Project),
		Location: pulumi.String(args.Region),
		BuildConfig: &cloudfunctionsv2.FunctionBuildConfigArgs{
			Runtime:    pulumi.String("go122"),
			EntryPoint: pulumi.String(args.EntryPoint),
			Source: &cloudfunctionsv2.FunctionBuildConfigSourceArgs{
				StorageSource: &cloudfunctionsv2.FunctionBuildConfigSourceStorageSourceArgs{
					Bucket: args.Bucket.Name,
					Object: sourceObject.Name,
				},
			},
			EnvironmentVariables: args.EnvVars,
		},
		ServiceConfig: &cloudfunctionsv2.FunctionServiceConfigArgs{
			MaxInstanceCount: pulumi.Int(2),
			MinInstanceCount: pulumi.Int(0),
			AvailableMemory:  pulumi.String("256MiB"),
			TimeoutSeconds:   pulumi.Int(60),
			IngressSettings:  pulumi.String("ALLOW_ALL"),
		},
		Description: pulumi.String(args.Description),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	_, err = cloudfunctionsv2.NewFunctionIamMember(ctx, args.Name+"-invoker", &cloudfunctionsv2.FunctionIamMemberArgs{
		Project:       fn.Project,
		Location:      fn.Location,
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
