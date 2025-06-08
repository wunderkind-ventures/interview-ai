package functions

import (
	"fmt"
	"path/filepath"

	"catalyst-backend/catalyst/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	"catalyst-backend/catalyst/functions/component"
)

// func DeployParseResumeFunction(ctx *pulumi.Context, cfg *config.CatalystConfig, sourceBucket *storage.Bucket) (*cloudfunctionsv2.Function, error) {
// 	sourcePath := filepath.Join("..", "backends", "catalyst-go-backend", "functions", "docsupport", "parseresume")
// 	archive := pulumi.NewFileArchive(sourcePath)
// 	objectName := "docsupport-parseresume-source.zip"

// 	sourceObject, err := storage.NewBucketObject(ctx, "docsupport-parseresume-source-zip", &storage.BucketObjectArgs{
// 		Bucket: sourceBucket.Name,
// 		Source: archive,
// 		Name:   pulumi.String(objectName),
// 	})
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to upload parseresume source archive: %w", err)
// 	}

// 	function, err := cloudfunctionsv2.NewFunction(ctx, "docsupport-parseresume-function", &cloudfunctionsv2.FunctionArgs{
// 		Project:  pulumi.String(cfg.GcpProject),
// 		Location: pulumi.String(cfg.GcpRegion),
// 		BuildConfig: &cloudfunctionsv2.FunctionBuildConfigArgs{
// 			Runtime:    pulumi.String("go122"),
// 			EntryPoint: pulumi.String("ParseResume"),
// 			Source: &cloudfunctionsv2.FunctionBuildConfigSourceArgs{
// 				StorageSource: &cloudfunctionsv2.FunctionBuildConfigSourceStorageSourceArgs{
// 					Bucket: sourceBucket.Name,
// 					Object: sourceObject.Name,
// 				},
// 			},
// 		},
// 		ServiceConfig: &cloudfunctionsv2.FunctionServiceConfigArgs{
// 			MaxInstanceCount: pulumi.Int(2),
// 			MinInstanceCount: pulumi.Int(0),
// 			AvailableMemory:  pulumi.String("256MiB"),
// 			TimeoutSeconds:   pulumi.Int(60),
// 			IngressSettings:  pulumi.String("ALLOW_ALL"),
// 		},
// 		Description: pulumi.String("Parses uploaded resume/document files (docx, md) and returns text."),
// 	})
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to create parseresume function: %w", err)
// 	}

// 	_, err = cloudfunctionsv2.NewFunctionIamMember(ctx, "docsupport-parseresume-invoker", &cloudfunctionsv2.FunctionIamMemberArgs{
// 		Project:       function.Project,
// 		Location:      function.Location,
// 		CloudFunction: function.Name,
// 		Role:          pulumi.String("roles/cloudfunctions.invoker"),
// 		Member:        pulumi.String("allUsers"),
// 	})
// 	if err != nil {
// 		return nil, fmt.Errorf("failed to set IAM invoker for parseresume function: %w", err)
// 	}

// 	return function, nil
// }


// Deploy ParseResume Gen2 Function via ComponentResource
parseResumeFn, err := component.NewGen2Function(ctx, "ParseResume", &component.Gen2FunctionArgs{
	Name:        "ParseResume",
	EntryPoint:  "ParseResume",
	SourcePath:  "../backends/catalyst-go-backend/functions/docsupport/parseresume",
	Bucket:      sourceBucket,
	Region:      cfg.GcpRegion,
	Project:     cfg.GcpProject,
	Description: "Parses uploaded resume/document files (docx, md) and returns text.",
	EnvVars:     pulumi.StringMap{},
})
if err != nil {
	return err
}