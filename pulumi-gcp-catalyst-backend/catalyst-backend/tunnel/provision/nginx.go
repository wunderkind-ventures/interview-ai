package provision

import (
	utils "catalyst-backend/utils"

	"github.com/pulumi/pulumi-command/sdk/go/command/remote"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func SetupTunnelNginx(ctx *pulumi.Context, instanceIp pulumi.StringOutput, sshPrivateKey pulumi.StringInput, domain pulumi.StringInput, dependsOn pulumi.Resource) (*remote.Command, error) {
	cmd, err := remote.NewCommand(ctx, "configure-nginx-tunnel", &remote.CommandArgs{
		Connection: &remote.ConnectionArgs{
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
	}, pulumi.DependsOn(utils.FilterNilResources([]pulumi.Resource{dependsOn})))

	return cmd, err
}
