package component

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudrun"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

// DeploymentType represents the deployment platform choice
type DeploymentType string

const (
	DeploymentTypeFunction DeploymentType = "function"
	DeploymentTypeCloudRun DeploymentType = "cloudrun"
)

// HybridServiceArgs provides arguments for creating either a Cloud Function or Cloud Run service
type HybridServiceArgs struct {
	Name           string
	DeploymentType DeploymentType

	// Common fields
	Project        string
	Region         string
	ServiceAccount pulumi.StringOutput
	EnvVars        pulumi.StringMap
	Description    string

	// Function-specific fields
	SourcePath string
	EntryPoint string
	Runtime    string          // e.g., "python311", "go122"
	Bucket     *storage.Bucket // Required for functions

	// Cloud Run-specific fields
	ContainerImage string // e.g., "gcr.io/project/image:tag"
	Port           int    // Default: 8080
	Memory         string // e.g., "512Mi", "1Gi"
	CPU            string // e.g., "1", "2"
	MinInstances   int    // Default: 0
	MaxInstances   int    // Default: 100

	// Function configuration
	FunctionMemory  string // e.g., "256MiB"
	FunctionTimeout int    // seconds, default: 60
}

// HybridService represents a service that can be deployed as either Cloud Function or Cloud Run
type HybridService struct {
	pulumi.ResourceState

	// One of these will be set based on deployment type
	Function *cloudfunctionsv2.Function
	CloudRun *cloudrun.Service

	// Common outputs
	URL  pulumi.StringOutput
	Type DeploymentType
}

// NewHybridService creates a new service deployed as either Cloud Function or Cloud Run
func NewHybridService(ctx *pulumi.Context, name string, args *HybridServiceArgs, opts ...pulumi.ResourceOption) (*HybridService, error) {
	component := &HybridService{
		Type: args.DeploymentType,
	}

	if err := ctx.RegisterComponentResource("catalyst:hybrid:Service", name, component, opts...); err != nil {
		return nil, err
	}

	switch args.DeploymentType {
	case DeploymentTypeFunction:
		return deployAsFunction(ctx, component, name, args)
	case DeploymentTypeCloudRun:
		return deployAsCloudRun(ctx, component, name, args)
	default:
		return nil, fmt.Errorf("invalid deployment type: %s", args.DeploymentType)
	}
}

// deployAsFunction deploys the service as a Cloud Function Gen2
func deployAsFunction(ctx *pulumi.Context, component *HybridService, name string, args *HybridServiceArgs) (*HybridService, error) {
	// Validate function-specific requirements
	if args.Bucket == nil {
		return nil, fmt.Errorf("bucket is required for function deployment")
	}
	if args.SourcePath == "" {
		return nil, fmt.Errorf("source path is required for function deployment")
	}
	if args.EntryPoint == "" {
		return nil, fmt.Errorf("entry point is required for function deployment")
	}
	if args.Runtime == "" {
		args.Runtime = "python311" // Default runtime
	}

	// Set defaults
	if args.FunctionMemory == "" {
		args.FunctionMemory = "256MiB"
	}
	if args.FunctionTimeout == 0 {
		args.FunctionTimeout = 60
	}

	// Upload source code
	archive := pulumi.NewFileArchive(args.SourcePath)
	objectName := fmt.Sprintf("%s-source.zip", name)

	sourceObject, err := storage.NewBucketObject(ctx, objectName, &storage.BucketObjectArgs{
		Bucket: args.Bucket.Name,
		Source: archive,
		Name:   pulumi.String(objectName),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	// Create Cloud Function Gen2
	fn, err := cloudfunctionsv2.NewFunction(ctx, name, &cloudfunctionsv2.FunctionArgs{
		Name:     pulumi.String(name),
		Project:  pulumi.String(args.Project),
		Location: pulumi.String(args.Region),
		BuildConfig: &cloudfunctionsv2.FunctionBuildConfigArgs{
			Runtime:    pulumi.String(args.Runtime),
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
			MaxInstanceCount:           pulumi.Int(100),
			MinInstanceCount:           pulumi.Int(0),
			AvailableMemory:            pulumi.String(args.FunctionMemory),
			TimeoutSeconds:             pulumi.Int(args.FunctionTimeout),
			IngressSettings:            pulumi.String("ALLOW_ALL"),
			AllTrafficOnLatestRevision: pulumi.Bool(true),
			ServiceAccountEmail:        args.ServiceAccount,
			EnvironmentVariables:       args.EnvVars,
		},
		Description: pulumi.String(args.Description),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	// Make function publicly accessible
	_, err = cloudfunctionsv2.NewFunctionIamMember(ctx, name+"-invoker", &cloudfunctionsv2.FunctionIamMemberArgs{
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
	// Extract URL from function
	component.URL = fn.ServiceConfig.Uri().Elem()

	return component, nil
}

// deployAsCloudRun deploys the service as Cloud Run
func deployAsCloudRun(ctx *pulumi.Context, component *HybridService, name string, args *HybridServiceArgs) (*HybridService, error) {
	// Validate Cloud Run-specific requirements
	if args.ContainerImage == "" {
		return nil, fmt.Errorf("container image is required for Cloud Run deployment")
	}

	// Set defaults
	if args.Port == 0 {
		args.Port = 8080
	}
	if args.Memory == "" {
		args.Memory = "512Mi"
	}
	if args.CPU == "" {
		args.CPU = "1"
	}
	if args.MaxInstances == 0 {
		args.MaxInstances = 100
	}

	// Create Cloud Run service
	service, err := cloudrun.NewService(ctx, name, &cloudrun.ServiceArgs{
		Name:     pulumi.String(name),
		Project:  pulumi.String(args.Project),
		Location: pulumi.String(args.Region),

		Template: &cloudrun.ServiceTemplateArgs{
			Spec: &cloudrun.ServiceTemplateSpecArgs{
				ServiceAccountName: args.ServiceAccount,
				Containers: cloudrun.ServiceTemplateSpecContainerArray{
					&cloudrun.ServiceTemplateSpecContainerArgs{
						Image: pulumi.String(args.ContainerImage),
						Ports: cloudrun.ServiceTemplateSpecContainerPortArray{
							&cloudrun.ServiceTemplateSpecContainerPortArgs{
								ContainerPort: pulumi.Int(args.Port),
							},
						},
						Resources: &cloudrun.ServiceTemplateSpecContainerResourcesArgs{
							Limits: pulumi.StringMap{
								"memory": pulumi.String(args.Memory),
								"cpu":    pulumi.String(args.CPU),
							},
						},
						Envs: convertEnvVars(args.EnvVars),
					},
				},
				ContainerConcurrency: pulumi.Int(1000),
			},
			Metadata: &cloudrun.ServiceTemplateMetadataArgs{
				Annotations: pulumi.StringMap{
					"autoscaling.knative.dev/minScale":         pulumi.Sprintf("%d", args.MinInstances),
					"autoscaling.knative.dev/maxScale":         pulumi.Sprintf("%d", args.MaxInstances),
					"run.googleapis.com/execution-environment": pulumi.String("gen2"),
				},
			},
		},

		Traffics: cloudrun.ServiceTrafficArray{
			&cloudrun.ServiceTrafficArgs{
				Percent:        pulumi.Int(100),
				LatestRevision: pulumi.Bool(true),
			},
		},

		AutogenerateRevisionName: pulumi.Bool(true),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	// Make service publicly accessible
	_, err = cloudrun.NewIamMember(ctx, name+"-invoker", &cloudrun.IamMemberArgs{
		Project:  service.Project,
		Location: service.Location,
		Service:  service.Name,
		Role:     pulumi.String("roles/run.invoker"),
		Member:   pulumi.String("allUsers"),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	component.CloudRun = service
	// Extract URL from Cloud Run service
	component.URL = service.Statuses.Index(pulumi.Int(0)).Url().Elem()

	return component, nil
}

// GetURL returns the service URL regardless of deployment type
func (s *HybridService) GetURL() pulumi.StringOutput {
	return s.URL
}

// IsFunction returns true if deployed as Cloud Function
func (s *HybridService) IsFunction() bool {
	return s.Type == DeploymentTypeFunction
}

// IsCloudRun returns true if deployed as Cloud Run
func (s *HybridService) IsCloudRun() bool {
	return s.Type == DeploymentTypeCloudRun
}
