package vectorsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"interviewai.wkv.local/vectorsearch/internal/auth"
	"interviewai.wkv.local/vectorsearch/internal/httputils"
	"interviewai.wkv.local/vectorsearch/models"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/aiplatform/v1"
	"google.golang.org/api/option"
)

var (
	firebaseAppSingleton *firebase.App
	firestoreClient      *firestore.Client
	aiplatformService    *aiplatform.Service
	gcpProjectIDEnv      string
	locationEnv          string
	indexEndpointIDEnv   string
)

func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	locationEnv = os.Getenv("VERTEX_AI_LOCATION")
	indexEndpointIDEnv = os.Getenv("VERTEX_AI_INDEX_ENDPOINT_ID")

	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}
	if locationEnv == "" {
		locationEnv = "us-central1" // Default location
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

	// Initialize AI Platform Service
	aiplatformService, err = aiplatform.NewService(ctx)
	if err != nil {
		log.Fatalf("aiplatform.NewService in init: %v", err)
	}

	log.Println("VectorSearch: All services initialized successfully.")
}

// SearchRequest defines the request for semantic search
type SearchRequest struct {
	Query   string                 `json:"query"`
	Filters map[string]interface{} `json:"filters,omitempty"`
	Limit   int                    `json:"limit,omitempty"`
}

// UpsertRequest defines the request for upserting embeddings
type UpsertRequest struct {
	Documents []models.IndexedDocument `json:"documents"`
}

// VectorSearchGCF is the main Cloud Function handler
func VectorSearchGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Handle different endpoints based on path
	path := r.URL.Path
	switch {
	case strings.HasSuffix(path, "/search"):
		handleSemanticSearch(w, r)
	case strings.HasSuffix(path, "/upsert"):
		handleUpsertEmbeddings(w, r)
	case strings.HasSuffix(path, "/similar"):
		handleFindSimilar(w, r)
	default:
		httputils.ErrorJSON(w, "Invalid endpoint", http.StatusNotFound)
	}
}

// handleSemanticSearch performs semantic search using vector similarity
func handleSemanticSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed for /search", http.StatusMethodNotAllowed)
		return
	}

	// Verify Firebase authentication
	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		httputils.ErrorJSON(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Parse request
	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputils.ErrorJSON(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Query == "" {
		httputils.ErrorJSON(w, "Query is required", http.StatusBadRequest)
		return
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	// Perform semantic search
	results, err := performSemanticSearch(r.Context(), req, authedUser.UID)
	if err != nil {
		log.Printf("Semantic search failed: %v", err)
		httputils.ErrorJSON(w, "Search failed", http.StatusInternalServerError)
		return
	}

	log.Printf("Semantic search completed for user %s, found %d results", authedUser.UID, len(results))
	httputils.RespondJSON(w, map[string]interface{}{
		"results": results,
		"total":   len(results),
		"query":   req.Query,
	}, http.StatusOK)
}

// handleUpsertEmbeddings handles upserting document embeddings to the vector index
func handleUpsertEmbeddings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed for /upsert", http.StatusMethodNotAllowed)
		return
	}

	// Verify Firebase authentication
	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		httputils.ErrorJSON(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Parse request
	var req UpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputils.ErrorJSON(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Documents) == 0 {
		httputils.ErrorJSON(w, "At least one document is required", http.StatusBadRequest)
		return
	}

	// Upsert embeddings
	err = upsertEmbeddings(r.Context(), req.Documents, authedUser.UID)
	if err != nil {
		log.Printf("Upsert failed: %v", err)
		httputils.ErrorJSON(w, "Upsert failed", http.StatusInternalServerError)
		return
	}

	log.Printf("Successfully upserted %d documents for user %s", len(req.Documents), authedUser.UID)
	httputils.RespondJSON(w, map[string]interface{}{
		"success":  true,
		"upserted": len(req.Documents),
	}, http.StatusOK)
}

// handleFindSimilar finds similar content to a given document
func handleFindSimilar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed for /similar", http.StatusMethodNotAllowed)
		return
	}

	// Verify Firebase authentication
	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		httputils.ErrorJSON(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Get document ID from query parameters
	documentID := r.URL.Query().Get("documentId")
	if documentID == "" {
		httputils.ErrorJSON(w, "documentId parameter is required", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 5
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}

	// Find similar documents
	results, err := findSimilarDocuments(r.Context(), documentID, limit, authedUser.UID)
	if err != nil {
		log.Printf("Find similar failed: %v", err)
		httputils.ErrorJSON(w, "Find similar failed", http.StatusInternalServerError)
		return
	}

	httputils.RespondJSON(w, map[string]interface{}{
		"results":    results,
		"documentId": documentID,
		"total":      len(results),
	}, http.StatusOK)
}

// performSemanticSearch executes the actual semantic search
func performSemanticSearch(ctx context.Context, req SearchRequest, userID string) ([]models.SearchResult, error) {
	// For now, implement a hybrid approach using Firestore + vector similarity
	// In production, you'd use Vertex AI Vector Search or Pinecone

	// Step 1: Query Firestore for documents matching metadata filters
	query := firestoreClient.Collection("scraped_content")

	// Apply filters
	if req.Filters != nil {
		if interviewType, ok := req.Filters["interviewType"].(string); ok && interviewType != "" {
			query = query.Where("interviewType", "==", interviewType)
		}
		if targetLevel, ok := req.Filters["targetLevel"].(string); ok && targetLevel != "" {
			query = query.Where("targetLevel", "==", targetLevel)
		}
		if company, ok := req.Filters["company"].(string); ok && company != "" {
			query = query.Where("targetCompany", "==", company)
		}
		if contentType, ok := req.Filters["contentType"].(string); ok && contentType != "" {
			query = query.Where("contentType", "==", contentType)
		}
	}

	// Limit results for performance
	query = query.Limit(req.Limit * 2) // Get more than needed, then filter by similarity

	docs, err := query.Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to query documents: %w", err)
	}

	// Step 2: Generate embedding for search query
	queryEmbedding, err := generateQueryEmbedding(ctx, req.Query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// Step 3: Calculate similarities and rank results
	var results []models.SearchResult
	for _, doc := range docs {
		var content models.ScrapedContent
		if err := doc.DataTo(&content); err != nil {
			log.Printf("Failed to parse document %s: %v", doc.Ref.ID, err)
			continue
		}

		// Calculate similarity with different content parts
		similarity := calculateDocumentSimilarity(queryEmbedding, &content)
		if similarity > 0.3 { // Threshold for relevance
			results = append(results, models.SearchResult{
				ID:          doc.Ref.ID,
				Content:     content.Content.Summary,
				Source:      content.Source.URL,
				Title:       content.Source.Title,
				Score:       similarity,
				ContentType: content.ContentType,
				Metadata: map[string]interface{}{
					"interviewType": content.InterviewType,
					"targetLevel":   content.TargetLevel,
					"targetCompany": content.TargetCompany,
					"author":        content.Source.Author,
					"createdAt":     content.CreatedAt,
					"qualityScore":  content.QualityScore,
				},
			})
		}
	}

	// Sort by similarity score
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[i].Score < results[j].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// Limit final results
	if len(results) > req.Limit {
		results = results[:req.Limit]
	}

	return results, nil
}

// upsertEmbeddings stores document embeddings for later retrieval
func upsertEmbeddings(ctx context.Context, documents []models.IndexedDocument, userID string) error {
	// In a production system, this would upsert to Vertex AI Vector Search
	// For now, we'll store in Firestore with the embeddings

	batch := firestoreClient.Batch()
	
	for _, doc := range documents {
		// Create document reference
		docRef := firestoreClient.Collection("indexed_content").NewDoc()
		
		// Prepare document data
		docData := map[string]interface{}{
			"id":             doc.ID,
			"content":        doc.Content,
			"embeddings":     doc.Embeddings,
			"metadata":       doc.Metadata,
			"userId":         userID,
			"indexedAt":      time.Now().Unix(),
			"qualityScore":   doc.QualityScore,
		}
		
		batch.Set(docRef, docData)
	}
	
	// Commit batch
	_, err := batch.Commit(ctx)
	if err != nil {
		return fmt.Errorf("failed to commit batch: %w", err)
	}

	return nil
}

// findSimilarDocuments finds documents similar to a given document
func findSimilarDocuments(ctx context.Context, documentID string, limit int, userID string) ([]models.SearchResult, error) {
	// Get the reference document
	docRef := firestoreClient.Collection("scraped_content").Doc(documentID)
	doc, err := docRef.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	var refContent models.ScrapedContent
	if err := doc.DataTo(&refContent); err != nil {
		return nil, fmt.Errorf("failed to parse reference document: %w", err)
	}

	// Use the document's summary as the search query
	searchQuery := refContent.Content.Summary
	if searchQuery == "" {
		searchQuery = refContent.Source.Title + " " + refContent.Source.Description
	}

	// Perform search excluding the reference document
	req := SearchRequest{
		Query: searchQuery,
		Filters: map[string]interface{}{
			"interviewType": refContent.InterviewType,
		},
		Limit: limit + 1, // +1 to account for excluding the reference doc
	}

	results, err := performSemanticSearch(ctx, req, userID)
	if err != nil {
		return nil, err
	}

	// Filter out the reference document
	var filteredResults []models.SearchResult
	for _, result := range results {
		if result.ID != documentID {
			filteredResults = append(filteredResults, result)
		}
	}

	// Limit results
	if len(filteredResults) > limit {
		filteredResults = filteredResults[:limit]
	}

	return filteredResults, nil
}

// Helper functions

func generateQueryEmbedding(ctx context.Context, query string) ([]float64, error) {
	// In production, use the same embedding service as content scraping
	// For now, return a placeholder
	
	// TODO: Integrate with actual embedding generation
	// This should use the same embedding model as used in content processing
	return make([]float64, 768), nil // Placeholder embedding
}

func calculateDocumentSimilarity(queryEmbedding []float64, content *models.ScrapedContent) float64 {
	// Calculate similarity with document embeddings
	if content.Embeddings == nil || len(content.Embeddings.Vectors) == 0 {
		// Fallback to text-based similarity if no embeddings
		return calculateTextSimilarity(content)
	}

	// Use the document-level embedding for comparison
	if docEmbedding, exists := content.EmbeddingMetadata["document"]; exists {
		if idx, ok := docEmbedding.(int); ok && idx < len(content.Embeddings.Vectors) {
			similarity, err := calculateCosineSimilarity(queryEmbedding, content.Embeddings.Vectors[idx])
			if err == nil {
				return similarity
			}
		}
	}

	// Fallback to average of all embeddings
	var totalSimilarity float64
	count := 0
	for _, embedding := range content.Embeddings.Vectors {
		if sim, err := calculateCosineSimilarity(queryEmbedding, embedding); err == nil {
			totalSimilarity += sim
			count++
		}
	}

	if count > 0 {
		return totalSimilarity / float64(count)
	}

	return 0.0
}

func calculateTextSimilarity(content *models.ScrapedContent) float64 {
	// Simple text-based similarity as fallback
	// In production, you'd use more sophisticated text similarity
	
	// Give higher scores to interview-specific content
	score := content.QualityScore
	
	// Boost based on content type
	switch content.ContentType {
	case "interview_experience":
		score += 0.3
	case "tips":
		score += 0.2
	case "tutorial":
		score += 0.1
	}
	
	return score
}

func calculateCosineSimilarity(a, b []float64) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("vector dimensions don't match: %d vs %d", len(a), len(b))
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0, nil
	}

	return dotProduct / (normA * normB), nil
}