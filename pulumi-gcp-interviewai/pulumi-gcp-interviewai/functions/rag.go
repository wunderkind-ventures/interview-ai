package functions

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/cloudfunctionsv2"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/pubsub"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/secretmanager"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/serviceaccount"
	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/storage"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"

	"catalyst-backend/config"
	"catalyst-backend/functions/component"
)

// RAGInfrastructure represents all RAG-related infrastructure
type RAGInfrastructure struct {
	ContentScraperFunction *component.Gen2Function
	VectorSearchFunction   *component.Gen2Function
	ContentIndexerFunction *component.Gen2Function
	IndexingTopic          *pubsub.Topic
	IndexingSubscription   *pubsub.Subscription
	YouTubeAPISecret       *secretmanager.Secret
	EmbeddingAPISecret     *secretmanager.Secret
}

// DeployRAGInfrastructure deploys all RAG-related components
func DeployRAGInfrastructure(ctx *pulumi.Context, cfg *config.CatalystConfig, sourceBucket *storage.Bucket, sa *serviceaccount.Account) (*RAGInfrastructure, error) {
	nameSuffix := fmt.Sprintf("-%s", cfg.Environment)

	// Create Pub/Sub topic for content indexing
	indexingTopic, err := pubsub.NewTopic(ctx, "content-indexing-topic"+nameSuffix, &pubsub.TopicArgs{
		Name: pulumi.String("content-indexing" + nameSuffix),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create indexing topic: %w", err)
	}

	// Create Secrets for API keys
	youtubeAPISecret, err := secretmanager.NewSecret(ctx, "youtube-api-key"+nameSuffix, &secretmanager.SecretArgs{
		SecretId: pulumi.String("youtube-api-key" + nameSuffix),
		Replication: &secretmanager.SecretReplicationArgs{
			UserManaged: &secretmanager.SecretReplicationUserManagedArgs{
				Replicas: secretmanager.SecretReplicationUserManagedReplicaArray{
					&secretmanager.SecretReplicationUserManagedReplicaArgs{
						Location: pulumi.String(cfg.GcpRegion),
					},
				},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create YouTube API secret: %w", err)
	}

	embeddingAPISecret, err := secretmanager.NewSecret(ctx, "embedding-api-key"+nameSuffix, &secretmanager.SecretArgs{
		SecretId: pulumi.String("embedding-api-key" + nameSuffix),
		Replication: &secretmanager.SecretReplicationArgs{
			UserManaged: &secretmanager.SecretReplicationUserManagedArgs{
				Replicas: secretmanager.SecretReplicationUserManagedReplicaArray{
					&secretmanager.SecretReplicationUserManagedReplicaArgs{
						Location: pulumi.String(cfg.GcpRegion),
					},
				},
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create embedding API secret: %w", err)
	}

	// Deploy Content Scraper Function
	contentScraperFn, err := component.NewGen2Function(ctx, "ContentScraper"+nameSuffix, &component.Gen2FunctionArgs{
		Name:        "ContentScraper" + nameSuffix,
		EntryPoint:  "ScrapeContentGCF",
		SourcePath:  "../../backends/catalyst-interviewai/functions/contentscraper",
		Bucket:      sourceBucket,
		Region:      cfg.GcpRegion,
		Project:     cfg.GcpProject,
		Description: "Scrapes content from YouTube videos and blog posts, generates embeddings",
		EnvVars: pulumi.StringMap{
			"NEXTJS_BASE_URL":        pulumi.String(cfg.NextjsBaseUrl),
			"DEFAULT_GEMINI_API_KEY": cfg.DefaultGeminiKey,
			"INDEXING_TOPIC_NAME":    indexingTopic.Name,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create content scraper function: %w", err)
	}

	// Deploy Vector Search Function
	vectorSearchFn, err := component.NewGen2Function(ctx, "VectorSearch"+nameSuffix, &component.Gen2FunctionArgs{
		Name:        "VectorSearch" + nameSuffix,
		EntryPoint:  "VectorSearchGCF",
		SourcePath:  "../../backends/catalyst-interviewai/functions/vectorsearch",
		Bucket:      sourceBucket,
		Region:      cfg.GcpRegion,
		Project:     cfg.GcpProject,
		Description: "Provides semantic search and vector similarity for RAG",
		EnvVars: pulumi.StringMap{
			"VERTEX_AI_LOCATION":          pulumi.String(cfg.GcpRegion),
			"VERTEX_AI_INDEX_ENDPOINT_ID": pulumi.String(""), // To be configured later
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create vector search function: %w", err)
	}

	// Deploy Content Indexer Function (Pub/Sub triggered)
	contentIndexerFn, err := component.NewGen2Function(ctx, "ContentIndexer"+nameSuffix, &component.Gen2FunctionArgs{
		Name:        "ContentIndexer" + nameSuffix,
		EntryPoint:  "ContentIndexerGCF",
		SourcePath:  "../../backends/catalyst-interviewai/functions/contentindexer",
		Bucket:      sourceBucket,
		Region:      cfg.GcpRegion,
		Project:     cfg.GcpProject,
		Description: "Indexes scraped content for vector search, triggered by Pub/Sub",
		EnvVars: pulumi.StringMap{
			"INDEXING_TOPIC_NAME": indexingTopic.Name,
			"VECTOR_SEARCH_URL": vectorSearchFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create content indexer function: %w", err)
	}

	// Create Pub/Sub subscription for the content indexer
	indexingSubscription, err := pubsub.NewSubscription(ctx, "content-indexing-subscription"+nameSuffix, &pubsub.SubscriptionArgs{
		Name:  pulumi.String("content-indexing-subscription" + nameSuffix),
		Topic: indexingTopic.Name,
		PushConfig: &pubsub.SubscriptionPushConfigArgs{
			PushEndpoint: contentIndexerFn.Function.ServiceConfig.ApplyT(func(sc *cloudfunctionsv2.FunctionServiceConfig) string {
				if sc != nil && sc.Uri != nil {
					return *sc.Uri
				}
				return ""
			}).(pulumi.StringOutput),
		},
		AckDeadlineSeconds: pulumi.Int(600), // 10 minutes for processing
		RetryPolicy: &pubsub.SubscriptionRetryPolicyArgs{
			MinimumBackoff: pulumi.String("10s"),
			MaximumBackoff: pulumi.String("600s"),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create indexing subscription: %w", err)
	}

	return &RAGInfrastructure{
		ContentScraperFunction: contentScraperFn,
		VectorSearchFunction:   vectorSearchFn,
		ContentIndexerFunction: contentIndexerFn,
		IndexingTopic:          indexingTopic,
		IndexingSubscription:   indexingSubscription,
		YouTubeAPISecret:       youtubeAPISecret,
		EmbeddingAPISecret:     embeddingAPISecret,
	}, nil
}

// DeployVertexAIVectorSearch deploys Vertex AI Vector Search resources
func DeployVertexAIVectorSearch(ctx *pulumi.Context, cfg *config.CatalystConfig) error {
	// Note: Vertex AI Vector Search resources are not yet fully supported in Pulumi
	// This would need to be done via the REST API or gcloud CLI
	// For now, we'll create a placeholder that can be manually configured

	ctx.Export("vertexAISetupInstructions", pulumi.String(`
To complete the Vertex AI Vector Search setup:

1. Create a Vector Search Index:
   gcloud ai indexes create \
     --display-name="interview-content-index-`+cfg.Environment+`" \
     --description="Vector index for interview content RAG" \
     --metadata-schema-uri="gs://vertex-ai-restricted/metadata/indexed_content_schema.json" \
     --region=`+cfg.GcpRegion+`

2. Create an Index Endpoint:
   gcloud ai index-endpoints create \
     --display-name="interview-content-endpoint-`+cfg.Environment+`" \
     --description="Endpoint for interview content vector search" \
     --region=`+cfg.GcpRegion+`

3. Deploy the index to the endpoint:
   gcloud ai index-endpoints deploy-index INDEX_ENDPOINT_ID \
     --deployed-index-id="interview-content-deployed" \
     --display-name="Interview Content Index" \
     --index=INDEX_ID \
     --region=`+cfg.GcpRegion+`

4. Update the VectorSearch function environment variable:
   VERTEX_AI_INDEX_ENDPOINT_ID=<your-endpoint-id>
`))

	return nil
}

// SetupRAGIAMPermissions sets up IAM permissions for RAG functions
func SetupRAGIAMPermissions(ctx *pulumi.Context, cfg *config.CatalystConfig, sa *serviceaccount.Account, ragInfra *RAGInfrastructure) error {
	nameSuffix := fmt.Sprintf("-%s", cfg.Environment)

	// Grant Secret Manager access
	_, err := secretmanager.NewSecretIamMember(ctx, "youtube-secret-access"+nameSuffix, &secretmanager.SecretIamMemberArgs{
		Project:  pulumi.String(cfg.GcpProject),
		SecretId: ragInfra.YouTubeAPISecret.SecretId,
		Role:     pulumi.String("roles/secretmanager.secretAccessor"),
		Member:   sa.Email.ApplyT(func(email string) string { return "serviceAccount:" + email }).(pulumi.StringInput),
	})
	if err != nil {
		return fmt.Errorf("failed to grant YouTube secret access: %w", err)
	}

	_, err = secretmanager.NewSecretIamMember(ctx, "embedding-secret-access"+nameSuffix, &secretmanager.SecretIamMemberArgs{
		Project:  pulumi.String(cfg.GcpProject),
		SecretId: ragInfra.EmbeddingAPISecret.SecretId,
		Role:     pulumi.String("roles/secretmanager.secretAccessor"),
		Member:   sa.Email.ApplyT(func(email string) string { return "serviceAccount:" + email }).(pulumi.StringInput),
	})
	if err != nil {
		return fmt.Errorf("failed to grant embedding secret access: %w", err)
	}

	// Grant Pub/Sub permissions
	_, err = pubsub.NewTopicIAMBinding(ctx, "indexing-topic-publisher"+nameSuffix, &pubsub.TopicIAMBindingArgs{
		Project: pulumi.String(cfg.GcpProject),
		Topic:   ragInfra.IndexingTopic.Name,
		Role:    pulumi.String("roles/pubsub.publisher"),
		Members: pulumi.StringArray{
			sa.Email.ApplyT(func(email string) string { return "serviceAccount:" + email }).(pulumi.StringInput),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to grant Pub/Sub publisher permissions: %w", err)
	}

	// Grant Firestore permissions (already covered by existing IAM, but adding for clarity)
	// roles/datastore.user is typically already granted to the function service account

	return nil
}
