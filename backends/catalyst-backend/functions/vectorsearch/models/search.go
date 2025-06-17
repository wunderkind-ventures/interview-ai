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