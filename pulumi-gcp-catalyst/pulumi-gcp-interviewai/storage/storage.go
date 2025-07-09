package storage

import (
	"fmt"

	"catalyst-backend/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateDeploymentBucket(ctx *pulumi.Context, cfg *config.CatalystConfig) (*storage.Bucket, error) {
	name := fmt.Sprintf("%s-functions-deployment-%s", cfg.GcpProject, cfg.Environment)
	return storage.NewBucket(ctx, fmt.Sprintf("functions-deployment-bucket-%s", cfg.Environment), &storage.BucketArgs{
		Project:  pulumi.String(cfg.GcpProject),
		Location: pulumi.String(cfg.GcpRegion),
		Name:     pulumi.String(name),
	})
}

func CreateSourceBucket(ctx *pulumi.Context, cfg *config.CatalystConfig) (*storage.Bucket, error) {
	name := fmt.Sprintf("%s-function-sources-%s", cfg.GcpProject, cfg.Environment)
	return storage.NewBucket(ctx, "function-source-bucket", &storage.BucketArgs{
		Name:                     pulumi.String(name),
		Location:                 pulumi.String("US"),
		UniformBucketLevelAccess: pulumi.Bool(true),
		Project:                  pulumi.String(cfg.GcpProject),
	})
}
