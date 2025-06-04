# BYOT Backend - Technical Implementation Addendum

## Issues Encountered and Solutions

### 1. OpenAPI Specification YAML Parsing Error

**Problem**: The `openapi-spec.yaml` file contained `%s` placeholders for dynamic URL injection, but YAML interpreted the `%` character as a directive indicator, causing parsing errors.

**Error Message**:
```
error: failed to load package: reading YAML/JSON config: <nil>: yaml: found character that cannot start any token
```

**Solution**: Quote all placeholder strings in the YAML file:
```yaml
# Before
x-google-backend:
  address: %s

# After  
x-google-backend:
  address: "%s"
```

### 2. Pulumi Go SDK Dependency Issues

**Problem**: Multiple undefined references in the Pulumi code:
- `cfg.RequireSecretStr` undefined
- Import errors for Pulumi GCP packages

**Root Cause**: Outdated Pulumi SDK dependencies in go.mod

**Solution**: Update all Pulumi dependencies to v3:
```bash
cd pulumi-gcp-byot-backend
go get github.com/pulumi/pulumi/sdk/v3/go/pulumi@latest
go get github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp@latest
go mod tidy
```

### 3. Cloud Functions Deployment Pattern

**Problem**: Initial attempt used non-existent `SourceArchive` field for Cloud Functions v1

**Error**: 
```go
// This doesn't work for Cloud Functions v1
SourceArchive: pulumi.NewFileArchive("../backends/byot-go-backend/functions/set-api-key"),
```

**Solution**: Use GCS bucket pattern for Cloud Functions v1:
```go
// 1. Create deployment bucket
deploymentBucket, _ := storage.NewBucket(ctx, "byot-deployment-bucket", &storage.BucketArgs{
    Name:     pulumi.String("byot-deployment-bucket-" + projectID),
    Location: pulumi.String("US"),
})

// 2. Upload function archive
setApiKeyArchive, _ := storage.NewBucketObject(ctx, "setApiKeyArchive", &storage.BucketObjectArgs{
    Bucket: deploymentBucket.Name,
    Name:   pulumi.String("set-api-key.zip"),
    Source: pulumi.NewFileArchive("../backends/byot-go-backend/functions/set-api-key"),
})

// 3. Reference in function
setAPIKeyFunction, _ := cloudfunctions.NewFunction(ctx, "setAPIKeyFunction", &cloudfunctions.FunctionArgs{
    SourceArchiveBucket: deploymentBucket.Name,
    SourceArchiveObject: setApiKeyArchive.Name,
    // ... other config
})
```

## Code Patterns and Best Practices

### 1. Dynamic URL Injection Pattern

The OpenAPI spec uses string formatting to inject Cloud Function URLs dynamically:

```go
// Read template
specContent, _ := ioutil.ReadFile("openapi-spec.yaml")

// Format with actual URLs
formattedSpec := fmt.Sprintf(string(specContent),
    setAPIKeyFunction.HttpsTriggerUrl,
    removeAPIKeyFunction.HttpsTriggerUrl,
    getAPIKeyStatusFunction.HttpsTriggerUrl,
    proxyToGenkitFunction.HttpsTriggerUrl,
)
```

### 2. Function Archive Pattern

Each Cloud Function follows this pattern:
```go
// Pattern for each function
functionArchive, _ := storage.NewBucketObject(ctx, "functionNameArchive", &storage.BucketObjectArgs{
    Bucket: deploymentBucket.Name,
    Name:   pulumi.String("function-name.zip"),
    Source: pulumi.NewFileArchive("../backends/byot-go-backend/functions/function-name"),
})

function, _ := cloudfunctions.NewFunction(ctx, "functionName", &cloudfunctions.FunctionArgs{
    Name:                pulumi.String("function-name"),
    SourceArchiveBucket: deploymentBucket.Name,
    SourceArchiveObject: functionArchive.Name,
    EntryPoint:          pulumi.String("FunctionEntryPoint"),
    Trigger: &cloudfunctions.FunctionTriggerArgs{
        EventTrigger: &cloudfunctions.FunctionEventTriggerArgs{
            EventType: pulumi.String("providers/cloud.pubsub/eventTypes/topic.publish"),
            Resource:  pulumi.String("projects/" + projectID + "/topics/my-topic"),
        },
    },
    Runtime: pulumi.String("go121"),
    // ... additional config
})
```

### 3. API Gateway Configuration

The API Gateway requires specific configuration for GCP:

```go
apiConfig, _ := apigateway.NewApiConfig(ctx, "byotApiConfig", &apigateway.ApiConfigArgs{
    Api:         api.ID(),
    ApiConfigId: pulumi.String("byot-api-config"),
    OpenapiDocuments: apigateway.ApiConfigOpenapiDocumentArray{
        &apigateway.ApiConfigOpenapiDocumentArgs{
            Document: &apigateway.ApiConfigOpenapiDocumentDocumentArgs{
                Path:     pulumi.String("openapi.yaml"),
                Contents: pulumi.String(base64.StdEncoding.EncodeToString([]byte(formattedSpec))),
            },
        },
    },
})
```

## Environment Variables Required

### Pulumi Configuration
```bash
pulumi config set gcp:project YOUR_PROJECT_ID
pulumi config set gcp:region us-central1
```

### Cloud Function Environment Variables
Each function needs:
- `FIREBASE_PROJECT_ID`
- `FIRESTORE_COLLECTION`
- `ENCRYPTION_KEY` (for API key encryption)
- `ALLOWED_ORIGINS` (for CORS)
- `GENKIT_ENDPOINT` (for proxy function)

## Directory Structure for Cloud Functions

```
functions/
├── set-api-key/
│   ├── function.go      # Main function code
│   └── go.mod          # Function-specific dependencies
├── remove-api-key/
│   ├── function.go
│   └── go.mod
├── get-api-key-status/
│   ├── function.go
│   └── go.mod
└── proxy-to-genkit/
    ├── function.go
    └── go.mod
```

## Deployment Commands

```bash
# Navigate to Pulumi project
cd pulumi-gcp-byot-backend

# Install dependencies
go mod download

# Preview changes
pulumi preview

# Deploy infrastructure
pulumi up

# View outputs
pulumi stack output
```

## Common Pitfalls to Avoid

1. **YAML Formatting**: Always validate YAML files before deployment
2. **Go Module Versions**: Ensure Pulumi SDK versions match across all imports
3. **Function Source Paths**: Use relative paths from Pulumi project directory
4. **API Gateway Specs**: Base64 encode the OpenAPI spec content
5. **Function Entry Points**: Must match the exported function name in Go code

## Debugging Tips

1. **Pulumi Errors**: Use `pulumi --logtostderr -v=9 up` for verbose logging
2. **Function Logs**: Check Cloud Function logs in GCP Console
3. **API Gateway**: Test with `curl` and check response headers for errors
4. **YAML Validation**: Use online YAML validators before deployment

## Performance Considerations

1. **Cold Starts**: Go functions have relatively fast cold starts (~200ms)
2. **Memory Allocation**: Start with 256MB, monitor and adjust
3. **Timeout**: Default 60s, increase for proxy function if needed
4. **Concurrent Executions**: Set limits to prevent runaway costs 