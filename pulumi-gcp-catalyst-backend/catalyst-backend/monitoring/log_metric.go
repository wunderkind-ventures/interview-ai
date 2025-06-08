package monitoring

import (
	"fmt"

	"catalyst-backend/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/logging"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateCriticalErrorLogMetric(ctx *pulumi.Context, cfg *config.CatalystConfig) (*logging.Metric, error) {
	filter := `resource.type="cloud_function" severity>=ERROR textPayload:"CRITICAL_ERROR"`
	name := fmt.Sprintf("cloud-function-critical-errors-%s", cfg.Environment)
	return logging.NewMetric(ctx, name, &logging.MetricArgs{
		Project:     pulumi.String(cfg.GcpProject),
		Name:        pulumi.String(name),
		Description: pulumi.Sprintf("Counts critical errors logged by Cloud Functions in %s environment.", cfg.Environment),
		Filter:      pulumi.String(filter),
		MetricDescriptor: &logging.MetricMetricDescriptorArgs{
			MetricKind: pulumi.String("DELTA"),
			ValueType:  pulumi.String("INT64"),
			Unit:       pulumi.String("1"),
			Labels: logging.MetricMetricDescriptorLabelArray{
				&logging.MetricMetricDescriptorLabelArgs{
					Key:         pulumi.String("function_name"),
					ValueType:   pulumi.String("STRING"),
					Description: pulumi.String("Name of the Cloud Function"),
				},
			},
		},
		LabelExtractors: pulumi.StringMap{
			"function_name": pulumi.String("EXTRACT(resource.labels.function_name)"),
		},
	})
}
