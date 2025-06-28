// Package embeddings provides embedding generation using Google's Vertex AI
package embeddings

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	"google.golang.org/api/option"
	aiplatformpb "google.golang.org/genproto/googleapis/cloud/aiplatform/v1"

	"github.com/interview-ai/rag/models"
)

// Service handles embedding generation
type Service struct {
	client    *aiplatform.PredictionClient
	projectID string
	location  string
	model     string
}

// NewService creates a new embedding service
func NewService(projectID, location, model string) (*Service, error) {
	ctx := context.Background()
	
	endpoint := fmt.Sprintf("%s-aiplatform.googleapis.com:443", location)
	client, err := aiplatform.NewPredictionClient(ctx, option.WithEndpoint(endpoint))
	if err != nil {
		return nil, fmt.Errorf("failed to create prediction client: %w", err)
	}

	if model == "" {
		model = models.DefaultEmbeddingModel
	}

	return &Service{
		client:    client,
		projectID: projectID,
		location:  location,
		model:     model,
	}, nil
}

// GenerateEmbeddings generates embeddings for the given texts
func (s *Service) GenerateEmbeddings(ctx context.Context, texts []string) ([][]float64, error) {
	if len(texts) == 0 {
		return nil, fmt.Errorf("no texts provided")
	}

	// Prepare the prediction request
	instances := make([]*aiplatformpb.Value, len(texts))
	for i, text := range texts {
		// Clean and prepare text
		cleanText := s.preprocessText(text)
		
		instances[i] = &aiplatformpb.Value{
			Kind: &aiplatformpb.Value_StructValue{
				StructValue: &aiplatformpb.Struct{
					Fields: map[string]*aiplatformpb.Value{
						"content": {
							Kind: &aiplatformpb.Value_StringValue{
								StringValue: cleanText,
							},
						},
					},
				},
			},
		}
	}

	// Construct the endpoint
	endpoint := fmt.Sprintf("projects/%s/locations/%s/publishers/google/models/%s",
		s.projectID, s.location, s.model)

	// Make the prediction request
	req := &aiplatformpb.PredictRequest{
		Endpoint:  endpoint,
		Instances: instances,
	}

	resp, err := s.client.Predict(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to predict: %w", err)
	}

	// Extract embeddings from response
	embeddings := make([][]float64, len(texts))
	for i, prediction := range resp.Predictions {
		embeddingStruct := prediction.GetStructValue()
		if embeddingStruct == nil {
			return nil, fmt.Errorf("invalid prediction response structure")
		}

		embeddingsField := embeddingStruct.Fields["embeddings"]
		if embeddingsField == nil {
			return nil, fmt.Errorf("embeddings field not found in response")
		}

		valuesField := embeddingsField.GetStructValue().Fields["values"]
		if valuesField == nil {
			return nil, fmt.Errorf("values field not found in embeddings")
		}

		valuesList := valuesField.GetListValue()
		if valuesList == nil {
			return nil, fmt.Errorf("values is not a list")
		}

		embedding := make([]float64, len(valuesList.Values))
		for j, value := range valuesList.Values {
			embedding[j] = value.GetNumberValue()
		}

		embeddings[i] = embedding
	}

	return embeddings, nil
}

// GenerateEmbedding generates embedding for a single text
func (s *Service) GenerateEmbedding(ctx context.Context, text string) ([]float64, error) {
	embeddings, err := s.GenerateEmbeddings(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	
	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embeddings generated")
	}
	
	return embeddings[0], nil
}

// GenerateMultiLevelEmbeddings generates embeddings at different levels for content
func (s *Service) GenerateMultiLevelEmbeddings(ctx context.Context, content models.IndexedContent) (map[string][]float64, error) {
	embeddings := make(map[string][]float64)
	
	// Document-level embedding (summary)
	if content.Summary != "" {
		docEmbedding, err := s.GenerateEmbedding(ctx, content.Summary)
		if err != nil {
			log.Printf("Failed to generate document embedding: %v", err)
		} else {
			embeddings["document"] = docEmbedding
		}
	}
	
	// Title embedding
	if content.Title != "" {
		titleEmbedding, err := s.GenerateEmbedding(ctx, content.Title)
		if err != nil {
			log.Printf("Failed to generate title embedding: %v", err)
		} else {
			embeddings["title"] = titleEmbedding
		}
	}
	
	// Content chunks embedding (if content is long)
	if len(content.Content) > 1000 {
		chunks := s.chunkContent(content.Content, 500)
		chunkEmbeddings := make([][]float64, 0, len(chunks))
		
		for _, chunk := range chunks {
			chunkEmb, err := s.GenerateEmbedding(ctx, chunk)
			if err != nil {
				log.Printf("Failed to generate chunk embedding: %v", err)
				continue
			}
			chunkEmbeddings = append(chunkEmbeddings, chunkEmb)
		}
		
		// Average chunk embeddings for content-level embedding
		if len(chunkEmbeddings) > 0 {
			contentEmbedding := s.averageEmbeddings(chunkEmbeddings)
			embeddings["content"] = contentEmbedding
		}
	} else {
		// For shorter content, use full content
		contentEmbedding, err := s.GenerateEmbedding(ctx, content.Content)
		if err != nil {
			log.Printf("Failed to generate content embedding: %v", err)
		} else {
			embeddings["content"] = contentEmbedding
		}
	}
	
	// Topic-based embedding (using tags)
	if len(content.Topics) > 0 {
		topicText := strings.Join(content.Topics, " ")
		topicEmbedding, err := s.GenerateEmbedding(ctx, topicText)
		if err != nil {
			log.Printf("Failed to generate topic embedding: %v", err)
		} else {
			embeddings["topics"] = topicEmbedding
		}
	}
	
	return embeddings, nil
}

// GenerateQueryEmbedding generates embedding for search query with context
func (s *Service) GenerateQueryEmbedding(ctx context.Context, query string, context map[string]any) ([]float64, error) {
	// Enhance query with context
	enhancedQuery := s.enhanceQueryWithContext(query, context)
	
	return s.GenerateEmbedding(ctx, enhancedQuery)
}

// BatchGenerate generates embeddings for multiple contents efficiently
func (s *Service) BatchGenerate(ctx context.Context, contents []models.IndexedContent) ([]map[string][]float64, error) {
	results := make([]map[string][]float64, len(contents))
	
	// Process in batches to avoid hitting API limits
	batchSize := 10
	for i := 0; i < len(contents); i += batchSize {
		end := i + batchSize
		if end > len(contents) {
			end = len(contents)
		}
		
		// Process batch
		for j := i; j < end; j++ {
			embeddings, err := s.GenerateMultiLevelEmbeddings(ctx, contents[j])
			if err != nil {
				log.Printf("Failed to generate embeddings for content %s: %v", contents[j].ID, err)
				results[j] = make(map[string][]float64)
			} else {
				results[j] = embeddings
			}
		}
		
		// Rate limiting
		if end < len(contents) {
			time.Sleep(100 * time.Millisecond)
		}
	}
	
	return results, nil
}

// Close closes the embedding service
func (s *Service) Close() error {
	return s.client.Close()
}

// Helper methods

func (s *Service) preprocessText(text string) string {
	// Remove excessive whitespace
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\t", " ")
	
	// Remove multiple spaces
	for strings.Contains(text, "  ") {
		text = strings.ReplaceAll(text, "  ", " ")
	}
	
	// Trim and limit length
	text = strings.TrimSpace(text)
	if len(text) > 5000 { // Limit to prevent API errors
		text = text[:5000]
	}
	
	return text
}

func (s *Service) chunkContent(content string, chunkSize int) []string {
	words := strings.Fields(content)
	if len(words) <= chunkSize {
		return []string{content}
	}
	
	var chunks []string
	for i := 0; i < len(words); i += chunkSize {
		end := i + chunkSize
		if end > len(words) {
			end = len(words)
		}
		
		chunk := strings.Join(words[i:end], " ")
		chunks = append(chunks, chunk)
	}
	
	return chunks
}

func (s *Service) averageEmbeddings(embeddings [][]float64) []float64 {
	if len(embeddings) == 0 {
		return nil
	}
	
	if len(embeddings) == 1 {
		return embeddings[0]
	}
	
	// Assume all embeddings have the same dimension
	dim := len(embeddings[0])
	avg := make([]float64, dim)
	
	for _, emb := range embeddings {
		for i, val := range emb {
			avg[i] += val
		}
	}
	
	// Normalize
	count := float64(len(embeddings))
	for i := range avg {
		avg[i] /= count
	}
	
	return avg
}

func (s *Service) enhanceQueryWithContext(query string, context map[string]any) string {
	var enhancements []string
	
	// Add interview type context
	if interviewType, ok := context["interviewType"].(string); ok {
		enhancements = append(enhancements, fmt.Sprintf("interview type: %s", interviewType))
	}
	
	// Add experience level context
	if level, ok := context["experienceLevel"].(string); ok {
		enhancements = append(enhancements, fmt.Sprintf("experience level: %s", level))
	}
	
	// Add company type context
	if companyType, ok := context["companyType"].(string); ok {
		enhancements = append(enhancements, fmt.Sprintf("company type: %s", companyType))
	}
	
	// Add topics context
	if topics, ok := context["topics"].([]string); ok && len(topics) > 0 {
		enhancements = append(enhancements, fmt.Sprintf("topics: %s", strings.Join(topics, ", ")))
	}
	
	// Combine query with context
	if len(enhancements) > 0 {
		return fmt.Sprintf("%s [Context: %s]", query, strings.Join(enhancements, "; "))
	}
	
	return query
}

// CalculateSimilarity calculates cosine similarity between two embeddings
func CalculateSimilarity(emb1, emb2 []float64) float64 {
	if len(emb1) != len(emb2) || len(emb1) == 0 {
		return 0.0
	}
	
	var dotProduct, norm1, norm2 float64
	
	for i := 0; i < len(emb1); i++ {
		dotProduct += emb1[i] * emb2[i]
		norm1 += emb1[i] * emb1[i]
		norm2 += emb2[i] * emb2[i]
	}
	
	if norm1 == 0 || norm2 == 0 {
		return 0.0
	}
	
	return dotProduct / (norm1 * norm2)
}