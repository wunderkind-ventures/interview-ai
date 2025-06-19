.PHONY: help install login init-dev init-staging init-prod deploy-dev deploy-staging deploy-prod preview-dev preview-staging preview-prod destroy-dev destroy-staging destroy-prod status clean

# Default target
help:
	@echo "InterviewAI GCP Infrastructure Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make install       - Install dependencies and initialize"
	@echo "  make login         - Login to Pulumi"
	@echo "  make init-dev      - Initialize development stack"
	@echo "  make init-staging  - Initialize staging stack"
	@echo "  make init-prod     - Initialize production stack"
	@echo "  make deploy-dev    - Deploy to development"
	@echo "  make deploy-staging- Deploy to staging"
	@echo "  make deploy-prod   - Deploy to production"
	@echo "  make preview-dev   - Preview development changes"
	@echo "  make preview-staging- Preview staging changes"
	@echo "  make preview-prod  - Preview production changes"
	@echo "  make status        - Show all stack status"
	@echo "  make clean         - Clean up build artifacts"
	@echo ""

install:
	@echo "Installing dependencies..."
	go mod tidy
	@echo "Dependencies installed successfully!"

login:
	@echo "Logging into Pulumi..."
	pulumi login

init-dev:
	@echo "Initializing development stack..."
	pulumi stack init dev --non-interactive || true
	pulumi stack select dev
	pulumi config set gcp:project wkv-interviewai-dev
	pulumi config set gcp:region us-central1
	pulumi config set gcp:zone us-central1-a
	@echo "Development stack initialized!"

init-staging:
	@echo "Initializing staging stack..."
	pulumi stack init staging --non-interactive || true
	pulumi stack select staging
	pulumi config set gcp:project wkv-interviewai-stg
	pulumi config set gcp:region us-central1
	pulumi config set gcp:zone us-central1-a
	@echo "Staging stack initialized!"

init-prod:
	@echo "Initializing production stack..."
	pulumi stack init prod --non-interactive || true
	pulumi stack select prod
	pulumi config set gcp:project interviewai-mzf86
	pulumi config set gcp:region us-central1
	pulumi config set gcp:zone us-central1-a
	@echo "Production stack initialized!"

init-all: init-dev init-staging init-prod
	@echo "All stacks initialized!"

preview-dev:
	@echo "Previewing development changes..."
	pulumi stack select dev
	pulumi preview

preview-staging:
	@echo "Previewing staging changes..."
	pulumi stack select staging
	pulumi preview

preview-prod:
	@echo "Previewing production changes..."
	pulumi stack select prod
	pulumi preview

deploy-dev:
	@echo "Deploying to development..."
	pulumi stack select dev
	pulumi up --yes
	@echo "Development deployment complete!"

deploy-staging:
	@echo "Deploying to staging..."
	pulumi stack select staging
	pulumi up --yes
	@echo "Staging deployment complete!"

deploy-prod:
	@echo "Deploying to production..."
	pulumi stack select prod
	@echo "⚠️  PRODUCTION DEPLOYMENT - Please review carefully!"
	pulumi up
	@echo "Production deployment complete!"

status:
	@echo "📊 Stack Status Summary:"
	@echo ""
	@echo "Development:"
	@pulumi stack select dev && pulumi stack output 2>/dev/null || echo "  Stack not deployed or no outputs"
	@echo ""
	@echo "Staging:"
	@pulumi stack select staging && pulumi stack output 2>/dev/null || echo "  Stack not deployed or no outputs"
	@echo ""
	@echo "Production:"
	@pulumi stack select prod && pulumi stack output 2>/dev/null || echo "  Stack not deployed or no outputs"
	@echo ""

destroy-dev:
	@echo "⚠️  DESTROYING DEVELOPMENT ENVIRONMENT"
	@echo "This will delete all resources in the development stack!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	pulumi stack select dev
	pulumi destroy --yes

destroy-staging:
	@echo "⚠️  DESTROYING STAGING ENVIRONMENT"
	@echo "This will delete all resources in the staging stack!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	pulumi stack select staging
	pulumi destroy --yes

destroy-prod:
	@echo "⚠️  DESTROYING PRODUCTION ENVIRONMENT"
	@echo "This will delete all resources in the production stack!"
	@echo "This is an extremely dangerous operation!"
	@read -p "Type 'DELETE PRODUCTION' to confirm: " confirm && [ "$$confirm" = "DELETE PRODUCTION" ] || exit 1
	pulumi stack select prod
	pulumi destroy

outputs-dev:
	pulumi stack select dev
	pulumi stack output

outputs-staging:
	pulumi stack select staging
	pulumi stack output

outputs-prod:
	pulumi stack select prod
	pulumi stack output

get-service-account-key-dev:
	@echo "Retrieving development service account key..."
	gcloud secrets versions access latest --secret="dev-service-account-key" --project="wkv-interviewai-dev"

get-service-account-key-staging:
	@echo "Retrieving staging service account key..."
	gcloud secrets versions access latest --secret="staging-service-account-key" --project="wkv-interviewai-stg"

clean:
	@echo "Cleaning build artifacts..."
	go clean
	rm -f *.log
	@echo "Clean complete!"

# Quick setup command for new users
setup: install login init-all
	@echo "🎉 Setup complete! You can now deploy with:"
	@echo "  make deploy-dev"
	@echo "  make deploy-staging"
	@echo "  make deploy-prod"

