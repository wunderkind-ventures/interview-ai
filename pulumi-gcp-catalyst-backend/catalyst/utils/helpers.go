package utils

import (
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func MergeStringMaps(base, override pulumi.StringMap) pulumi.StringMap {
	merged := pulumi.StringMap{}
	for k, v := range base {
		merged[k] = v
	}
	for k, v := range override {
		merged[k] = v
	}
	return merged
}

func ExportURL(ctx *pulumi.Context, name string, output pulumi.StringOutput) {
	ctx.Export(name, output)
}
