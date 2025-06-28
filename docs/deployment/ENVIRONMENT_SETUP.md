# Environment Setup with Pulumi

This document describes how to set up a complete InterviewAI environment using Pulumi for infrastructure as code.

## Overview

The InterviewAI infrastructure is managed by two Pulumi projects:

1. **pulumi-gcp-infrastructure**: Foundation layer that sets up GCP projects, APIs, and Firebase (single environment per stack)
2. **pulumi-gcp-interviewai**: Application layer that deploys functions, services, and generates configurations

Each project uses separate stacks for different environments (dev, stage, prod).

## Prerequisites

- Pulumi CLI installed
- Google Cloud SDK (gcloud) installed and authenticated
- Access to the GCP projects (wkv-interviewai-dev, wkv-interviewai-stage)
- Node.js and npm installed

## Setup Steps

### 1. Deploy Infrastructure Stack

First, deploy the foundation infrastructure:

```bash
cd pulumi-gcp-catalyst/pulumi-gcp-infrastructure
pulumi stack select dev  # or stage/prod
pulumi up
```

This will:
- Enable required Google Cloud APIs
- Create infrastructure service accounts
- Set up Firebase projects
- Configure Firebase Authentication
- Export Firebase configuration values

### 2. Deploy Application Stack

Next, deploy the application infrastructure:

```bash
cd ../pulumi-gcp-interviewai
pulumi stack select wkv/interviewai-dev  # or stage/prod
pulumi up
```

This will:
- Deploy all Cloud Functions
- Set up API Gateway
- Configure monitoring and alerts
- Import Firebase config from infrastructure stack
- Generate environment configuration

### 3. Generate Local Environment File

After both stacks are deployed, generate your `.env.local` file:

```bash
cd ../..  # Back to project root
./scripts/generate-env-from-pulumi.sh dev  # or stage/prod
```

This script will:
- Pull configuration from Pulumi outputs
- Generate a complete `.env.local` file
- Include proper Firebase settings for the environment

### 4. Start Development

```bash
npm install
npm run dev
```

Your application will now use the correct Firebase configuration for the selected environment.

## Environment Configuration

### Firebase Configuration

Each environment has its own Firebase project with isolated:
- Authentication settings
- Firestore database
- Storage buckets
- User accounts

### Switching Environments

To switch between environments:

```bash
# Generate new .env.local for different environment
./scripts/generate-env-from-pulumi.sh stage

# Restart your development server
npm run dev
```

### Manual Configuration

If you need to manually check or update Firebase configuration:

```bash
# View all outputs for an environment
cd pulumi-gcp-catalyst/pulumi-gcp-interviewai
pulumi stack select wkv/interviewai-dev
pulumi stack output

# Get specific Firebase values (no environment prefix needed)
pulumi stack output firebaseApiKey
pulumi stack output firebaseAuthDomain
pulumi stack output firebaseProjectId
```

## Troubleshooting

### Authentication Issues

If you see authentication errors with wrong project IDs:
1. Check your `.env.local` file has the correct Firebase project ID
2. Regenerate the file: `./scripts/generate-env-from-pulumi.sh dev`
3. Clear browser cache and cookies for Firebase domains
4. Restart your development server

### Missing Configuration

If Pulumi outputs are missing:
1. Ensure both stacks are deployed
2. Check stack outputs: `pulumi stack output`
3. Verify the infrastructure stack exports Firebase values

### Stack Dependencies

The application stack depends on the infrastructure stack. Always deploy in order:
1. Infrastructure stack first
2. Application stack second

## Adding New Environments

To add a new environment (e.g., "test"):

1. Create a new stack configuration for infrastructure:
```bash
cd pulumi-gcp-catalyst/pulumi-gcp-infrastructure
pulumi stack init test
pulumi config set environment test
pulumi config set projectId wkv-interviewai-test
pulumi config set projectName "InterviewAI Test"
```

2. Create Pulumi config for application stack:
```bash
cd pulumi-gcp-catalyst/pulumi-gcp-interviewai
cp Pulumi.interviewai-dev.yaml Pulumi.interviewai-test.yaml
# Edit the file to update project ID and environment
```

3. Deploy both stacks for the new environment

## Security Notes

- Firebase configuration values are not sensitive and can be exposed in frontend code
- Service account keys are stored in Secret Manager
- API keys for services (Gemini, YouTube) should be managed through Secret Manager
- Never commit `.env.local` to version control