// Package models defines data structures for the RAG service
package models

import (
	"time"
)

// RAGRequest represents a request to retrieve relevant context
type RAGRequest struct {
	Query         string            `json:"query"`
	SessionID     string            `json:"sessionId"`
	UserID        string            `json:"userId"`
	Context       map[string]any    `json:"context"`
	TopK          int               `json:"topK,omitempty"`
	Threshold     float64           `json:"threshold,omitempty"`
	Filters       map[string]any    `json:"filters,omitempty"`
	IncludeChunks bool              `json:"includeChunks,omitempty"`
}

// RAGResponse represents the response with retrieved context
type RAGResponse struct {
	Success        bool                    `json:"success"`
	Results        []RetrievedContent      `json:"results"`
	TotalFound     int                     `json:"totalFound"`
	ProcessingTime time.Duration           `json:"processingTime"`
	Metadata       map[string]any          `json:"metadata"`
	Error          string                  `json:"error,omitempty"`
}

// RetrievedContent represents a piece of retrieved content with relevance score
type RetrievedContent struct {
	ID            string             `json:"id"`
	Title         string             `json:"title"`
	Content       string             `json:"content"`
	Source        string             `json:"source"`
	SourceType    string             `json:"sourceType"` // youtube, blog, assessment
	URL           string             `json:"url,omitempty"`
	Score         float64            `json:"score"`
	Chunks        []ContentChunk     `json:"chunks,omitempty"`
	Metadata      map[string]any     `json:"metadata"`
	CreatedAt     time.Time          `json:"createdAt"`
	LastIndexed   time.Time          `json:"lastIndexed"`
}

// ContentChunk represents a chunk of content with its embedding
type ContentChunk struct {
	ID          string         `json:"id"`
	ParentID    string         `json:"parentId"`
	Content     string         `json:"content"`
	ChunkType   string         `json:"chunkType"` // question, concept, explanation, code
	StartIndex  int            `json:"startIndex"`
	EndIndex    int            `json:"endIndex"`
	Score       float64        `json:"score"`
	Embedding   []float64      `json:"embedding,omitempty"`
	Metadata    map[string]any `json:"metadata"`
}

// EmbeddingRequest represents a request to generate embeddings
type EmbeddingRequest struct {
	Texts     []string       `json:"texts"`
	Model     string         `json:"model,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// EmbeddingResponse represents the response with generated embeddings
type EmbeddingResponse struct {
	Success    bool           `json:"success"`
	Embeddings [][]float64    `json:"embeddings"`
	Model      string         `json:"model"`
	Metadata   map[string]any `json:"metadata"`
	Error      string         `json:"error,omitempty"`
}

// IndexedContent represents content that has been processed and indexed
type IndexedContent struct {
	ID               string            `firestore:"id"`
	Title            string            `firestore:"title"`
	Content          string            `firestore:"content"`
	Summary          string            `firestore:"summary"`
	Source           string            `firestore:"source"`
	SourceType       string            `firestore:"sourceType"`
	URL              string            `firestore:"url"`
	Tags             []string          `firestore:"tags"`
	
	// Embedding information
	Embeddings       map[string][]float64 `firestore:"embeddings"`      // Multiple embedding types
	ChunkIDs         []string             `firestore:"chunkIds"`        // References to chunks
	IndexedAt        time.Time            `firestore:"indexedAt"`       // When vectorized
	QualityScore     float64              `firestore:"qualityScore"`    // Content quality rating (0-1)
	
	// Metadata
	Metadata         map[string]any    `firestore:"metadata"`
	InterviewTypes   []string          `firestore:"interviewTypes"`  // technical, behavioral, system_design
	CompanyTypes     []string          `firestore:"companyTypes"`    // faang, startup, enterprise
	ExperienceLevels []string          `firestore:"experienceLevels"` // junior, mid, senior, staff
	Topics           []string          `firestore:"topics"`          // algorithms, system_design, etc.
	
	// Timestamps
	CreatedAt        time.Time         `firestore:"createdAt"`
	UpdatedAt        time.Time         `firestore:"updatedAt"`
}

// SearchFilters represents filters for content search
type SearchFilters struct {
	SourceTypes      []string   `json:"sourceTypes,omitempty"`
	InterviewTypes   []string   `json:"interviewTypes,omitempty"`
	CompanyTypes     []string   `json:"companyTypes,omitempty"`
	ExperienceLevels []string   `json:"experienceLevels,omitempty"`
	Topics           []string   `json:"topics,omitempty"`
	MinQualityScore  float64    `json:"minQualityScore,omitempty"`
	DateRange        *DateRange `json:"dateRange,omitempty"`
}

// DateRange represents a date range filter
type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// VectorSearchRequest represents a request to vector search service
type VectorSearchRequest struct {
	QueryEmbedding []float64      `json:"queryEmbedding"`
	TopK           int            `json:"topK"`
	Filters        SearchFilters  `json:"filters"`
	Threshold      float64        `json:"threshold"`
	IncludeChunks  bool           `json:"includeChunks"`
}

// VectorSearchResponse represents response from vector search
type VectorSearchResponse struct {
	Success   bool                 `json:"success"`
	Results   []VectorSearchResult `json:"results"`
	QueryTime time.Duration        `json:"queryTime"`
	Error     string               `json:"error,omitempty"`
}

// VectorSearchResult represents a single search result
type VectorSearchResult struct {
	ID       string         `json:"id"`
	Score    float64        `json:"score"`
	Metadata map[string]any `json:"metadata"`
}

// ContextEnhancementRequest represents a request to enhance context
type ContextEnhancementRequest struct {
	Query           string            `json:"query"`
	RetrievedDocs   []RetrievedContent `json:"retrievedDocs"`
	UserContext     map[string]any     `json:"userContext"`
	InterviewState  string             `json:"interviewState"`
	MaxContextSize  int                `json:"maxContextSize,omitempty"`
}

// ContextEnhancementResponse represents enhanced context response
type ContextEnhancementResponse struct {
	Success         bool           `json:"success"`
	EnhancedContext string         `json:"enhancedContext"`
	SourceDocs      []string       `json:"sourceDocs"`
	Relevance       float64        `json:"relevance"`
	TokenCount      int            `json:"tokenCount"`
	Error           string         `json:"error,omitempty"`
}

// RAGMetrics represents metrics for RAG operations
type RAGMetrics struct {
	QueryCount       int64         `json:"queryCount"`
	AverageLatency   time.Duration `json:"averageLatency"`
	CacheHitRate     float64       `json:"cacheHitRate"`
	RetrievalQuality float64       `json:"retrievalQuality"`
	IndexSize        int64         `json:"indexSize"`
	LastUpdated      time.Time     `json:"lastUpdated"`
}

// QualityAssessment represents quality metrics for retrieved content
type QualityAssessment struct {
	Relevance    float64 `json:"relevance"`    // How relevant to query (0-1)
	Completeness float64 `json:"completeness"` // How complete the information is (0-1)
	Freshness    float64 `json:"freshness"`    // How recent the content is (0-1)
	Authority    float64 `json:"authority"`    // How authoritative the source is (0-1)
	Overall      float64 `json:"overall"`      // Overall quality score (0-1)
}

// Constants for content types and categories
const (
	// Source types
	SourceTypeYoutube    = "youtube"
	SourceTypeBlog       = "blog"
	SourceTypeAssessment = "assessment"
	SourceTypeDocument   = "document"
	
	// Content chunk types
	ChunkTypeQuestion    = "question"
	ChunkTypeConcept     = "concept"
	ChunkTypeExplanation = "explanation"
	ChunkTypeCode        = "code"
	ChunkTypeExample     = "example"
	
	// Interview types
	InterviewTypeTechnical     = "technical"
	InterviewTypeBehavioral    = "behavioral"
	InterviewTypeSystemDesign  = "system_design"
	InterviewTypeLeadership    = "leadership"
	InterviewTypeCoding        = "coding"
	
	// Company types
	CompanyTypeFAANG      = "faang"
	CompanyTypeUnicorn    = "unicorn"
	CompanyTypeStartup    = "startup"
	CompanyTypeEnterprise = "enterprise"
	
	// Experience levels
	ExperienceLevelJunior = "junior"
	ExperienceLevelMid    = "mid"
	ExperienceLevelSenior = "senior"
	ExperienceLevelStaff  = "staff"
	ExperienceLevelPrincipal = "principal"
)

// Default values
const (
	DefaultTopK = 10
	DefaultThreshold = 0.7
	DefaultMaxContextSize = 8000 // tokens
	DefaultEmbeddingModel = "text-embedding-004"
)