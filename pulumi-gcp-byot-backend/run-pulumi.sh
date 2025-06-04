#!/bin/bash
# Wrapper script to run Pulumi with correct credentials for this project
# run-pulumi.sh
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/pulumi-sa-key.json"
STACK_NAME=$1
if [ -z "$STACK_NAME" ]; then
    echo "Usage: ./run-pulumi.sh <stack-name>"
    exit 1
fi
pulumi stack select "$STACK_NAME"
pulumi up -y
# echo "✅ Using service account for interview-ai project"
# pulumi "$@" 