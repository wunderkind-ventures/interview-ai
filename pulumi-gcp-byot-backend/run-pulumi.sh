#!/bin/bash
# Wrapper script to run Pulumi with correct credentials for this project

export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-sa-key.json"
echo "✅ Using service account for interview-ai project"
pulumi "$@" 