# InterviewAI GCP Infrastructure

This Pulumi Go program replicates your GCP project configurations across multiple environments (dev, staging, production).

## Features

✅ **Project Management**: Creates and configures GCP projects  
✅ **API Enablement**: Enables all APIs from your production setup  
✅ **Service Accounts**: Creates service accounts with appropriate IAM roles  
✅ **Secret Management**: Stores service account keys in Secret Manager  
✅ **Multi-Environment**: Supports dev, staging, and production environments  
✅ **Resource Protection**: Prevents accidental deletion of critical resources  

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- [Go](https://golang.org/doc/install) 1.21+ installed
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- GCP projects created (if not using project creation feature)
- Billing account linked to projects

## Quick Start

### 1. Initialize Dependencies

```bash
cd pulumi-gcp-catalyst
go mod tidy
```

### 2. Login to Pulumi

```bash
pulumi login
```

### 3. Create and Configure Stacks

```bash
# Create development stack
pulumi stack init dev
pulumi config set gcp:project wkv-interviewai-dev
pulumi config set gcp:region us-central1

# Create staging stack
pulumi stack init staging
pulumi config set gcp:project wkv-interviewai-stg
pulumi config set gcp:region us-central1

# Create production stack (for existing project management)
pulumi stack init prod
pulumi config set gcp:project interviewai-mzf86
pulumi config set gcp:region us-central1
```

### 4. Deploy Infrastructure

```bash
# Deploy to development
pulumi stack select dev
pulumi up

# Deploy to staging
pulumi stack select staging
pulumi up

# Deploy to production (if managing existing project)
pulumi stack select prod
pulumi up
```

## What Gets Created

### For Each Environment:

1. **GCP Project** (if it doesn't exist)
   - Proper naming and billing account linkage
   - Protection against accidental deletion

2. **Enabled APIs** (40+ APIs matching production):
   - AI Platform, Generative Language API
   - Cloud Functions, Cloud Run, Cloud Build
   - Firebase services (Auth, Firestore, Hosting, etc.)
   - Secret Manager, IAM, Monitoring
   - And many more...

3. **Service Account**:
   - Environment-specific naming
   - Comprehensive IAM roles
   - JSON key generation

4. **IAM Roles Assigned**:
   - `roles/cloudfunctions.admin`
   - `roles/firebase.admin`
   - `roles/resourcemanager.projectIamAdmin`
   - `roles/secretmanager.admin`
   - `roles/aiplatform.user`

5. **Secret Manager**:
   - Service account keys stored securely
   - Environment-specific secret naming

## Configuration

### Environment Variables

The program uses these project configurations:

```go
projects := []ProjectConfig{
    {ID: "wkv-interviewai-dev", Name: "InterviewAI Development", Environment: "dev"},
    {ID: "wkv-interviewai-stg", Name: "InterviewAI Staging", Environment: "staging"},
}
```

### Billing Account

Update the billing account ID in `main.go`:

```go
billingAccount := "01F9C0-CF9DFB-DB01DF" // Your billing account ID
```

## Usage Examples

### Deploy to Specific Environment

```bash
# Switch to development environment
pulumi stack select dev
pulumi up

# Check outputs
pulumi stack output
```

### Retrieve Service Account Key

```bash
# Get service account email
pulumi stack output dev_service_account_email

# Retrieve key from Secret Manager
gcloud secrets versions access latest --secret="dev-service-account-key" --project="wkv-interviewai-dev"
```

### Destroy Infrastructure

```bash
# Destroy development environment (careful!)
pulumi stack select dev
pulumi destroy
```

## Stack Outputs

Each stack exports these values:

- `{env}_project_id`: The GCP project ID
- `{env}_service_account_email`: Service account email address
- `{env}_service_account_name`: Full service account resource name

## Security Considerations

🔒 **Resource Protection**: Critical resources are protected from deletion  
🔒 **Secret Storage**: Service account keys are stored in Secret Manager  
🔒 **IAM Least Privilege**: Service accounts have minimal required permissions  
🔒 **API Management**: APIs are preserved during stack destruction  

## Customization

### Adding APIs

Add to the `enabledApis` slice in `main.go`:

```go
enabledApis := []string{
    // existing APIs...
    "newapi.googleapis.com",
}
```

### Adding IAM Roles

Add to the `serviceAccountRoles` slice:

```go
serviceAccountRoles := []string{
    // existing roles...
    "roles/your.new.role",
}
```

### Adding Environments

Add to the `projects` slice:

```go
projects := []ProjectConfig{
    // existing projects...
    {ID: "your-project-id", Name: "Your Project Name", Environment: "your-env"},
}
```

## Troubleshooting

### Common Issues

1. **Billing Account Error**: Ensure billing is enabled for target projects
2. **API Quota**: Some APIs may have quota limits during bulk enablement
3. **Permissions**: Ensure your gcloud account has Project Creator and Billing roles
4. **Existing Resources**: The program handles existing projects gracefully

### Debug Commands

```bash
# Check current stack configuration
pulumi config

# Preview changes without applying
pulumi preview

# View detailed logs
pulumi up --logtostderr -v=3
```

## Best Practices

✅ **Use separate stacks** for each environment  
✅ **Test in dev/staging** before applying to production  
✅ **Review changes** with `pulumi preview` before deploying  
✅ **Backup state** regularly (Pulumi handles this automatically with cloud backends)  
✅ **Monitor costs** across all environments  

## Support

For issues or questions:
1. Check the Pulumi logs: `pulumi logs`
2. Review GCP quotas and billing
3. Ensure proper authentication: `gcloud auth list`

