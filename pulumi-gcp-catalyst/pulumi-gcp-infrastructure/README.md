# InterviewAI GCP Infrastructure - Single Environment Setup

This Pulumi Go program sets up GCP infrastructure for a single InterviewAI environment at a time.

## ⚠️ Important: Current State

As of the latest update, this infrastructure stack:
- **DOES NOT** manage GCP projects (to avoid billing conflicts)
- **DOES NOT** manage billing associations (to prevent automatic downgrades)
- **ONLY** manages resources within existing projects
- **REQUIRES** manual project and billing setup

## Features

✅ **API Enablement**: Enables all required APIs for the environment  
✅ **Service Accounts**: Creates service accounts with appropriate IAM roles  
✅ **Secret Management**: Stores service account keys in Secret Manager  
✅ **Firebase Setup**: Configures Firebase, Firestore, and Authentication  
✅ **Single Environment Focus**: Each stack manages one environment  
✅ **Resource Protection**: Prevents accidental deletion of critical resources  
❌ **Project Management**: Removed to avoid conflicts  
❌ **Billing Management**: Removed to prevent automatic downgrades  

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- [Go](https://golang.org/doc/install) 1.21+ installed
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- **GCP projects must be created manually**
- **Billing must be enabled manually through GCP Console or Firebase Console**

## Manual Setup Required for New Projects

Before running this infrastructure stack, you must:

### 1. Create the GCP Project
```bash
gcloud projects create PROJECT_ID --name="PROJECT_NAME" --organization=ORGANIZATION_ID
```

### 2. Enable Billing
- Go to [GCP Console](https://console.cloud.google.com/billing)
- Link your billing account to the project
- **OR** use Firebase Console to upgrade to Blaze plan

### 3. Enable Firebase
- Go to [Firebase Console](https://console.firebase.google.com)
- Add your project to Firebase
- Initialize Firebase Storage manually (if needed)

### 4. Set Default App Engine Region (Optional)
```bash
gcloud app create --project=PROJECT_ID --region=us-central
```

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
pulumi stack init wkv/catalyst-dev
pulumi config set gcp:project wkv-interviewai-dev
pulumi config set gcp:region us-central1
pulumi config set environment dev
pulumi config set projectId wkv-interviewai-dev
pulumi config set projectName "InterviewAI Development"

# Create staging stack
pulumi stack init wkv/catalyst-stage
pulumi config set gcp:project wkv-interviewai-stage
pulumi config set gcp:region us-central1
pulumi config set environment stage
pulumi config set projectId wkv-interviewai-stage
pulumi config set projectName "InterviewAI Staging"

# Create production stack (for existing project management)
pulumi stack init wkv/catalyst-prod
pulumi config set gcp:project interviewai-mzf86
pulumi config set gcp:region us-central1
pulumi config set environment prod
pulumi config set projectId interviewai-mzf86
pulumi config set projectName "InterviewAI Production"
```

### 4. Deploy Infrastructure

```bash
# Deploy to development
pulumi stack select wkv/catalyst-dev
pulumi up

# Deploy to staging
pulumi stack select wkv/catalyst-stage
pulumi up

# Deploy to production (if managing existing project)
pulumi stack select wkv/catalyst-prod
pulumi up
```

## What Gets Created

### For Each Environment:

1. **Enabled APIs** (40+ APIs matching production)
   - AI Platform, Generative Language API
   - Cloud Functions, Cloud Run, Cloud Build
   - Firebase services (Auth, Firestore, Hosting, etc.)
   - Secret Manager, IAM, Monitoring
   - And many more...

3. **Service Account**:
   - Environment-specific naming
   - Comprehensive IAM roles
   - JSON key generation

3. **IAM Roles Assigned**:
   - `roles/cloudfunctions.admin`
   - `roles/firebase.admin`
   - `roles/resourcemanager.projectIamAdmin`
   - `roles/secretmanager.admin`
   - `roles/aiplatform.user`

4. **Secret Manager**:
   - Service account keys stored securely
   - Environment-specific secret naming

## Configuration

### Required Configuration Values

Each stack requires these configuration values:

- `environment`: The environment name (dev, stage, prod)
- `projectId`: The GCP project ID (must exist)
- `projectName`: Human-readable project name (optional, defaults to "InterviewAI {environment}")

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

- `project_id`: The GCP project ID
- `environment`: The environment name
- `service_account_email`: Service account email address
- `service_account_name`: Full service account resource name
- `service_account_key`: Service account JSON key (only for dev/stage)
- `firebase_*`: Various Firebase configuration values
- `auth-config-ready`: Identity Platform configuration status
- `firebase-project-init`: Firebase project initialization status

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

1. Create the GCP project manually (see Manual Setup section)
2. Create a new Pulumi stack:
   ```bash
   pulumi stack init wkv/catalyst-YOUR_ENV
   pulumi config set gcp:project YOUR-PROJECT-ID
   pulumi config set gcp:region YOUR-REGION
   pulumi config set environment YOUR_ENV
   pulumi config set projectId YOUR-PROJECT-ID
   pulumi config set projectName "Your Project Name"
   ```

## Troubleshooting

### Common Issues

1. **Billing Disabled Error**: 
   - Manually enable billing in GCP Console
   - Do NOT use Pulumi to manage billing (causes conflicts)
2. **Firebase Storage 404 Error**: 
   - Initialize Firebase Storage manually in Firebase Console
   - Click "Get Started" on Storage page
3. **API Quota**: Some APIs may have quota limits during bulk enablement
4. **Permissions**: Ensure your gcloud account has necessary roles
5. **Duplicate Resources**: Run `pulumi refresh` if state gets out of sync

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
✅ **Manage billing manually** to avoid automatic downgrades  
✅ **Create projects manually** before running infrastructure  
✅ **Initialize Firebase features** through Firebase Console when needed

## Known Issues and Limitations

1. **Firebase Storage**: Must be initialized manually in Firebase Console
2. **Billing Management**: Removed from Pulumi to prevent conflicts with Firebase
3. **Project Management**: Removed to avoid state conflicts
4. **App Engine**: Not created (conflicts with existing Firestore)

## Migration Notes

If upgrading from a previous version that managed projects/billing:
1. Ensure billing is enabled manually
2. Remove project resources from state: `pulumi state delete <project-resource-urn> --force`
3. Remove billing resources from state
4. Update your Pulumi configuration files to remove billing/org settings  

## Support

For issues or questions:
1. Check the Pulumi logs: `pulumi logs`
2. Review GCP quotas and billing
3. Ensure proper authentication: `gcloud auth list`

