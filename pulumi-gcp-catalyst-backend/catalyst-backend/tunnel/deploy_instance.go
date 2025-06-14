package provision

import (
	"catalyst-backend/tunnel/provision"
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/compute"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type TunnelConfig struct {
	Zone      string
	Username  string
	SSHKey    pulumi.StringInput
	Machine   string
	Image     string
	PortRange string
	Domain    string
}

func DeployTunnelInstance(ctx *pulumi.Context, cfg TunnelConfig) (pulumi.StringOutput, error) {
	namePrefix := fmt.Sprintf("tunnel-%s", cfg.Zone)

	_, err := compute.NewFirewall(ctx, namePrefix+"-firewall", &compute.FirewallArgs{
		Network: pulumi.String("default"),
		Allows: compute.FirewallAllowArray{
			&compute.FirewallAllowArgs{
				Protocol: pulumi.String("tcp"),
				Ports: pulumi.StringArray{
					pulumi.String("22"),
					pulumi.String("80"),
					pulumi.String("443"),
					pulumi.String(cfg.PortRange),
				},
			},
		},
		Direction:    pulumi.String("INGRESS"),
		SourceRanges: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
	})
	if err != nil {
		return pulumi.StringOutput{}, err
	}

	instance, err := compute.NewInstance(ctx, namePrefix+"-server", &compute.InstanceArgs{
		MachineType: pulumi.String(cfg.Machine),
		Zone:        pulumi.String(cfg.Zone),
		BootDisk: &compute.InstanceBootDiskArgs{
			InitializeParams: &compute.InstanceBootDiskInitializeParamsArgs{
				Image: pulumi.String(cfg.Image),
			},
		},
		NetworkInterfaces: compute.InstanceNetworkInterfaceArray{
			&compute.InstanceNetworkInterfaceArgs{
				Network: pulumi.String("default"),
				AccessConfigs: &compute.InstanceNetworkInterfaceAccessConfigArray{
					&compute.InstanceNetworkInterfaceAccessConfigArgs{},
				},
			},
		},
		Metadata: pulumi.StringMap{
			"ssh-keys": pulumi.Sprintf("%s:%s", cfg.Username, cfg.SSHKey),
			"startup-script": pulumi.String(`#!/bin/bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx autossh ufw
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
adduser --disabled-password --gecos "" tunneladmin
usermod -aG sudo tunneladmin
echo 'tunneladmin ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/tunneladmin
`),
		},
		Tags: pulumi.StringArray{pulumi.String("ssh-tunnel")},
	})
	if err != nil {
		return pulumi.StringOutput{}, err
	}

	return instance.NetworkInterfaces.Index(pulumi.Int(0)).AccessConfigs().Index(pulumi.Int(0)).NatIp().Elem(), nil
}

func DeployTunnelStack(ctx *pulumi.Context, cfg TunnelConfig) (pulumi.StringOutput, pulumi.StringOutput, error) {
	instanceIP, err := DeployTunnelInstance(ctx, cfg)
	if err != nil {
		return pulumi.StringOutput{}, pulumi.StringOutput{}, err
	}

	nginxCmd, err := provision.SetupTunnelNginx(ctx, instanceIP, cfg.SSHKey, pulumi.String(cfg.Domain), nil)
	if err != nil {
		return pulumi.StringOutput{}, pulumi.StringOutput{}, err
	}

	err = provision.SetupSSLCertificate(ctx, instanceIP, cfg.SSHKey, pulumi.String(cfg.Domain), nginxCmd)
	if err != nil {
		return pulumi.StringOutput{}, pulumi.StringOutput{}, err
	}

	tunnelUrl := pulumi.Sprintf("%s", cfg.Domain)
	return instanceIP, tunnelUrl, nil
}
