#!/bin/bash
batch_count=0

for batch_file in /tmp/api_batch_*; do
    ((batch_count++))
    echo "Processing batch $batch_count..."

    # Convert newlines to spaces for the API list
    apis=$(tr '\n' ' ' < "$batch_file")

    # Enable the batch of APIs
    gcloud services enable --project="$PROJECT_ID" $apis

    if [ $? -eq 0 ]; then
        echo "✅ Batch $batch_count completed successfully"
    else
        echo "❌ Batch $batch_count failed"
    fi

    # Clean up batch file
    rm "$batch_file"
done

echo "✅ All APIs processed for project: $PROJECT_ID"
EOF

chmod +x enable_apis.sh
