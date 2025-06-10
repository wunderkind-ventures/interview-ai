package config

import (
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

type CatalystConfig struct {
	Environment      string
	GcpProject       string
	GcpRegion        string
	AlertEmail       string
	NextjsBaseUrl    string
	DefaultGeminiKey pulumi.StringInput
	OpenapiSpecPath  string
	TunnelDomain     string
	SshPrivateKey    pulumi.StringInput
}

func Load(ctx *pulumi.Context) (*CatalystConfig, error) {
	cfg := config.New(ctx, "catalyst-gcp-infra")
	return &CatalystConfig{
		Environment:      cfg.Require("environment"),
		GcpProject:       cfg.Require("gcpProject"),
		GcpRegion:        cfg.Require("gcpRegion"),
		AlertEmail:       cfg.Require("alertEmail"),
		NextjsBaseUrl:    cfg.Require("nextjsBaseUrl"),
		DefaultGeminiKey: cfg.RequireSecret("defaultGeminiApiKey"),
		TunnelDomain:     cfg.Require("nextjsBaseUrl"),
		SshPrivateKey:    cfg.RequireSecret("sshPrivateKey"),
		OpenapiSpecPath:  "../backends/catalyst-go-backend/openapi-spec.yaml",
	}, nil
}
