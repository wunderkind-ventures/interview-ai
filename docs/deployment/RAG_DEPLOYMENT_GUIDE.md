# RAG System Deployment Guide

## Prerequisites

1. **Existing Infrastructure**: Ensure your current Catalyst backend is deployed and working
2. **API Keys**: Obtain YouTube Data API key and embedding provider API key (Google AI or OpenAI)
3. **Permissions**: Ensure your GCP service account has the necessary permissions

## Configuration Steps

### 1. Set API Keys in Secret Manager

Before deploying, you need to store the API keys in Google Secret Manager:

```bash
# Set the YouTube Data API key
echo "your-youtube-api-key" | gcloud secrets create youtube-api-key-dev --data-file=-

# Set the embedding API key (Google AI or OpenAI)
echo "your-embedding-api-key" | gcloud secrets create embedding-api-key-dev --data-file=-
```

For other environments (staging, prod), replace `-dev` with `-stg` or `-prod`.

### 2. Update Pulumi Configuration

Add any new configuration values to your Pulumi stack:

```bash
# Navigate to Pulumi directory
cd pulumi-gcp-interviewai/catalyst-interviewai

# Set environment (if not already set)
pulumi config set catalyst-gcp-infra:environment dev
```

### 3. Deploy the Infrastructure

Deploy the updated infrastructure with RAG components:

```bash
# Deploy to development environment
pulumi up

# For production deployment
pulumi stack select catalyst-prod
pulumi up
```

## Post-Deployment Configuration

### 1. Vertex AI Vector Search Setup

After deployment, you'll need to manually set up Vertex AI Vector Search (not yet supported in Pulumi):

```bash
# Create a Vector Search Index
gcloud ai indexes create \
  --display-name="interview-content-index-dev" \
  --description="Vector index for interview content RAG" \
  --metadata-schema-uri="gs://vertex-ai-restricted/metadata/general_text_embedding_schema.json" \
  --region=us-central1

# Create an Index Endpoint
gcloud ai index-endpoints create \
  --display-name="interview-content-endpoint-dev" \
  --description="Endpoint for interview content vector search" \
  --region=us-central1

# Deploy the index to the endpoint (get IDs from previous commands)
gcloud ai index-endpoints deploy-index INDEX_ENDPOINT_ID \
  --deployed-index-id="interview-content-deployed" \
  --display-name="Interview Content Index" \
  --index=INDEX_ID \
  --region=us-central1
```

### 2. Update Function Environment Variables

Update the VectorSearch function with the Vertex AI endpoint ID:

```bash
# Get the function name from Pulumi outputs
FUNCTION_NAME=$(pulumi stack output vectorSearchFunctionName-dev)

# Update the environment variable
gcloud functions deploy $FUNCTION_NAME \
  --update-env-vars VERTEX_AI_INDEX_ENDPOINT_ID=your-endpoint-id \
  --region=us-central1
```

### 3. Test the Deployment

Test each component to ensure it's working correctly:

```bash
# Test Content Scraper
curl -X POST "https://your-gateway-url/api/content/scrape" \
  -H "Authorization: Bearer your-firebase-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=example",
    "contentType": "youtube"
  }'

# Test Vector Search
curl -X POST "https://your-gateway-url/api/vector/search" \
  -H "Authorization: Bearer your-firebase-token" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "system design interview",
    "limit": 5
  }'
```

## Monitoring and Troubleshooting

### 1. Check Function Logs

Monitor the deployment and function execution:

```bash
# Check Content Scraper logs
gcloud functions logs read ContentScraper-dev --region=us-central1

# Check Vector Search logs
gcloud functions logs read VectorSearch-dev --region=us-central1

# Check Content Indexer logs
gcloud functions logs read ContentIndexer-dev --region=us-central1
```

### 2. Verify Pub/Sub Topic

Ensure the Pub/Sub topic is created and configured:

```bash
# List topics
gcloud pubsub topics list

# List subscriptions
gcloud pubsub subscriptions list
```

### 3. Check Secret Manager Access

Verify that secrets are accessible:

```bash
# Test secret access
gcloud secrets versions access latest --secret="youtube-api-key-dev"
gcloud secrets versions access latest --secret="embedding-api-key-dev"
```

## Environment-Specific Deployment

### Development Environment
```bash
pulumi stack select catalyst-dev
pulumi up
```

### Staging Environment
```bash
pulumi stack select catalyst-stg
pulumi config set catalyst-gcp-infra:environment stg
pulumi up
```

### Production Environment
```bash
pulumi stack select catalyst-prod
pulumi config set catalyst-gcp-infra:environment prod
pulumi up
```

## Rollback Procedure

If you need to rollback the deployment:

```bash
# Rollback to previous Pulumi state
pulumi history
pulumi update --target-stack-state <previous-update-id>

# Or destroy only RAG resources (careful!)
pulumi destroy --target urn:pulumi:dev::catalyst-interviewai::catalyst:function:Gen2Function::ContentScraper-dev
```

## Cost Optimization

### 1. Function Configuration
- Content Scraper: Memory 1GB, Timeout 540s
- Vector Search: Memory 512MB, Timeout 60s
- Content Indexer: Memory 512MB, Timeout 300s

### 2. Monitoring Costs
- Set up billing alerts for unexpected usage
- Monitor function execution metrics
- Use Vertex AI Vector Search efficiently

### 3. Storage Optimization
- Regular cleanup of old embeddings
- Compress large content where possible
- Use lifecycle policies for storage buckets

## Deployed Resources

After successful deployment, you'll have:

### Cloud Functions
- `ContentScraper-{env}`: Scrapes and processes content
- `VectorSearch-{env}`: Provides semantic search capabilities
- `ContentIndexer-{env}`: Indexes content for vector search

### Pub/Sub
- `content-indexing-{env}`: Topic for triggering indexing
- `content-indexing-subscription-{env}`: Subscription for indexer function

### Secret Manager
- `youtube-api-key-{env}`: YouTube Data API key
- `embedding-api-key-{env}`: Embedding generation API key

### API Gateway Routes
- `/api/content/scrape`: Content scraping endpoint
- `/api/content/search`: Content search endpoint
- `/api/vector/search`: Semantic search endpoint
- `/api/vector/upsert`: Vector indexing endpoint
- `/api/vector/similar`: Similar content endpoint

### IAM Permissions
- Secret Manager access for function service account
- Pub/Sub publisher permissions
- Firestore read/write permissions
- Vertex AI access permissions

## Next Steps

1. **Populate Content**: Start scraping high-quality interview content
2. **AI Integration**: Update AI flows to use enhanced retrieval tool
3. **Performance Tuning**: Monitor and optimize based on usage patterns
4. **Scaling**: Consider upgrading to production vector database solutions

The RAG system is now deployed and ready to enhance your Interview AI platform with real-world content and semantic search capabilities!