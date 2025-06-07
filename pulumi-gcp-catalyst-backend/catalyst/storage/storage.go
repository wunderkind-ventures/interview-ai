package storage

import (
	"fmt"

	"pulumi_modular_scaffold/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateDeploymentBucket(ctx *pulumi.Context, cfg *config.CatalystConfig) (*storage.Bucket, error) {
	name := fmt.Sprintf("functions-deployment-bucket-%s", cfg.Environment)
	return storage.NewBucket(ctx, name, &storage.BucketArgs{
		Project:  pulumi.String(cfg.GcpProject),
		Location: pulumi.String(cfg.GcpRegion),
		Name:     pulumi.String(name),
	})
}

func CreateSourceBucket(ctx *pulumi.Context, cfg *config.CatalystConfig) (*storage.Bucket, error) {
	name := fmt.Sprintf("%s-function-sources", ctx.Project())
	return storage.NewBucket(ctx, "function-source-bucket", &storage.BucketArgs{
		Name:                     pulumi.String(name),
		Location:                 pulumi.String("US"),
		UniformBucketLevelAccess: pulumi.Bool(true),
	})
}
