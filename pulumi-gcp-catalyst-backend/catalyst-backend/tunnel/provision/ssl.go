package provision

import (
	utils "catalyst-backend/utils"

	"github.com/pulumi/pulumi-command/sdk/go/command/remote"

	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func SetupSSLCertificate(ctx *pulumi.Context, instanceIp pulumi.StringOutput, sshPrivateKey pulumi.StringInput, domain pulumi.StringInput, dependsOn pulumi.Resource) error {
	_, err := remote.NewCommand(ctx, "configure-certbot-ssl", &remote.CommandArgs{
		Connection: &remote.ConnectionArgs{
			Host:       instanceIp,
			User:       pulumi.String("tunneladmin"),
			PrivateKey: sshPrivateKey,
		},
		Create: pulumi.Sprintf(`bash -c '
		# Ensure SSH connection is stable
		sudo tee -a /etc/ssh/sshd_config.d/keepalive.conf <<EOF
ClientAliveInterval 60
ClientAliveCountMax 3
TCPKeepAlive yes
EOF

		sudo systemctl restart sshd
		
		# Run certbot with increased timeout
		sudo timeout 300 certbot --nginx -d %s --non-interactive --agree-tos -m admin@%s --redirect || exit 1
	'`, domain, domain),
	}, pulumi.DependsOn(utils.FilterNilResources([]pulumi.Resource{dependsOn})))

	return err
}
