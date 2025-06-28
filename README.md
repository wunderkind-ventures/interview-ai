# WKV Interview AI Project


# Shortcuts:

### Create configurations for each environment
gcloud config configurations create interviewai-dev && gcloud config set project wkv-interviewai-dev --configuration=interviewai-dev
gcloud config configurations create interviewai-prod && gcloud config set project wkv-interviewai-prod --configuration=interviewai-prod
gcloud config configurations create interviewai-stage && gcloud config set project wkv-interviewai-stage --configuration=interviewai-stage

### Switch between environments easily:
gcloud config configurations activate interviewai-prod     # Production
gcloud config configurations activate interviewai-dev      # Development  
gcloud config configurations activate interviewai-stage  # Staging
gcloud config configurations activate wkv                  # Your original config

### List all configurations
gcloud config configurations list

### Check current active project
gcloud config get-value project