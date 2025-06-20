package models

// Data models for scraped interview content

// ScrapedContent represents the complete scraped content with metadata
type ScrapedContent struct {
	// Metadata
	Source        ContentSource `json:"source" firestore:"source"`
	ContentType   string        `json:"contentType" firestore:"contentType"`     // "interview_experience", "tutorial", "tips", "system_design", "coding_problem"
	InterviewType string        `json:"interviewType" firestore:"interviewType"` // Maps to existing interview types
	TargetLevel   string        `json:"targetLevel" firestore:"targetLevel"`     // "L3", "L4", "L5", etc.
	TargetCompany string        `json:"targetCompany,omitempty" firestore:"targetCompany,omitempty"`

	// Extracted content
	Content ContentData `json:"content" firestore:"content"`

	// Embeddings for RAG (optional)
	Embeddings         *EmbeddingData         `json:"embeddings,omitempty" firestore:"embeddings,omitempty"`
	EmbeddingMetadata  map[string]interface{} `json:"embeddingMetadata,omitempty" firestore:"embeddingMetadata,omitempty"`
	
	// Content quality and indexing
	QualityScore       float64                `json:"qualityScore,omitempty" firestore:"qualityScore,omitempty"`
	IndexedAt          string                 `json:"indexedAt,omitempty" firestore:"indexedAt,omitempty"`
	
	// Metadata for storage and retrieval
	UserID    string `json:"userId" firestore:"userId"`
	CreatedAt string `json:"createdAt" firestore:"createdAt"`
	UpdatedAt string `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
}

// ContentSource contains metadata about the original source
type ContentSource struct {
	Type          string `json:"type" firestore:"type"`                                   // "youtube" or "blog"
	URL           string `json:"url" firestore:"url"`
	Title         string `json:"title" firestore:"title"`
	Author        string `json:"author" firestore:"author"`
	DatePublished string `json:"datePublished" firestore:"datePublished"`
	Company       string `json:"company,omitempty" firestore:"company,omitempty"`         // If mentioned in content
	Duration      string `json:"duration,omitempty" firestore:"duration,omitempty"`      // For videos
	ViewCount     int64  `json:"viewCount,omitempty" firestore:"viewCount,omitempty"`    // For videos
	Description   string `json:"description,omitempty" firestore:"description,omitempty"` // Video/article description
}

// ContentData contains the extracted structured content
type ContentData struct {
	// For interview questions/experiences
	Questions []Question `json:"questions,omitempty" firestore:"questions,omitempty"`

	// For concepts/explanations
	Concepts []Concept `json:"concepts,omitempty" firestore:"concepts,omitempty"`

	// For tips/best practices
	Tips []Tip `json:"tips,omitempty" firestore:"tips,omitempty"`

	// Raw transcript/text for additional context
	FullTranscript string `json:"fullTranscript,omitempty" firestore:"fullTranscript,omitempty"`

	// Key topics/tags extracted from content
	Tags []string `json:"tags,omitempty" firestore:"tags,omitempty"`

	// Summary of the content
	Summary string `json:"summary,omitempty" firestore:"summary,omitempty"`
}

// Question represents an interview question extracted from content
type Question struct {
	QuestionText string   `json:"questionText" firestore:"questionText"`
	Context      string   `json:"context,omitempty" firestore:"context,omitempty"`         // Context around the question
	SampleAnswer string   `json:"sampleAnswer,omitempty" firestore:"sampleAnswer,omitempty"` // If provided in content
	KeyPoints    []string `json:"keyPoints,omitempty" firestore:"keyPoints,omitempty"`     // Important points to cover
	Difficulty   string   `json:"difficulty,omitempty" firestore:"difficulty,omitempty"`   // "easy", "medium", "hard"
	Category     string   `json:"category,omitempty" firestore:"category,omitempty"`       // "behavioral", "technical", etc.
}

// Concept represents a technical concept or term explained in the content
type Concept struct {
	Term        string   `json:"term" firestore:"term"`
	Explanation string   `json:"explanation" firestore:"explanation"`
	Examples    []string `json:"examples,omitempty" firestore:"examples,omitempty"`
	RelatedTerms []string `json:"relatedTerms,omitempty" firestore:"relatedTerms,omitempty"`
	Importance  string   `json:"importance,omitempty" firestore:"importance,omitempty"` // "high", "medium", "low"
}

// Tip represents advice or best practices from the content
type Tip struct {
	Category  string `json:"category" firestore:"category"`                         // "preparation", "interview_day", "follow_up", etc.
	Tip       string `json:"tip" firestore:"tip"`
	Reasoning string `json:"reasoning,omitempty" firestore:"reasoning,omitempty"`   // Why this tip is important
	Applicable string `json:"applicable,omitempty" firestore:"applicable,omitempty"` // When/where to apply this tip
}

// EmbeddingData contains vector embeddings for RAG retrieval
type EmbeddingData struct {
	Model   string      `json:"model" firestore:"model"`     // Model used for embeddings
	Vectors [][]float64 `json:"vectors" firestore:"vectors"` // Vector embeddings
}

// SearchFilters represents filters for searching scraped content
type SearchFilters struct {
	ContentType   string   `json:"contentType,omitempty"`
	InterviewType string   `json:"interviewType,omitempty"`
	TargetLevel   string   `json:"targetLevel,omitempty"`
	TargetCompany string   `json:"targetCompany,omitempty"`
	SourceType    string   `json:"sourceType,omitempty"` // "youtube", "blog"
	Tags          []string `json:"tags,omitempty"`
	DateRange     DateRange `json:"dateRange,omitempty"`
}

// DateRange represents a date range filter
type DateRange struct {
	From string `json:"from,omitempty"` // ISO date string
	To   string `json:"to,omitempty"`   // ISO date string
}