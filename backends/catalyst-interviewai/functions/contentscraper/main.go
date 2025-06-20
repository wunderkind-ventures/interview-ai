package contentscraper

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"interviewai.wkv.local/contentscraper/internal/auth"
	"interviewai.wkv.local/contentscraper/internal/httputils"
	"interviewai.wkv.local/contentscraper/internal/secrets"
	"interviewai.wkv.local/contentscraper/models"
	"interviewai.wkv.local/contentscraper/processors"
	"interviewai.wkv.local/contentscraper/scrapers"

	"cloud.google.com/go/firestore"
	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

var (
	firebaseAppSingleton  *firebase.App
	secretClientSingleton *secretmanager.Client
	firestoreClient       *firestore.Client
	gcpProjectIDEnv       string
)

// init runs during cold start or new instance creation, initializing shared clients.
func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}

	// Initialize Firebase App Singleton
	saKeyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
	var err error
	var firebaseOpt option.ClientOption
	if saKeyPath != "" {
		firebaseOpt = option.WithCredentialsFile(saKeyPath)
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil, firebaseOpt)
	} else {
		// For GCF, use default credentials from the runtime service account
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase.NewApp in init: %v", err)
	}

	// Initialize Secret Manager Client Singleton
	secretClientSingleton, err = secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("secretmanager.NewClient in init: %v", err)
	}

	// Initialize Firestore Client for storing scraped content
	firestoreClient, err = firestore.NewClient(ctx, gcpProjectIDEnv)
	if err != nil {
		log.Fatalf("firestore.NewClient in init: %v", err)
	}

	log.Println("ContentScraper: Firebase App, Secret Manager, and Firestore clients initialized.")
}

// ScrapeRequest defines the expected request body for scraping content.
type ScrapeRequest struct {
	URL                string                `json:"url"`
	ContentType        string                `json:"contentType"` // "youtube" or "blog"
	ExtractionOptions  ExtractionOptions     `json:"extractionOptions,omitempty"`
}

type ExtractionOptions struct {
	GenerateEmbeddings bool `json:"generateEmbeddings"`
	ExtractQuestions   bool `json:"extractQuestions"`
	ExtractConcepts    bool `json:"extractConcepts"`
}

// SearchRequest defines the expected query parameters for searching content.
type SearchRequest struct {
	Company       string `json:"company,omitempty"`
	InterviewType string `json:"interviewType,omitempty"`
	Level         string `json:"level,omitempty"`
	Query         string `json:"query,omitempty"`
	Limit         int    `json:"limit,omitempty"`
}

// ScrapeContentGCF is the HTTP Cloud Function for scraping content from URLs.
func ScrapeContentGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Handle different endpoints based on path
	path := r.URL.Path
	switch {
	case strings.HasSuffix(path, "/scrape"):
		handleScrapeContent(w, r)
	case strings.HasSuffix(path, "/search"):
		handleSearchContent(w, r)
	default:
		httputils.ErrorJSON(w, "Invalid endpoint", http.StatusNotFound)
	}
}

func handleScrapeContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed for /scrape", http.StatusMethodNotAllowed)
		return
	}

	// Verify Firebase authentication
	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		httputils.ErrorJSON(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req ScrapeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputils.ErrorJSON(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.URL == "" {
		httputils.ErrorJSON(w, "URL is required", http.StatusBadRequest)
		return
	}

	if req.ContentType != "youtube" && req.ContentType != "blog" {
		httputils.ErrorJSON(w, "contentType must be 'youtube' or 'blog'", http.StatusBadRequest)
		return
	}

	// Scrape content based on type
	var scrapedContent *models.ScrapedContent
	
	switch req.ContentType {
	case "youtube":
		scrapedContent, err = handleYouTubeScraping(req.URL, authedUser.UID)
	case "blog":
		scrapedContent, err = handleBlogScraping(req.URL, authedUser.UID)
	default:
		httputils.ErrorJSON(w, "Unsupported content type", http.StatusBadRequest)
		return
	}
	
	if err != nil {
		log.Printf("Scraping failed for %s: %v", req.URL, err)
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to scrape content: %v", err), http.StatusInternalServerError)
		return
	}

	// Store in Firestore
	ctx := context.Background()
	docRef := firestoreClient.Collection("scraped_content").NewDoc()
	_, err = docRef.Set(ctx, scrapedContent)
	if err != nil {
		log.Printf("Failed to store scraped content: %v", err)
		httputils.ErrorJSON(w, "Failed to store content", http.StatusInternalServerError)
		return
	}

	log.Printf("Content scraped successfully for user %s from URL: %s", authedUser.UID, req.URL)
	httputils.RespondJSON(w, scrapedContent, http.StatusOK)
}

func handleSearchContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed for /search", http.StatusMethodNotAllowed)
		return
	}

	// Verify Firebase authentication
	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		log.Printf("Authentication failed: %v", err)
		httputils.ErrorJSON(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	searchReq := SearchRequest{
		Company:       r.URL.Query().Get("company"),
		InterviewType: r.URL.Query().Get("interviewType"),
		Level:         r.URL.Query().Get("level"),
		Query:         r.URL.Query().Get("query"),
		Limit:         10, // Default limit
	}

	// TODO: Implement actual search logic
	// For now, return a placeholder response
	results := []models.ScrapedContent{
		{
			Source: models.ContentSource{
				Type:    "youtube",
				URL:     "https://youtube.com/watch?v=example",
				Title:   "Example System Design Interview",
				Author:  "TechLead",
				Company: "Google",
			},
			ContentType:   "interview_experience",
			InterviewType: "technical_system_design",
			TargetLevel:   "L4",
			Content: models.ContentData{
				Questions: []models.Question{
					{
						QuestionText: "Design a URL shortener",
						Context:      "System design interview question",
						KeyPoints:    []string{"scalability", "caching", "database design"},
					},
				},
			},
			UserID: authedUser.UID,
		},
	}

	log.Printf("Content search performed for user %s with filters: %+v", authedUser.UID, searchReq)
	httputils.RespondJSON(w, map[string]interface{}{
		"results": results,
		"total":   len(results),
	}, http.StatusOK)
}

// handleYouTubeScraping scrapes content from a YouTube video
func handleYouTubeScraping(videoURL, userID string) (*models.ScrapedContent, error) {
	ctx := context.Background()
	
	// Get YouTube API key from Secret Manager
	apiKey, err := getYouTubeAPIKey(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get YouTube API key: %w", err)
	}
	
	// Create YouTube scraper
	youtubeScraper, err := scrapers.NewYouTubeScraper(apiKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create YouTube scraper: %w", err)
	}
	
	// Scrape video content
	scrapedContent, err := youtubeScraper.ScrapeVideo(videoURL)
	if err != nil {
		return nil, fmt.Errorf("failed to scrape YouTube video: %w", err)
	}
	
	// Set user ID and timestamp
	scrapedContent.UserID = userID
	scrapedContent.CreatedAt = fmt.Sprintf("%d", time.Now().Unix())
	
	// Generate embeddings if requested
	// Note: In production, you might want to make this async for performance
	embeddingAPIKey, err := getEmbeddingAPIKey(ctx, userID)
	if err == nil && embeddingAPIKey != "" {
		embeddingService := processors.NewEmbeddingService(embeddingAPIKey, "google") // or "openai"
		
		if err := embeddingService.GenerateContentEmbeddings(scrapedContent); err != nil {
			log.Printf("Warning: Failed to generate embeddings: %v", err)
			// Don't fail the entire request if embedding generation fails
		} else {
			scrapedContent.IndexedAt = fmt.Sprintf("%d", time.Now().Unix())
			log.Printf("Successfully generated embeddings for content from %s", videoURL)
		}
	}
	
	// Calculate quality score
	scrapedContent.QualityScore = calculateContentQuality(scrapedContent)
	
	return scrapedContent, nil
}

// handleBlogScraping scrapes content from a blog post
func handleBlogScraping(articleURL, userID string) (*models.ScrapedContent, error) {
	// Create blog scraper
	blogScraper := scrapers.NewBlogScraper()
	
	// Scrape article content
	scrapedContent, err := blogScraper.ScrapeArticle(articleURL)
	if err != nil {
		return nil, fmt.Errorf("failed to scrape blog article: %w", err)
	}
	
	// Set user ID and timestamp
	scrapedContent.UserID = userID
	scrapedContent.CreatedAt = fmt.Sprintf("%d", time.Now().Unix())
	
	// Generate embeddings if requested
	ctx := context.Background()
	embeddingAPIKey, err := getEmbeddingAPIKey(ctx, userID)
	if err == nil && embeddingAPIKey != "" {
		embeddingService := processors.NewEmbeddingService(embeddingAPIKey, "google")
		
		if err := embeddingService.GenerateContentEmbeddings(scrapedContent); err != nil {
			log.Printf("Warning: Failed to generate embeddings: %v", err)
		} else {
			scrapedContent.IndexedAt = fmt.Sprintf("%d", time.Now().Unix())
			log.Printf("Successfully generated embeddings for content from %s", articleURL)
		}
	}
	
	// Calculate quality score
	scrapedContent.QualityScore = calculateContentQuality(scrapedContent)
	
	return scrapedContent, nil
}

// getYouTubeAPIKey retrieves YouTube API key from Secret Manager
func getYouTubeAPIKey(ctx context.Context, userID string) (string, error) {
	// First try to get user-specific YouTube API key
	userAPIKey, err := secrets.GetUserAPIKey(ctx, secretClientSingleton, gcpProjectIDEnv, userID)
	if err == nil && userAPIKey != "" {
		return userAPIKey, nil
	}
	
	// Fallback to system YouTube API key
	systemAPIKey := os.Getenv("YOUTUBE_API_KEY")
	if systemAPIKey != "" {
		return systemAPIKey, nil
	}
	
	// Try to get system API key from Secret Manager
	systemAPIKey, err = getSystemSecret(ctx, "youtube-api-key")
	if err != nil {
		return "", fmt.Errorf("no YouTube API key available")
	}
	
	return systemAPIKey, nil
}

// getSystemSecret retrieves a system-wide secret from Secret Manager
func getSystemSecret(ctx context.Context, secretName string) (string, error) {
	secretVersionName := fmt.Sprintf("projects/%s/secrets/%s/versions/latest", gcpProjectIDEnv, secretName)
	
	result, err := secretClientSingleton.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{
		Name: secretVersionName,
	})
	if err != nil {
		return "", fmt.Errorf("failed to access secret %s: %w", secretName, err)
	}
	
	return string(result.Payload.Data), nil
}

// getEmbeddingAPIKey retrieves embedding API key from various sources
func getEmbeddingAPIKey(ctx context.Context, userID string) (string, error) {
	// First try user-specific API key (for embeddings)
	userAPIKey, err := secrets.GetUserAPIKey(ctx, secretClientSingleton, gcpProjectIDEnv, userID)
	if err == nil && userAPIKey != "" {
		return userAPIKey, nil
	}
	
	// Try environment variable for embedding API key
	embeddingAPIKey := os.Getenv("EMBEDDING_API_KEY")
	if embeddingAPIKey != "" {
		return embeddingAPIKey, nil
	}
	
	// Try system embedding API key from Secret Manager
	embeddingAPIKey, err = getSystemSecret(ctx, "embedding-api-key")
	if err != nil {
		// Fall back to the same API key used for AI generation
		return getSystemSecret(ctx, "gemini-api-key")
	}
	
	return embeddingAPIKey, nil
}

// calculateContentQuality calculates a quality score for the scraped content
func calculateContentQuality(content *models.ScrapedContent) float64 {
	score := 0.0
	
	// Base score for having content
	if content.Content.FullTranscript != "" {
		score += 0.3
	}
	
	// Bonus for structured data
	if len(content.Content.Questions) > 0 {
		score += 0.2
	}
	if len(content.Content.Concepts) > 0 {
		score += 0.2
	}
	if len(content.Content.Tips) > 0 {
		score += 0.1
	}
	
	// Quality indicators
	if content.Source.Type == "youtube" {
		// For YouTube videos
		if content.Source.ViewCount > 10000 {
			score += 0.1
		}
		if content.Source.ViewCount > 100000 {
			score += 0.1
		}
		
		// Duration bonus (longer videos often have more content)
		if content.Source.Duration != "" {
			// Simple heuristic: videos between 10-60 minutes tend to be good
			score += 0.05
		}
	}
	
	// Content length bonus
	if len(content.Content.FullTranscript) > 1000 {
		score += 0.1
	}
	if len(content.Content.FullTranscript) > 5000 {
		score += 0.1
	}
	
	// Interview relevance (based on content classification)
	switch content.InterviewType {
	case "technical_system_design", "behavioral", "coding":
		score += 0.2
	case "product_sense":
		score += 0.15
	default:
		score += 0.05
	}
	
	// Company-specific content gets bonus
	if content.TargetCompany != "" {
		score += 0.1
	}
	
	// Level-specific content gets bonus
	if content.TargetLevel != "" {
		score += 0.1
	}
	
	// Normalize to 0-1 range
	if score > 1.0 {
		score = 1.0
	}
	
	return score
}