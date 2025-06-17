#!/bin/bash

set -e

echo "🚀 InterviewAI GCP Infrastructure Setup"
echo "======================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if Pulumi is installed
if ! command -v pulumi &> /dev/null; then
    echo "❌ Pulumi CLI not found. Please install it first:"
    echo "   https://www.pulumi.com/docs/get-started/install/"
    exit 1
fi

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run:"
    echo "   gcloud auth login"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go not found. Please install Go 1.21+ first:"
    echo "   https://golang.org/doc/install"
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Install dependencies
echo "📦 Installing Go dependencies..."
go mod tidy
echo "✅ Dependencies installed!"
echo ""

# Login to Pulumi (if not already logged in)
echo "🔐 Checking Pulumi authentication..."
if ! pulumi whoami &> /dev/null; then
    echo "🔐 Logging into Pulumi..."
    pulumi login
else
    echo "✅ Already logged into Pulumi as $(pulumi whoami)"
fi
echo ""

# Initialize stacks
echo "🏗️  Initializing Pulumi stacks..."

# Development stack
echo "Creating development stack..."
pulumi stack init dev --non-interactive 2>/dev/null || echo "Development stack already exists"
pulumi stack select dev
pulumi config set gcp:project wkv-interviewai-dev
pulumi config set gcp:region us-central1
pulumi config set gcp:zone us-central1-a
echo "✅ Development stack configured"

# Staging stack
echo "Creating staging stack..."
pulumi stack init staging --non-interactive 2>/dev/null || echo "Staging stack already exists"
pulumi stack select staging
pulumi config set gcp:project wkv-interviewai-stg
pulumi config set gcp:region us-central1
pulumi config set gcp:zone us-central1-a
echo "✅ Staging stack configured"

# Production stack
echo "Creating production stack..."
pulumi stack init prod --non-interactive 2>/dev/null || echo "Production stack already exists"
pulumi stack select prod
pulumi config set gcp:project interviewai-mzf86
pulumi config set gcp:region us-central1
pulumi config set gcp:zone us-central1-a
echo "✅ Production stack configured"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Review the configuration in main.go"
echo "  2. Preview changes: make preview-dev"
echo "  3. Deploy to development: make deploy-dev"
echo "  4. Deploy to staging: make deploy-staging"
echo "  5. Review and deploy to production: make deploy-prod"
echo ""
echo "💡 Quick commands:"
echo "  make help          - Show all available commands"
echo "  make status        - Check status of all environments"
echo "  make outputs-dev   - Show development outputs"
echo ""
echo "🔍 Current Pulumi stacks:"
pulumi stack ls

