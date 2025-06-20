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
# Configure SSH keep-alive
sudo tee /etc/ssh/sshd_config.d/keepalive.conf <<EOF
ClientAliveInterval 60
ClientAliveCountMax 3
TCPKeepAlive yes
EOF

sudo systemctl restart sshd

# Configure autossh for persistent connections
sudo tee /etc/systemd/system/autossh-tunnel.service <<EOF
[Unit]
Description=AutoSSH tunnel service
After=network.target

[Service]
Environment="AUTOSSH_GATETIME=0"
ExecStart=/usr/bin/autossh -M 0 -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" -N -R 9000:localhost:9000 localhost
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable autossh-tunnel
sudo systemctl start autossh-tunnel

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
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tunnel /etc/nginx/sites-enabled/tunnel
sudo nginx -t && sudo systemctl reload nginx
'`, domain),
	}, pulumi.DependsOn(utils.FilterNilResources([]pulumi.Resource{dependsOn})))

	return cmd, err
}
