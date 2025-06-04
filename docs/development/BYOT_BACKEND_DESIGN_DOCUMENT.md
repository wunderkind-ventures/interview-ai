# BYOT (Bring Your Own Token) Backend Design Document

## Project Overview

The BYOT Backend is a serverless infrastructure designed to enable users to bring their own API keys for AI services in the Interview AI application. This document details the implementation progress and architectural decisions made during development.

**Project Status**: Step 6 of implementation completed  
**Technology Stack**: Go, Google Cloud Platform, Pulumi (Infrastructure as Code)  
**Architecture Pattern**: Serverless with API Gateway

## Architecture Overview

### System Components

1. **API Gateway** - Central entry point for all API requests
2. **Cloud Functions** (4 total):
   - `SetAPIKeyGCF` - Stores user API keys in Firestore
   - `RemoveAPIKeyGCF` - Removes API keys from Firestore
   - `GetAPIKeyStatusGCF` - Checks API key status without exposing the key
   - `ProxyToGenkitGCF` - Proxies AI requests to Genkit using user's API key
3. **Cloud Firestore** - Secure storage for encrypted API keys
4. **Firebase Authentication** - User authentication and authorization

### Data Flow

```
User Request → API Gateway → Cloud Function → Firestore/Genkit
                    ↓
              Authentication
                    ↓
              Authorization
```

## Implementation Details

### Directory Structure

```
interview-ai/
├── pulumi-gcp-byot-backend/      # Pulumi Infrastructure
│   ├── main.go                   # Infrastructure definition
│   ├── Pulumi.yaml               # Pulumi project configuration
│   └── openapi-spec.yaml         # API Gateway specification template
├── backends/byot-go-backend/     # Backend application code
│   ├── functions/                # Cloud Function implementations
│   │   ├── set-api-key/
│   │   ├── remove-api-key/
│   │   ├── get-api-key-status/
│   │   └── proxy-to-genkit/
│   └── go.mod                    # Go module dependencies
└── BYOT_BACKEND_DESIGN_DOCUMENT.md
```

### Infrastructure as Code (Pulumi)

#### Key Components Implemented:

1. **Deployment Bucket**
   ```go
   deploymentBucket, err := storage.NewBucket(ctx, "byot-deployment-bucket", &storage.BucketArgs{
       Name:     pulumi.String("byot-deployment-bucket-" + projectID),
       Location: pulumi.String("US"),
   })
   ```

2. **Cloud Functions Deployment**
   - Each function is archived and uploaded to GCS
   - Functions are deployed with proper source references
   - Example pattern:
   ```go
   functionArchive, _ := storage.NewBucketObject(ctx, "setApiKeyArchive", &storage.BucketObjectArgs{
       Bucket: deploymentBucket.Name,
       Name:   pulumi.String("set-api-key.zip"),
       Source: pulumi.NewFileArchive("../backends/byot-go-backend/functions/set-api-key"),
   })
   
   setAPIKeyFunction, _ := cloudfunctions.NewFunction(ctx, "setAPIKeyFunction", &cloudfunctions.FunctionArgs{
       SourceArchiveBucket: deploymentBucket.Name,
       SourceArchiveObject: functionArchive.Name,
       // ... other configuration
   })
   ```

3. **API Gateway Configuration**
   - Dynamic OpenAPI specification generation
   - URL injection for Cloud Function endpoints
   - Authentication integration

### API Endpoints

| Endpoint | Method | Function | Description |
|----------|--------|----------|-------------|
| `/api/key` | POST | SetAPIKeyGCF | Store user's API key |
| `/api/key` | DELETE | RemoveAPIKeyGCF | Remove user's API key |
| `/api/key/status` | GET | GetAPIKeyStatusGCF | Check if key exists |
| `/api/ai/*` | POST | ProxyToGenkitGCF | Proxy AI requests |

### Security Implementation

1. **Authentication**: Firebase Authentication required for all endpoints
2. **Authorization**: User can only access their own API keys
3. **Encryption**: API keys encrypted before storage in Firestore
4. **CORS**: Configured for allowed origins

## Work Completed

### Step 1-5 (Prior Work)
- Basic project structure setup
- Initial Pulumi configuration
- Backend code structure with handlers and middleware

### Step 6 (Current Implementation)
1. **Fixed OpenAPI Spec YAML Issues**
   - Resolved `%s` placeholder errors by quoting them as `"%s"`
   - Ensured proper YAML formatting for dynamic content

2. **Resolved Pulumi SDK Dependencies**
   - Updated to latest Pulumi Go SDK
   - Fixed missing `cfg.RequireSecretStr` method
   - Corrected GCP package imports

3. **Implemented Cloud Functions Deployment**
   - Created deployment bucket for function archives
   - Implemented proper source archive upload pattern
   - Successfully deployed all four Cloud Functions

4. **Dynamic Configuration**
   - OpenAPI spec populated with actual function URLs
   - API Gateway configured with generated specification

## Open Issues and Considerations

### 1. Environment Configuration
- **Issue**: Need to verify all required environment variables are properly set
- **Impact**: Functions may fail without proper configuration
- **Action Required**: Document and validate all required environment variables

### 2. API Key Encryption
- **Issue**: Encryption implementation details not fully specified
- **Impact**: Security vulnerability if keys stored in plaintext
- **Action Required**: Implement proper encryption/decryption in Cloud Functions

### 3. Error Handling
- **Issue**: Comprehensive error handling not implemented
- **Impact**: Poor user experience and difficult debugging
- **Action Required**: Add proper error responses and logging

### 4. Testing Infrastructure
- **Issue**: No automated tests for Cloud Functions
- **Impact**: Potential bugs in production
- **Action Required**: Implement unit and integration tests

### 5. Monitoring and Logging
- **Issue**: No centralized logging or monitoring setup
- **Impact**: Difficult to debug production issues
- **Action Required**: Configure Cloud Logging and monitoring alerts

### 6. Rate Limiting
- **Issue**: No rate limiting implemented
- **Impact**: Potential for abuse or excessive costs
- **Action Required**: Implement rate limiting at API Gateway level

### 7. Cost Optimization
- **Issue**: No cost controls or budgets set
- **Impact**: Unexpected cloud costs
- **Action Required**: Set up budget alerts and optimize function resources

### 8. Frontend Integration
- **Issue**: Frontend not yet integrated with new backend
- **Impact**: System not end-to-end functional
- **Action Required**: Update frontend to use new API endpoints

### 9. Documentation
- **Issue**: Limited API documentation
- **Impact**: Difficult for frontend developers to integrate
- **Action Required**: Generate comprehensive API documentation

### 10. Deployment Pipeline
- **Issue**: Manual deployment process
- **Impact**: Error-prone and time-consuming deployments
- **Action Required**: Set up CI/CD pipeline

## Next Steps

1. **Immediate Priority**:
   - Implement API key encryption in Cloud Functions
   - Add comprehensive error handling
   - Create integration tests

2. **Short-term Goals**:
   - Set up monitoring and logging
   - Document API endpoints
   - Implement rate limiting

3. **Long-term Goals**:
   - Automate deployment pipeline
   - Add performance monitoring
   - Implement cost optimization strategies

## Technical Debt

1. **Code Duplication**: Some common functionality duplicated across functions
2. **Configuration Management**: Environment-specific configs need better organization
3. **Testing Coverage**: Currently no automated tests
4. **Documentation**: Inline code documentation needs improvement

## Conclusion

The BYOT backend infrastructure is successfully deployed with core functionality in place. The serverless architecture provides scalability and cost-effectiveness. However, several production-readiness concerns need to be addressed before full deployment, particularly around security, monitoring, and testing. 