package processors

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"interviewai.wkv.local/contentscraper/models"
)

// EmbeddingService handles generation of embeddings for content
type EmbeddingService struct {
	apiKey     string
	httpClient *http.Client
	provider   string // "google", "openai", "huggingface"
}

// EmbeddingRequest represents a request to generate embeddings
type EmbeddingRequest struct {
	Input string `json:"input"`
	Model string `json:"model,omitempty"`
}

// EmbeddingResponse represents the response from embedding API
type EmbeddingResponse struct {
	Embeddings [][]float64 `json:"embeddings,omitempty"`
	Data       []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data,omitempty"`
}

// GoogleEmbeddingRequest for Google AI embeddings
type GoogleEmbeddingRequest struct {
	Instances []struct {
		Content string `json:"content"`
	} `json:"instances"`
}

// GoogleEmbeddingResponse for Google AI embeddings
type GoogleEmbeddingResponse struct {
	Predictions []struct {
		Embeddings struct {
			Values []float64 `json:"values"`
		} `json:"embeddings"`
	} `json:"predictions"`
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(apiKey string, provider string) *EmbeddingService {
	return &EmbeddingService{
		apiKey:   apiKey,
		provider: provider,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GenerateContentEmbeddings generates embeddings for all relevant parts of scraped content
func (es *EmbeddingService) GenerateContentEmbeddings(content *models.ScrapedContent) error {
	if content == nil {
		return fmt.Errorf("content cannot be nil")
	}

	embeddings := make(map[string][]float64)

	// 1. Document-level embedding (full summary)
	if content.Content.Summary != "" {
		docEmbedding, err := es.generateSingleEmbedding(content.Content.Summary)
		if err != nil {
			return fmt.Errorf("failed to generate document embedding: %w", err)
		}
		embeddings["document"] = docEmbedding
	}

	// 2. Title and description embedding
	titleDesc := content.Source.Title + " " + content.Source.Description
	if titleDesc != "" {
		titleEmbedding, err := es.generateSingleEmbedding(titleDesc)
		if err != nil {
			return fmt.Errorf("failed to generate title embedding: %w", err)
		}
		embeddings["title"] = titleEmbedding
	}

	// 3. Question-level embeddings
	for i, question := range content.Content.Questions {
		questionText := question.QuestionText
		if question.Context != "" {
			questionText += " " + question.Context
		}
		
		questionEmbedding, err := es.generateSingleEmbedding(questionText)
		if err != nil {
			return fmt.Errorf("failed to generate question %d embedding: %w", i, err)
		}
		embeddings[fmt.Sprintf("question_%d", i)] = questionEmbedding
	}

	// 4. Concept-level embeddings
	for i, concept := range content.Content.Concepts {
		conceptText := concept.Term + ": " + concept.Explanation
		if len(concept.Examples) > 0 {
			conceptText += " Examples: " + strings.Join(concept.Examples, ", ")
		}
		
		conceptEmbedding, err := es.generateSingleEmbedding(conceptText)
		if err != nil {
			return fmt.Errorf("failed to generate concept %d embedding: %w", i, err)
		}
		embeddings[fmt.Sprintf("concept_%d", i)] = conceptEmbedding
	}

	// 5. Tips embedding (combined)
	if len(content.Content.Tips) > 0 {
		var tipTexts []string
		for _, tip := range content.Content.Tips {
			tipText := tip.Tip
			if tip.Reasoning != "" {
				tipText += " " + tip.Reasoning
			}
			tipTexts = append(tipTexts, tipText)
		}
		
		combinedTips := strings.Join(tipTexts, " ")
		tipsEmbedding, err := es.generateSingleEmbedding(combinedTips)
		if err != nil {
			return fmt.Errorf("failed to generate tips embedding: %w", err)
		}
		embeddings["tips"] = tipsEmbedding
	}

	// 6. Chunk embeddings for long transcripts
	if content.Content.FullTranscript != "" {
		chunks := es.chunkText(content.Content.FullTranscript, 500) // 500 words per chunk
		for i, chunk := range chunks {
			chunkEmbedding, err := es.generateSingleEmbedding(chunk)
			if err != nil {
				return fmt.Errorf("failed to generate chunk %d embedding: %w", i, err)
			}
			embeddings[fmt.Sprintf("chunk_%d", i)] = chunkEmbedding
		}
	}

	// Store embeddings in the content structure
	if content.Embeddings == nil {
		content.Embeddings = &models.EmbeddingData{
			Model:   es.getModelName(),
			Vectors: [][]float64{},
		}
	}

	// Convert map to slice and store metadata
	content.EmbeddingMetadata = make(map[string]interface{})
	for key, embedding := range embeddings {
		content.Embeddings.Vectors = append(content.Embeddings.Vectors, embedding)
		content.EmbeddingMetadata[key] = len(content.Embeddings.Vectors) - 1 // Store index
	}

	return nil
}

// generateSingleEmbedding generates an embedding for a single text
func (es *EmbeddingService) generateSingleEmbedding(text string) ([]float64, error) {
	if text == "" {
		return nil, fmt.Errorf("text cannot be empty")
	}

	// Clean and truncate text if necessary
	cleanText := es.cleanText(text)
	if len(cleanText) > 8000 { // Most embedding models have token limits
		cleanText = cleanText[:8000]
	}

	switch es.provider {
	case "google":
		return es.generateGoogleEmbedding(cleanText)
	case "openai":
		return es.generateOpenAIEmbedding(cleanText)
	default:
		return nil, fmt.Errorf("unsupported embedding provider: %s", es.provider)
	}
}

// generateGoogleEmbedding generates embedding using Google AI
func (es *EmbeddingService) generateGoogleEmbedding(text string) ([]float64, error) {
	url := "https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/textembedding-gecko@003:predict"
	
	reqBody := GoogleEmbeddingRequest{
		Instances: []struct {
			Content string `json:"content"`
		}{
			{Content: text},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+es.apiKey)

	resp, err := es.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status: %d", resp.StatusCode)
	}

	var embeddingResp GoogleEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embeddingResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(embeddingResp.Predictions) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}

	return embeddingResp.Predictions[0].Embeddings.Values, nil
}

// generateOpenAIEmbedding generates embedding using OpenAI
func (es *EmbeddingService) generateOpenAIEmbedding(text string) ([]float64, error) {
	url := "https://api.openai.com/v1/embeddings"
	
	reqBody := EmbeddingRequest{
		Input: text,
		Model: "text-embedding-3-small", // Or text-embedding-3-large for better quality
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+es.apiKey)

	resp, err := es.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status: %d", resp.StatusCode)
	}

	var embeddingResp EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embeddingResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(embeddingResp.Data) == 0 {
		return nil, fmt.Errorf("no embeddings returned")
	}

	return embeddingResp.Data[0].Embedding, nil
}

// Helper functions

func (es *EmbeddingService) cleanText(text string) string {
	// Remove extra whitespace and clean up text
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\t", " ")
	
	// Remove multiple spaces
	for strings.Contains(text, "  ") {
		text = strings.ReplaceAll(text, "  ", " ")
	}
	
	return strings.TrimSpace(text)
}

func (es *EmbeddingService) chunkText(text string, maxWords int) []string {
	words := strings.Fields(text)
	var chunks []string
	
	for i := 0; i < len(words); i += maxWords {
		end := i + maxWords
		if end > len(words) {
			end = len(words)
		}
		
		chunk := strings.Join(words[i:end], " ")
		chunks = append(chunks, chunk)
	}
	
	return chunks
}

func (es *EmbeddingService) getModelName() string {
	switch es.provider {
	case "google":
		return "textembedding-gecko@003"
	case "openai":
		return "text-embedding-3-small"
	default:
		return "unknown"
	}
}

// BatchGenerateEmbeddings generates embeddings for multiple texts in batch
func (es *EmbeddingService) BatchGenerateEmbeddings(texts []string) ([][]float64, error) {
	embeddings := make([][]float64, len(texts))
	
	// For now, process sequentially. In production, implement proper batching
	for i, text := range texts {
		embedding, err := es.generateSingleEmbedding(text)
		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding for text %d: %w", i, err)
		}
		embeddings[i] = embedding
	}
	
	return embeddings, nil
}

// CalculateSimilarity calculates cosine similarity between two embeddings
func CalculateSimilarity(embedding1, embedding2 []float64) (float64, error) {
	if len(embedding1) != len(embedding2) {
		return 0, fmt.Errorf("embedding dimensions don't match")
	}
	
	var dotProduct, norm1, norm2 float64
	
	for i := 0; i < len(embedding1); i++ {
		dotProduct += embedding1[i] * embedding2[i]
		norm1 += embedding1[i] * embedding1[i]
		norm2 += embedding2[i] * embedding2[i]
	}
	
	if norm1 == 0 || norm2 == 0 {
		return 0, nil
	}
	
	similarity := dotProduct / (norm1 * norm2)
	return similarity, nil
}