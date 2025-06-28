package models

// SearchResult represents a result from semantic search
type SearchResult struct {
	ID          string                 `json:"id"`
	Content     string                 `json:"content"`
	Source      string                 `json:"source"`
	Title       string                 `json:"title"`
	Score       float64                `json:"score"`
	ContentType string                 `json:"contentType"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// IndexedDocument represents a document ready for vector indexing
type IndexedDocument struct {
	ID           string                 `json:"id"`
	Content      string                 `json:"content"`
	Embeddings   map[string][]float64   `json:"embeddings"`
	Metadata     map[string]interface{} `json:"metadata"`
	QualityScore float64                `json:"qualityScore"`
}

// ScrapedContent represents content scraped from various sources
type ScrapedContent struct {
	ID                string                 `json:"id" firestore:"id"`
	Source            ContentSource          `json:"source" firestore:"source"`
	Content           ContentData            `json:"content" firestore:"content"`
	InterviewType     string                 `json:"interviewType" firestore:"interviewType"`
	TargetLevel       string                 `json:"targetLevel" firestore:"targetLevel"`
	TargetCompany     string                 `json:"targetCompany" firestore:"targetCompany"`
	ContentType       string                 `json:"contentType" firestore:"contentType"`
	QualityScore      float64                `json:"qualityScore" firestore:"qualityScore"`
	Embeddings        *EmbeddingData         `json:"embeddings,omitempty" firestore:"embeddings,omitempty"`
	EmbeddingMetadata map[string]interface{} `json:"embeddingMetadata,omitempty" firestore:"embeddingMetadata,omitempty"`
	CreatedAt         int64                  `json:"createdAt" firestore:"createdAt"`
	UpdatedAt         int64                  `json:"updatedAt" firestore:"updatedAt"`
}

// ContentSource represents the source of scraped content
type ContentSource struct {
	URL         string `json:"url" firestore:"url"`
	Title       string `json:"title" firestore:"title"`
	Description string `json:"description" firestore:"description"`
	Author      string `json:"author,omitempty" firestore:"author,omitempty"`
	Domain      string `json:"domain" firestore:"domain"`
	Type        string `json:"type" firestore:"type"`
}

// ContentData represents the actual content data
type ContentData struct {
	Raw     string `json:"raw" firestore:"raw"`
	Summary string `json:"summary" firestore:"summary"`
	Title   string `json:"title" firestore:"title"`
}

// EmbeddingData represents embedding vectors and metadata
type EmbeddingData struct {
	Vectors [][]float64 `json:"vectors" firestore:"vectors"`
	Model   string      `json:"model" firestore:"model"`
	Chunks  []string    `json:"chunks" firestore:"chunks"`
}

// SearchFilters represents filters for semantic search
type SearchFilters struct {
	InterviewType string   `json:"interviewType,omitempty"`
	TargetLevel   string   `json:"targetLevel,omitempty"`
	TargetCompany string   `json:"targetCompany,omitempty"`
	ContentType   string   `json:"contentType,omitempty"`
	SourceType    string   `json:"sourceType,omitempty"`
	Tags          []string `json:"tags,omitempty"`
	MinQuality    float64  `json:"minQuality,omitempty"`
}

// EmbeddingRequest represents a request to generate embeddings
type EmbeddingRequest struct {
	Texts    []string `json:"texts"`
	Model    string   `json:"model,omitempty"`
	Provider string   `json:"provider,omitempty"`
}

// EmbeddingResult represents the result of embedding generation
type EmbeddingResult struct {
	Embeddings [][]float64 `json:"embeddings"`
	Model      string      `json:"model"`
	Dimensions int         `json:"dimensions"`
}
