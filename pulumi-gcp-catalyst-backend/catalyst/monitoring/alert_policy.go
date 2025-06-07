package monitoring

import (
	"fmt"

	"pulumi_modular_scaffold/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/logging"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/monitoring"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateCriticalErrorAlertPolicy(
	ctx *pulumi.Context,
	cfg *config.CatalystConfig,
	metric *logging.Metric,
	channel *monitoring.NotificationChannel,
) (*monitoring.AlertPolicy, error) {
	name := fmt.Sprintf("criticalErrorAlertPolicy-%s", cfg.Environment)
	return monitoring.NewAlertPolicy(ctx, name, &monitoring.AlertPolicyArgs{
		Project:     pulumi.String(cfg.GcpProject),
		DisplayName: pulumi.Sprintf("Critical Errors in Cloud Functions Alert (%s)", cfg.Environment),
		Combiner:    pulumi.String("OR"),
		Conditions: monitoring.AlertPolicyConditionArray{
			&monitoring.AlertPolicyConditionArgs{
				DisplayName: pulumi.String("Log-based metric: Critical Errors > 0"),
				ConditionThreshold: &monitoring.AlertPolicyConditionConditionThresholdArgs{
					Filter:         pulumi.Sprintf("metric.type=\"logging.googleapis.com/user/%s\" resource.type=\"cloud_function\"", metric.Name),
					Comparison:     pulumi.String("COMPARISON_GT"),
					ThresholdValue: pulumi.Float64(0),
					Duration:       pulumi.String("300s"),
					Aggregations: monitoring.AlertPolicyConditionConditionThresholdAggregationArray{
						&monitoring.AlertPolicyConditionConditionThresholdAggregationArgs{
							AlignmentPeriod:  pulumi.String("300s"),
							PerSeriesAligner: pulumi.String("ALIGN_COUNT"),
						},
					},
				},
			},
		},
		NotificationChannels: pulumi.StringArray{
			channel.ID(),
		},
		Documentation: &monitoring.AlertPolicyDocumentationArgs{
			Content:  pulumi.Sprintf("One or more Cloud Functions in the %s environment have logged a CRITICAL_ERROR message. Please investigate the logs for details.", cfg.Environment),
			MimeType: pulumi.String("text/markdown"),
		},
	})
}
