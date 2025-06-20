# Pulumi RAG Infrastructure Changes Summary

## Files Modified/Created

### 1. **New Pulumi Module**: `functions/rag.go`
- **Purpose**: Deploys all RAG-related infrastructure components
- **Components**:
  - Content Scraper Function (Gen2)
  - Vector Search Function (Gen2) 
  - Content Indexer Function (Gen2)
  - Pub/Sub topic and subscription for content indexing
  - Secret Manager secrets for API keys
  - IAM permissions setup

### 2. **Updated Main Deployment**: `main.go`
- **Added**: Import for new RAG functions module
- **Added**: RAG infrastructure deployment call
- **Added**: RAG IAM permissions setup
- **Updated**: API Gateway configuration to include RAG endpoints
- **Added**: RAG resource URL exports

### 3. **Updated Configuration**: `config/config.go`
- **Changed**: OpenAPI spec path to use new RAG-enabled specification

### 4. **New OpenAPI Specification**: `openapi-spec-rag.yaml`
- **Added**: RAG endpoint definitions
- **Endpoints**:
  - `/api/content/scrape` - Content scraping
  - `/api/content/search` - Content search
  - `/api/vector/search` - Semantic search
  - `/api/vector/upsert` - Vector indexing
  - `/api/vector/similar` - Similar content finding

## Infrastructure Resources Deployed

### **Cloud Functions (Gen2)**
```
ContentScraper-{env}:
  - Entry Point: ScrapeContentGCF
  - Runtime: go122
  - Memory: 1GB (for processing large content)
  - Timeout: 540s (9 minutes)
  
VectorSearch-{env}:
  - Entry Point: VectorSearchGCF
  - Runtime: go122
  - Memory: 512MB
  - Timeout: 60s
  
ContentIndexer-{env}:
  - Entry Point: ContentIndexerGCF
  - Runtime: go122
  - Memory: 512MB
  - Timeout: 300s (5 minutes)
```

### **Pub/Sub Resources**
```
Topic: content-indexing-{env}
Subscription: content-indexing-subscription-{env}
  - Push endpoint: ContentIndexer function
  - Ack deadline: 600s
  - Retry policy: 10s min, 600s max backoff
```

### **Secret Manager**
```
Secrets:
  - youtube-api-key-{env}
  - embedding-api-key-{env}
  
Permissions:
  - Function service account granted secretAccessor role
```

### **IAM Permissions Added**
```
Secret Manager:
  - roles/secretmanager.secretAccessor for function SA

Pub/Sub:
  - roles/pubsub.publisher for function SA

Firestore:
  - Uses existing roles/datastore.user permissions
```

## API Gateway Integration

### **Updated Routes** (7 backend functions total)
```
Existing BYOK Functions (1-4):
1. SetAPIKeyGCF
2. RemoveAPIKeyGCF  
3. GetAPIKeyStatusGCF
4. ProxyToGenkitGCF

Document Processing (5):
5. ParseResume

New RAG Functions (6-7):
6. ContentScraper (handles /api/content/*)
7. VectorSearch (handles /api/vector/*)
```

### **New API Endpoints**
```
Content Management:
- POST /api/content/scrape
- GET  /api/content/search

Vector Operations:
- POST /api/vector/search
- POST /api/vector/upsert  
- GET  /api/vector/similar
```

## Environment Variables

### **Content Scraper Function**
```
NEXTJS_BASE_URL: {cfg.NextjsBaseUrl}
DEFAULT_GEMINI_API_KEY: {cfg.DefaultGeminiKey}
INDEXING_TOPIC_NAME: {indexingTopic.Name}
```

### **Vector Search Function**  
```
VERTEX_AI_LOCATION: {cfg.GcpRegion}
VERTEX_AI_INDEX_ENDPOINT_ID: "" (manual configuration required)
```

### **Content Indexer Function**
```
INDEXING_TOPIC_NAME: {indexingTopic.Name}  
VECTOR_SEARCH_URL: {vectorSearchFunction.Url}
```

## Exported Outputs

### **New Pulumi Exports**
```
contentScraperFunctionUrl-{env}
vectorSearchFunctionUrl-{env}
contentIndexerFunctionUrl-{env}
indexingTopicName-{env}
indexingSubscriptionName-{env}
youtubeAPISecretName-{env}
embeddingAPISecretName-{env}
```

### **Manual Configuration Required**
```
vertexAISetupInstructions: 
  - Detailed gcloud commands for Vertex AI Vector Search setup
  - Index creation, endpoint deployment
  - Environment variable updates
```

## Deployment Commands

### **Deploy Infrastructure**
```bash
# Development
cd pulumi-gcp-interviewai/catalyst-interviewai
pulumi stack select catalyst-dev  
pulumi up

# Production
pulumi stack select catalyst-prod
pulumi up
```

### **Set API Keys** (Before deployment)
```bash
# YouTube API Key
echo "your-youtube-api-key" | gcloud secrets create youtube-api-key-dev --data-file=-

# Embedding API Key  
echo "your-embedding-api-key" | gcloud secrets create embedding-api-key-dev --data-file=-
```

### **Post-Deployment Setup** (Manual)
```bash
# Create Vertex AI Vector Search Index
gcloud ai indexes create --display-name="interview-content-index-dev" --region=us-central1

# Create Index Endpoint
gcloud ai index-endpoints create --display-name="interview-content-endpoint-dev" --region=us-central1

# Deploy Index to Endpoint
gcloud ai index-endpoints deploy-index {ENDPOINT_ID} --index={INDEX_ID} --region=us-central1
```

## Architecture Flow

```
User Request → API Gateway → Cloud Function → Processing
                ↓
Content Scraper → Embedding Generation → Firestore Storage
                ↓
Pub/Sub Message → Content Indexer → Vector Database
                ↓
Vector Search ← Semantic Query ← Enhanced AI Flows
```

## Resource Dependencies

```
Storage Bucket (existing) → Function Source Code
Service Account (existing) → Function Execution  
Secret Manager → API Key Storage
Pub/Sub Topic → Content Indexer Trigger
Firestore (existing) → Content Storage
API Gateway (existing) → Function Routing
```

## Cost Implications

### **New Monthly Costs** (Approximate)
```
Cloud Functions Gen2:
  - 3 functions × $0.0000004/100ms × usage
  
Pub/Sub:  
  - $0.0006/1K messages
  
Secret Manager:
  - $0.06/secret/month × 2 secrets = $0.12
  
Vertex AI Vector Search:
  - Index: ~$0.50/GB/month
  - Queries: ~$0.01/1K queries
  
API Gateway:
  - $3.00/million calls (existing)
```

### **Optimization Notes**
- Functions use Gen2 for better cold start performance
- Pub/Sub ensures reliable async processing  
- Secret Manager provides secure API key storage
- Firestore leverages existing database setup

This infrastructure provides a production-ready RAG system that integrates seamlessly with your existing Interview AI platform while maintaining security, scalability, and cost efficiency.