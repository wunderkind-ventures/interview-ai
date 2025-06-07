package main

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/compute"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "")
		env := cfg.Get("environment")
		if env == "" {
			env = "dev"
		}

		namePrefix := fmt.Sprintf("tunnel-%s", env)
		projectId := ctx.Project()
		zone := "us-central1-a"
		machineType := "e2-micro"
		image := "ubuntu-os-cloud/ubuntu-2204-lts"
		username := "tunneladmin"
		sshKey := "ssh-rsa AAAA... your_public_key_here"

		// Firewall to allow SSH, HTTP, HTTPS, and tunnel ports
		_, err := compute.NewFirewall(ctx, namePrefix+"-firewall", &compute.FirewallArgs{
			Network: pulumi.String("default"),
			Allows: compute.FirewallAllowArray{
				&compute.FirewallAllowArgs{
					Protocol: pulumi.String("tcp"),
					Ports: pulumi.StringArray{
						pulumi.String("22"),
						pulumi.String("80"),
						pulumi.String("443"),
						pulumi.String("9000-9100"),
					},
				},
			},
			Direction:    pulumi.String("INGRESS"),
			SourceRanges: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
		})
		if err != nil {
			return err
		}

		// Compute Instance
		instance, err := compute.NewInstance(ctx, namePrefix+"-server", &compute.InstanceArgs{
			MachineType: pulumi.String(machineType),
			Zone:        pulumi.String(zone),
			BootDisk: &compute.InstanceBootDiskArgs{
				InitializeParams: &compute.InstanceBootDiskInitializeParamsArgs{
					Image: pulumi.String(image),
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
				"ssh-keys": pulumi.String(fmt.Sprintf("%s:%s", username, sshKey)),
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
			return err
		}

		ctx.Export("instanceIP", instance.NetworkInterfaces.Index(pulumi.Int(0)).AccessConfigs().Index(pulumi.Int(0)).NatIp())
		return nil
	})
}
