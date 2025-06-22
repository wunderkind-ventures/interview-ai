# Pulumi Component Library

This directory contains reusable Pulumi components for deploying services to Google Cloud Platform.

## Components

### Gen1Function
Traditional Cloud Functions (1st generation) component for Go services.

### Gen2Function  
Cloud Functions (2nd generation) component with enhanced features and container support.

### CloudRunService
Cloud Run service deployment component for containerized applications.

### HybridService (Recommended)
Flexible component that can deploy services as either Cloud Functions Gen2 or Cloud Run based on requirements.

## Hybrid Service Component

The `HybridService` component provides a unified interface for deploying services to either Cloud Functions or Cloud Run, allowing you to optimize for cost and performance based on your specific needs.

### Usage

```go
// Deploy as Cloud Function (for cost optimization)
pythonService, err := component.NewHybridService(ctx, "MyService", &component.HybridServiceArgs{
    Name:           "MyService",
    DeploymentType: component.DeploymentTypeFunction,
    Project:        "my-project",
    Region:         "us-central1",
    ServiceAccount: serviceAccount.Email,
    
    // Function-specific configuration
    SourcePath:     "./my-service",
    EntryPoint:     "main",
    Runtime:        "python311",
    Bucket:         sourceBucket,
    FunctionMemory: "1024MiB",
    FunctionTimeout: 540, // 9 minutes
    
    // Environment variables
    EnvVars: pulumi.StringMap{
        "ENV": pulumi.String("production"),
    },
})

// Deploy as Cloud Run (for custom containers)
rustService, err := component.NewHybridService(ctx, "RustMLService", &component.HybridServiceArgs{
    Name:           "RustMLService",
    DeploymentType: component.DeploymentTypeCloudRun,
    Project:        "my-project",
    Region:         "us-central1",
    ServiceAccount: serviceAccount.Email,
    
    // Cloud Run-specific configuration
    ContainerImage: "gcr.io/my-project/rust-ml:latest",
    Port:          8080,
    Memory:        "4Gi",
    CPU:           "2",
    MinInstances:  1,
    MaxInstances:  100,
    
    // Environment variables
    EnvVars: pulumi.StringMap{
        "MODEL_PATH": pulumi.String("/models/latest"),
    },
})
```

### Decision Criteria

#### When to use Cloud Functions (DeploymentTypeFunction)

Choose Cloud Functions when:
- Service has simple HTTP endpoints
- Code can be packaged as source (Python, Node.js, Go)
- No custom system dependencies required
- Execution time < 9 minutes (Gen2 limit)
- Cold starts are acceptable
- Want to minimize costs (pay per invocation)

Examples:
- API endpoints
- Webhook handlers
- Simple data processing
- Event-driven functions

#### When to use Cloud Run (DeploymentTypeCloudRun)

Choose Cloud Run when:
- Need custom container with specific dependencies
- Require consistent performance (min instances > 0)
- Need WebSocket support
- Long-running processes (> 9 minutes)
- Custom runtimes (Rust, C++, etc.)
- GPU/specialized hardware requirements
- Need to control the full stack

Examples:
- ML inference services
- Real-time applications
- Custom runtime services
- Complex processing pipelines

### Configuration Reference

#### Common Fields
- `Name`: Service name
- `DeploymentType`: Either `DeploymentTypeFunction` or `DeploymentTypeCloudRun`
- `Project`: GCP project ID
- `Region`: Deployment region
- `ServiceAccount`: Service account email
- `EnvVars`: Environment variables
- `Description`: Service description

#### Function-Specific Fields
- `SourcePath`: Path to source code
- `EntryPoint`: Function entry point
- `Runtime`: Runtime (e.g., "python311", "go122", "nodejs20")
- `Bucket`: Storage bucket for source code
- `FunctionMemory`: Memory allocation (e.g., "256MiB", "1024MiB")
- `FunctionTimeout`: Timeout in seconds (max 540 for Gen2)

#### Cloud Run-Specific Fields
- `ContainerImage`: Container image URL
- `Port`: Container port (default: 8080)
- `Memory`: Memory allocation (e.g., "512Mi", "4Gi")
- `CPU`: CPU allocation (e.g., "1", "2", "4")
- `MinInstances`: Minimum instances (0 for scale to zero)
- `MaxInstances`: Maximum instances (default: 100)

### Migration Between Platforms

The hybrid component makes it easy to migrate between platforms:

```go
// Start with Function for development
DeploymentType: component.DeploymentTypeFunction,

// Later, switch to Cloud Run for production
DeploymentType: component.DeploymentTypeCloudRun,
```

No other code changes required - just update the deployment type and relevant configuration.

### Cost Optimization Tips

1. **Default to Functions**: Start with Cloud Functions for new services
2. **Monitor cold starts**: If latency is an issue, consider Cloud Run with min instances
3. **Batch workloads**: Use Cloud Run for batch processing that exceeds function limits
4. **Right-size resources**: Use minimum CPU/memory that meets your needs
5. **Scale to zero**: Set `MinInstances: 0` for Cloud Run when possible

### Future Enhancements

- Automatic platform selection based on resource requirements
- Built-in cost estimation
- Performance profiling integration
- Automated migration tooling
- Multi-region deployment support