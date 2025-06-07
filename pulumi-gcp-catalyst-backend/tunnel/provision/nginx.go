package provision

import (
	"github.com/pulumi/pulumi-command/sdk/v3/go/command"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func SetupTunnelNginx(ctx *pulumi.Context, instanceIp pulumi.StringOutput, sshPrivateKey pulumi.StringInput, domain pulumi.StringInput, dependsOn pulumi.Resource) (*command.RemoteCommand, error) {
	cmd, err := command.NewRemoteCommand(ctx, "configure-nginx-tunnel", &command.RemoteCommandArgs{
		Connection: &command.ConnectionArgs{
			Host:       instanceIp,
			User:       pulumi.String("tunneladmin"),
			PrivateKey: sshPrivateKey,
		},
		Create: pulumi.Sprintf(`bash -c '
sudo tee /etc/nginx/sites-available/tunnel <<EOF
server {
    listen 80;
    server_name %s;

    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/tunnel /etc/nginx/sites-enabled/tunnel
sudo nginx -t && sudo systemctl reload nginx
'`, domain),
		Triggers: pulumi.StringArray{domain},
	}, pulumi.DependsOn([]pulumi.Resource{dependsOn}))

	return cmd, err
}
