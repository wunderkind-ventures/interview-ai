package provision

import (
	"github.com/pulumi/pulumi-command/sdk/v3/go/command"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func SetupSSLCertificate(ctx *pulumi.Context, instanceIp pulumi.StringOutput, sshPrivateKey pulumi.StringInput, domain pulumi.StringInput, dependsOn pulumi.Resource) error {
	_, err := command.NewRemoteCommand(ctx, "configure-certbot-ssl", &command.RemoteCommandArgs{
		Connection: &command.ConnectionArgs{
			Host:       instanceIp,
			User:       pulumi.String("tunneladmin"),
			PrivateKey: sshPrivateKey,
		},
		Create: pulumi.Sprintf(`bash -c '
		sudo certbot --nginx -d %s --non-interactive --agree-tos -m admin@%s --redirect || exit 1
	'`, domain, domain),
		Triggers: pulumi.StringArray{domain},
	}, pulumi.DependsOn([]pulumi.Resource{dependsOn}))

	return err
}
