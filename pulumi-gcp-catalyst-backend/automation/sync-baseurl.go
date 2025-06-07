package main

import (
	"context"
	"fmt"
	"log"

	auto "github.com/pulumi/pulumi/sdk/v3/go/auto"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optup"
)

func main() {
	ctx := context.Background()

	// Stack names (update as needed)
	tunnelStackName := "tunnel-dev"
	apiStackName := "catalyst-gcp-infra/dev"

	// === Load Tunnel Stack and Get Output ===
	tunnelStack, err := auto.SelectStackLocalSource(ctx, tunnelStackName, "./path/to/tunnel/program")
	if err != nil {
		log.Fatalf("Failed to load tunnel stack: %v", err)
	}

	tunnelOutputs, err := tunnelStack.Outputs(ctx)
	if err != nil {
		log.Fatalf("Failed to get tunnel outputs: %v", err)
	}

	tunnelUrlVal, ok := tunnelOutputs["tunnelUrl"]
	if !ok {
		log.Fatalf("tunnelUrl not found in tunnel outputs")
	}
	tunnelUrl := tunnelUrlVal.Value.(string)

	// === Inject into API Stack Config ===
	apiStack, err := auto.SelectStackLocalSource(ctx, apiStackName, "./path/to/api/program")
	if err != nil {
		log.Fatalf("Failed to load API stack: %v", err)
	}

	err = apiStack.SetConfig(ctx, "catalyst-gcp-infra:nextjsBaseUrl", auto.ConfigValue{Value: tunnelUrl})
	if err != nil {
		log.Fatalf("Failed to set nextjsBaseUrl in API stack: %v", err)
	}

	fmt.Println("✅ Successfully injected tunnelUrl into API stack config")

	// Optional: Deploy API stack with updated config
	_, err = apiStack.Up(ctx, optup.Message("Deploying API stack with updated tunnel URL"))
	if err != nil {
		log.Fatalf("Failed to update API stack: %v", err)
	}

	fmt.Println("✅ API stack deployed")
}
