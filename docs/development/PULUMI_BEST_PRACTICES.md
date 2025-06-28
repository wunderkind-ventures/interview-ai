# Pulumi Best Practices for InterviewAI

## Overview

This document outlines the best practices and architectural decisions for managing Pulumi infrastructure in the InterviewAI project.

## Stack Architecture

### Current Structure

We maintain **two separate Pulumi stacks** for optimal separation of concerns:

1. **Infrastructure Stack** (`/pulumi-gcp-infrastructure/`)
   - Core GCP project setup
   - Service accounts and IAM roles
   - API enablement (manual)
   - Secret management

2. **Application Stack** (`/pulumi-gcp-catalyst-backend/`)
   - Cloud Functions
   - API Gateway
   - Storage buckets
   - Monitoring and alerting
   - Development tunnels

### Why This Separation?

1. **Risk Management**: Core infrastructure changes are isolated from application deployments
2. **Deployment Cycles**: Infrastructure changes less frequently than application code
3. **Team Responsibilities**: Different teams can manage different aspects
4. **Resource Dependencies**: Clear dependency chain between foundational and application resources

## Module Structure

### Infrastructure Stack Modules

```
/pulumi-gcp-infrastructure/pulumi-gcp-infrastructure/
├── main.go                 # Entry point and orchestration
├── iam/
│   └── service_accounts.go # Service account management
├── project/
│   └── apis.go            # API management (future)
└── go.mod                 # Module dependencies
```

### Application Stack Modules

```
/pulumi-gcp-catalyst-backend/catalyst-backend/
├── main.go                 # Entry point and orchestration
├── config/                 # Configuration management
├── functions/              # Cloud Functions
│   ├── component/         # Reusable function components
│   ├── byok.go           # BYOK functions
│   └── rag.go            # RAG infrastructure
├── gateway/               # API Gateway setup
├── iam/                   # Application-specific IAM
├── monitoring/            # Monitoring and alerting
├── storage/               # Storage buckets
├── tunnel/                # Development tunnel setup
└── utils/                 # Shared utilities
```

## Best Practices

### 1. Modular Design

- **Single Responsibility**: Each module handles one specific concern
- **Reusable Components**: Create component resources for repeated patterns
- **Clear Interfaces**: Well-defined function signatures and return types

### 2. Resource Naming

- **Consistent Prefixes**: Use environment-specific prefixes (`dev-`, `staging-`, `prod-`)
- **Descriptive Names**: Include resource type and purpose in names
- **Avoid Conflicts**: Use unique identifiers to prevent resource conflicts

### 3. Configuration Management

```go
type Config struct {
    Environment      string
    GcpProject      string
    GcpRegion       string
    NextjsBaseUrl   string
    // ... other config fields
}
```

### 4. Error Handling

- **Propagate Errors**: Always return and handle errors appropriately
- **Context Information**: Include meaningful error messages
- **Fail Fast**: Stop execution on critical errors

### 5. Resource Dependencies

- **Explicit Dependencies**: Use `pulumi.DependsOn()` when implicit dependencies aren't sufficient
- **Output Chaining**: Use outputs to create proper dependency chains
- **Stack References**: Use stack references to share data between stacks

## Stack References

### Sharing Data Between Stacks

The infrastructure stack exports values that the application stack consumes:

**Infrastructure Stack Exports:**
```go
ctx.Export("dev_project_id", pulumi.String(projectID))
ctx.Export("dev_service_account_email", serviceAccount.Email)
ctx.Export("dev_service_account_name", serviceAccount.Name)
```

**Application Stack Imports:**
```go
infraStack := pulumi.NewStackReference(ctx, "infrastructure", &pulumi.StackReferenceArgs{
    Name: pulumi.String("organization/infrastructure/dev"),
})

projectID := infraStack.GetOutput(pulumi.String("dev_project_id"))
```

## Deployment Workflow

### 1. Infrastructure First

```bash
cd pulumi-gcp-catalyst/pulumi-gcp-catalyst
pulumi up
```

### 2. Application Second

```bash
cd pulumi-gcp-interviewai/catalyst-interviewai
pulumi up
```

### 3. Environment-Specific Deployments

Use stack configurations for environment-specific settings:

```bash
pulumi config set gcp:project wkv-interviewai-dev
pulumi config set environment dev
```

## Security Considerations

### 1. Service Account Management

- **Principle of Least Privilege**: Grant only necessary permissions
- **Environment Isolation**: Separate service accounts per environment
- **Key Rotation**: Implement regular key rotation policies

### 2. Secret Management

- **Google Secret Manager**: Store sensitive configuration in Secret Manager
- **No Hardcoded Secrets**: Never commit secrets to version control
- **Environment Variables**: Use environment variables for runtime configuration

### 3. IAM Best Practices

- **Role-Based Access**: Use predefined roles when possible
- **Custom Roles**: Create custom roles for specific needs
- **Regular Audits**: Periodically review and audit permissions

## Testing and Validation

### 1. Preview Before Deploy

Always run `pulumi preview` before `pulumi up`:

```bash
pulumi preview --diff
```

### 2. Resource Validation

- **Naming Conventions**: Validate resource names follow conventions
- **Required Tags**: Ensure all resources have required tags/labels
- **Policy Compliance**: Check against organizational policies

### 3. Integration Testing

- **Smoke Tests**: Basic functionality tests after deployment
- **End-to-End Tests**: Full workflow validation
- **Rollback Testing**: Verify rollback procedures work

## Monitoring and Observability

### 1. Pulumi State Management

- **Backend Storage**: Use cloud storage for state files
- **State Locking**: Ensure state locking is enabled
- **Backup Strategy**: Regular state file backups

### 2. Deployment Monitoring

- **Deployment Logs**: Monitor deployment logs for issues
- **Resource Health**: Check resource health after deployments
- **Cost Monitoring**: Track resource costs and optimize

## Troubleshooting

### Common Issues

1. **Import Path Errors**: Ensure go.mod module name matches import paths
2. **Resource Conflicts**: Use unique resource names across environments
3. **Permission Errors**: Verify service account has necessary permissions
4. **State Corruption**: Keep state file backups for recovery

### Debug Techniques

- **Verbose Logging**: Use `--logtostderr -v=9` for detailed logs
- **Resource Inspection**: Use `pulumi stack export` to inspect state
- **Targeted Updates**: Use `--target` to update specific resources

## Migration Guide

### From Monolithic to Modular

1. **Extract Modules**: Move related resources to separate modules
2. **Update Imports**: Fix import paths and dependencies
3. **Test Incrementally**: Deploy and test each module separately
4. **Refactor Gradually**: Avoid big-bang migrations

### Stack Splitting

1. **Identify Boundaries**: Determine logical separation points
2. **Export/Import Data**: Set up stack references
3. **Deploy Order**: Establish deployment dependencies
4. **Validate Connectivity**: Ensure stacks communicate properly

## Future Improvements

### Planned Enhancements

1. **Component Resources**: Create more reusable components
2. **Policy as Code**: Implement Pulumi CrossGuard policies
3. **Automated Testing**: Add comprehensive test suites
4. **CI/CD Integration**: Automate deployments via pipelines

### Architecture Evolution

- **Multi-Region Support**: Extend to multiple GCP regions
- **Disaster Recovery**: Implement cross-region backup strategies
- **Cost Optimization**: Implement automated cost optimization policies
- **Compliance**: Add compliance and governance frameworks

## Conclusion

This modular approach provides:

- **Maintainability**: Easier to understand and modify
- **Scalability**: Can grow with project needs
- **Reliability**: Reduced risk through separation of concerns
- **Team Productivity**: Multiple teams can work independently

Following these practices ensures a robust, scalable, and maintainable infrastructure codebase for the InterviewAI platform. 