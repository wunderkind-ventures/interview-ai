package component

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudrun"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type CloudRunServiceArgs struct {
	Name           string
	Project        string
	Region         string
	SourcePath     string
	Bucket         *storage.Bucket
	ServiceAccount pulumi.StringOutput
	EnvVars        pulumi.StringMap
	Port           int
	Memory         string
	CPU            string
	MinInstances   int
	MaxInstances   int
}

type CloudRunService struct {
	pulumi.ResourceState
	Service *cloudrun.Service
	URL     pulumi.StringOutput
}

func NewCloudRunService(ctx *pulumi.Context, name string, args *CloudRunServiceArgs, opts ...pulumi.ResourceOption) (*CloudRunService, error) {
	component := &CloudRunService{}
	if err := ctx.RegisterComponentResource("catalyst:cloudrun:Service", name, component, opts...); err != nil {
		return nil, err
	}

	// Set defaults
	if args.Port == 0 {
		args.Port = 8080
	}
	if args.Memory == "" {
		args.Memory = "512Mi"
	}
	if args.CPU == "" {
		args.CPU = "1000m"
	}
	if args.MinInstances == 0 {
		args.MinInstances = 0
	}
	if args.MaxInstances == 0 {
		args.MaxInstances = 100
	}

	// For this simplified version, we expect a pre-built container image
	// The image should be built and pushed via CI/CD pipeline
	imageURL := pulumi.Sprintf("gcr.io/%s/%s:latest", args.Project, args.Name)
	
	service, err := cloudrun.NewService(ctx, args.Name, &cloudrun.ServiceArgs{
		Project:  pulumi.String(args.Project),
		Location: pulumi.String(args.Region),
		
		Template: &cloudrun.ServiceTemplateArgs{
			Spec: &cloudrun.ServiceTemplateSpecArgs{
				ServiceAccountName: args.ServiceAccount,
				Containers: cloudrun.ServiceTemplateSpecContainerArray{
					&cloudrun.ServiceTemplateSpecContainerArgs{
						Image: imageURL,
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
					"autoscaling.knative.dev/minScale": pulumi.Sprintf("%d", args.MinInstances),
					"autoscaling.knative.dev/maxScale": pulumi.Sprintf("%d", args.MaxInstances),
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


	// Make service publicly accessible (for development)
	_, err = cloudrun.NewIamMember(ctx, fmt.Sprintf("%s-invoker", args.Name), &cloudrun.IamMemberArgs{
		Project:  service.Project,
		Location: service.Location,
		Service:  service.Name,
		Role:     pulumi.String("roles/run.invoker"),
		Member:   pulumi.String("allUsers"),
	}, pulumi.Parent(component))
	if err != nil {
		return nil, err
	}

	component.Service = service
	// Extract URL from Cloud Run service statuses array
	component.URL = service.Statuses.Index(pulumi.Int(0)).Url().ToStringOutput()
	
	return component, nil
}

// convertEnvVars converts pulumi.StringMap to Cloud Run environment variable format
func convertEnvVars(envVars pulumi.StringMap) cloudrun.ServiceTemplateSpecContainerEnvArray {
	if envVars == nil || len(envVars) == 0 {
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

// Helper function to create Python ADK Agent service
func NewPythonADKAgentService(ctx *pulumi.Context, name string, project, region string, serviceAccount pulumi.StringOutput, bucket *storage.Bucket, envVars pulumi.StringMap, opts ...pulumi.ResourceOption) (*CloudRunService, error) {
	args := &CloudRunServiceArgs{
		Name:           name,
		Project:        project,
		Region:         region,
		SourcePath:     "../../backends/catalyst-py",
		Bucket:         bucket,
		ServiceAccount: serviceAccount,
		EnvVars:        envVars,
		Port:           8080,
		Memory:         "1Gi",
		CPU:            "1000m",
		MinInstances:   0,
		MaxInstances:   10,
	}
	
	return NewCloudRunService(ctx, name, args, opts...)
}