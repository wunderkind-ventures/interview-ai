package monitoring

import (
	"fmt"

	"catalyst-backend/config"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/monitoring"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func CreateEmailNotificationChannel(ctx *pulumi.Context, cfg *config.CatalystConfig) (*monitoring.NotificationChannel, error) {
	name := fmt.Sprintf("emailNotificationChannel-%s", cfg.Environment)
	return monitoring.NewNotificationChannel(ctx, name, &monitoring.NotificationChannelArgs{
		DisplayName: pulumi.Sprintf("Email Alert Channel (%s)", cfg.Environment),
		Type:        pulumi.String("email"),
		Labels: pulumi.StringMap{
			"email_address": pulumi.String(cfg.AlertEmail),
		},
		Project: pulumi.String(cfg.GcpProject),
	})
}
