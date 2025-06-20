package contentindexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/pubsub"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

var (
	firebaseAppSingleton *firebase.App
	firestoreClient      *firestore.Client
	pubsubClient         *pubsub.Client
	gcpProjectIDEnv      string
	indexingTopicName    string
	vectorSearchURL      string
)

func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	indexingTopicName = os.Getenv("INDEXING_TOPIC_NAME")
	vectorSearchURL = os.Getenv("VECTOR_SEARCH_URL")

	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}
	if indexingTopicName == "" {
		indexingTopicName = "content-indexing" // Default topic name
	}
	if vectorSearchURL == "" {
		vectorSearchURL = "https://vectorsearch-function-url" // Default URL
	}

	// Initialize Firebase App
	var err error
	saKeyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
	if saKeyPath != "" {
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil, option.WithCredentialsFile(saKeyPath))
	} else {
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase.NewApp in init: %v", err)
	}

	// Initialize Firestore Client
	firestoreClient, err = firestore.NewClient(ctx, gcpProjectIDEnv)
	if err != nil {
		log.Fatalf("firestore.NewClient in init: %v", err)
	}

	// Initialize Pub/Sub Client
	pubsubClient, err = pubsub.NewClient(ctx, gcpProjectIDEnv)
	if err != nil {
		log.Fatalf("pubsub.NewClient in init: %v", err)
	}

	log.Println("ContentIndexer: All services initialized.")
}

// IndexingMessage represents a message for content to be indexed
type IndexingMessage struct {
	DocumentID  string    `json:"documentId"`
	UserID      string    `json:"userId"`
	Action      string    `json:"action"` // "index", "update", "delete"
	ProcessedAt time.Time `json:"processedAt"`
}

// ContentIndexerGCF is triggered by Pub/Sub messages or HTTP requests
func ContentIndexerGCF(ctx context.Context, m pubsub.Message) error {
	var msg IndexingMessage
	if err := json.Unmarshal(m.Data, &msg); err != nil {
		log.Printf("Failed to unmarshal message: %v", err)
		return err
	}

	log.Printf("Processing indexing request: %+v", msg)

	switch msg.Action {
	case "index", "update":
		return indexContent(ctx, msg.DocumentID, msg.UserID)
	case "delete":
		return deleteFromIndex(ctx, msg.DocumentID)
	default:
		log.Printf("Unknown action: %s", msg.Action)
		return fmt.Errorf("unknown action: %s", msg.Action)
	}
}

// ContentIndexerHTTP provides an HTTP endpoint for manual triggering
func ContentIndexerHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request
	var req struct {
		Mode string `json:"mode"` // "single", "batch", "all"
		IDs  []string `json:"ids,omitempty"`
		Limit int `json:"limit,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var processed int
	var err error

	switch req.Mode {
	case "single":
		if len(req.IDs) == 0 {
			http.Error(w, "Document ID required for single mode", http.StatusBadRequest)
			return
		}
		err = indexContent(ctx, req.IDs[0], "manual")
		if err == nil {
			processed = 1
		}

	case "batch":
		for _, id := range req.IDs {
			if err := indexContent(ctx, id, "manual"); err != nil {
				log.Printf("Failed to index %s: %v", id, err)
			} else {
				processed++
			}
		}

	case "all":
		processed, err = indexAllUnprocessedContent(ctx, req.Limit)

	default:
		http.Error(w, "Invalid mode. Use 'single', 'batch', or 'all'", http.StatusBadRequest)
		return
	}

	// Return response
	resp := map[string]interface{}{
		"processed": processed,
		"mode":      req.Mode,
	}
	if err != nil {
		resp["error"] = err.Error()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// indexContent processes a single document for indexing
func indexContent(ctx context.Context, documentID, userID string) error {
	// Get document from Firestore
	doc, err := firestoreClient.Collection("scraped_content").Doc(documentID).Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}

	// Parse document data
	var content map[string]interface{}
	if err := doc.DataTo(&content); err != nil {
		return fmt.Errorf("failed to parse document: %w", err)
	}

	// Check if already indexed
	if indexedAt, ok := content["indexedAt"].(string); ok && indexedAt != "" {
		log.Printf("Document %s already indexed at %s", documentID, indexedAt)
		return nil
	}

	// Check if embeddings exist
	if embeddings, ok := content["embeddings"].(map[string]interface{}); !ok || embeddings == nil {
		log.Printf("Document %s has no embeddings, skipping indexing", documentID)
		return nil
	}

	// Prepare document for vector indexing
	indexDoc := map[string]interface{}{
		"id":           documentID,
		"content":      extractContentForIndexing(content),
		"embeddings":   content["embeddings"],
		"metadata":     extractMetadata(content),
		"qualityScore": content["qualityScore"],
	}

	// Send to vector search service
	if err := sendToVectorSearch(ctx, []map[string]interface{}{indexDoc}, userID); err != nil {
		return fmt.Errorf("failed to send to vector search: %w", err)
	}

	// Update document with indexing timestamp
	_, err = doc.Ref.Update(ctx, []firestore.Update{
		{Path: "indexedAt", Value: time.Now().Format(time.RFC3339)},
		{Path: "indexVersion", Value: "1.0"},
	})
	if err != nil {
		log.Printf("Failed to update indexing timestamp: %v", err)
		// Don't fail the whole operation
	}

	log.Printf("Successfully indexed document %s", documentID)
	return nil
}

// deleteFromIndex removes a document from the vector index
func deleteFromIndex(ctx context.Context, documentID string) error {
	// TODO: Implement deletion from vector index
	log.Printf("Delete from index not yet implemented for document %s", documentID)
	return nil
}

// indexAllUnprocessedContent finds and indexes all content without embeddings
func indexAllUnprocessedContent(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		limit = 100 // Default limit
	}

	processed := 0
	
	// Query for documents that have embeddings but aren't indexed
	query := firestoreClient.Collection("scraped_content").
		Where("embeddings", "!=", nil).
		OrderBy("embeddings").
		OrderBy("createdAt", firestore.Asc).
		Limit(limit)

	iter := query.Documents(ctx)
	defer iter.Stop()

	var batch []map[string]interface{}
	batchSize := 10

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return processed, fmt.Errorf("iterator error: %w", err)
		}

		var content map[string]interface{}
		if err := doc.DataTo(&content); err != nil {
			log.Printf("Failed to parse document %s: %v", doc.Ref.ID, err)
			continue
		}

		// Skip if already indexed
		if indexedAt, ok := content["indexedAt"].(string); ok && indexedAt != "" {
			continue
		}

		// Prepare for batch indexing
		indexDoc := map[string]interface{}{
			"id":           doc.Ref.ID,
			"content":      extractContentForIndexing(content),
			"embeddings":   content["embeddings"],
			"metadata":     extractMetadata(content),
			"qualityScore": content["qualityScore"],
		}

		batch = append(batch, indexDoc)

		// Send batch when full
		if len(batch) >= batchSize {
			if err := sendToVectorSearch(ctx, batch, "batch-indexing"); err != nil {
				log.Printf("Batch indexing failed: %v", err)
			} else {
				processed += len(batch)
				// Update indexed timestamps
				updateBatchIndexTimestamps(ctx, batch)
			}
			batch = nil
		}
	}

	// Send remaining batch
	if len(batch) > 0 {
		if err := sendToVectorSearch(ctx, batch, "batch-indexing"); err != nil {
			log.Printf("Final batch indexing failed: %v", err)
		} else {
			processed += len(batch)
			updateBatchIndexTimestamps(ctx, batch)
		}
	}

	return processed, nil
}

// Helper functions

func extractContentForIndexing(content map[string]interface{}) string {
	// Extract the most relevant content for vector search
	if summary, ok := content["content"].(map[string]interface{})["summary"].(string); ok && summary != "" {
		return summary
	}
	if title, ok := content["source"].(map[string]interface{})["title"].(string); ok {
		return title
	}
	return ""
}

func extractMetadata(content map[string]interface{}) map[string]interface{} {
	metadata := make(map[string]interface{})
	
	// Extract relevant metadata fields
	fields := []string{"interviewType", "targetLevel", "targetCompany", "contentType"}
	for _, field := range fields {
		if val, ok := content[field]; ok {
			metadata[field] = val
		}
	}

	// Extract source metadata
	if source, ok := content["source"].(map[string]interface{}); ok {
		metadata["sourceType"] = source["type"]
		metadata["sourceURL"] = source["url"]
		metadata["author"] = source["author"]
	}

	return metadata
}

func sendToVectorSearch(ctx context.Context, documents []map[string]interface{}, userID string) error {
	payload := map[string]interface{}{
		"documents": documents,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", vectorSearchURL+"/upsert", bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// Add authentication if needed
	if token := os.Getenv("VECTOR_SEARCH_API_KEY"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("vector search returned status %d", resp.StatusCode)
	}

	return nil
}

func updateBatchIndexTimestamps(ctx context.Context, batch []map[string]interface{}) {
	timestamp := time.Now().Format(time.RFC3339)
	
	for _, doc := range batch {
		if id, ok := doc["id"].(string); ok {
			_, err := firestoreClient.Collection("scraped_content").Doc(id).Update(ctx, []firestore.Update{
				{Path: "indexedAt", Value: timestamp},
				{Path: "indexVersion", Value: "1.0"},
			})
			if err != nil {
				log.Printf("Failed to update timestamp for %s: %v", id, err)
			}
		}
	}
}

// ScheduledIndexer runs periodically to index new content
func ScheduledIndexer(ctx context.Context) error {
	log.Println("Running scheduled indexing...")
	processed, err := indexAllUnprocessedContent(ctx, 500)
	if err != nil {
		log.Printf("Scheduled indexing error: %v", err)
		return err
	}
	log.Printf("Scheduled indexing completed: %d documents processed", processed)
	return nil
}