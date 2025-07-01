package analytics

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"cloud.google.com/go/bigquery"
)

// Client wraps BigQuery client with project-specific configuration
type Client struct {
	bqClient  *bigquery.Client
	projectID string
	datasetID string
	mu        sync.Mutex
	batch     map[string][]interface{}
}

// NewClient creates a new BigQuery analytics client
func NewClient(ctx context.Context, projectID, environment string) (*Client, error) {
	bqClient, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create BigQuery client: %w", err)
	}

	datasetID := fmt.Sprintf("interview_analytics_%s", environment)
	
	return &Client{
		bqClient:  bqClient,
		projectID: projectID,
		datasetID: datasetID,
		batch:     make(map[string][]interface{}),
	}, nil
}

// Close closes the BigQuery client
func (c *Client) Close() error {
	// Flush any remaining batched data
	ctx := context.Background()
	if err := c.FlushAll(ctx); err != nil {
		log.Printf("Error flushing data on close: %v", err)
	}
	return c.bqClient.Close()
}

// InterviewSession represents a row in the interview_sessions table
type InterviewSession struct {
	SessionID       string                 `bigquery:"session_id"`
	UserID          string                 `bigquery:"user_id"`
	StartedAt       time.Time              `bigquery:"started_at"`
	EndedAt         *time.Time             `bigquery:"ended_at"`
	Status          string                 `bigquery:"status"`
	InterviewType   string                 `bigquery:"interview_type"`
	TargetRole      *string                `bigquery:"target_role"`
	Company         *string                `bigquery:"company"`
	DurationSeconds *int64                 `bigquery:"duration_seconds"`
	QuestionCount   *int                   `bigquery:"question_count"`
	CompletionRate  *float64               `bigquery:"completion_rate"`
	Metadata        map[string]interface{} `bigquery:"metadata"`
}

// UserResponse represents a row in the user_responses table
type UserResponse struct {
	ResponseID           string    `bigquery:"response_id"`
	SessionID            string    `bigquery:"session_id"`
	UserID               string    `bigquery:"user_id"`
	QuestionID           string    `bigquery:"question_id"`
	QuestionText         string    `bigquery:"question_text"`
	ResponseText         string    `bigquery:"response_text"`
	ResponseTimestamp    time.Time `bigquery:"response_timestamp"`
	ResponseTimeSeconds  *int      `bigquery:"response_time_seconds"`
	WordCount            *int      `bigquery:"word_count"`
	IsFinalAnswer        bool      `bigquery:"is_final_answer"`
	RevisionCount        *int      `bigquery:"revision_count"`
}

// EvaluationScore represents a row in the evaluation_scores table
type EvaluationScore struct {
	EvaluationID   string    `bigquery:"evaluation_id"`
	ResponseID     string    `bigquery:"response_id"`
	SessionID      string    `bigquery:"session_id"`
	EvaluatedAt    time.Time `bigquery:"evaluated_at"`
	OverallScore   float64   `bigquery:"overall_score"`
	ClarityScore   *float64  `bigquery:"clarity_score"`
	RelevanceScore *float64  `bigquery:"relevance_score"`
	DepthScore     *float64  `bigquery:"depth_score"`
	StructureScore *float64  `bigquery:"structure_score"`
	Strengths      []string  `bigquery:"strengths"`
	Improvements   []string  `bigquery:"improvements"`
	FeedbackText   *string   `bigquery:"feedback_text"`
	EvaluatorAgent string    `bigquery:"evaluator_agent"`
}

// AgentInteraction represents a row in the agent_interactions table
type AgentInteraction struct {
	InteractionID    string                 `bigquery:"interaction_id"`
	SessionID        string                 `bigquery:"session_id"`
	Timestamp        time.Time              `bigquery:"timestamp"`
	SourceAgent      string                 `bigquery:"source_agent"`
	TargetAgent      *string                `bigquery:"target_agent"`
	InteractionType  string                 `bigquery:"interaction_type"`
	Content          *string                `bigquery:"content"`
	ProcessingTimeMs *int                   `bigquery:"processing_time_ms"`
	Success          bool                   `bigquery:"success"`
	ErrorMessage     *string                `bigquery:"error_message"`
	Metadata         map[string]interface{} `bigquery:"metadata"`
}

// InsertInterviewSession inserts a new interview session
func (c *Client) InsertInterviewSession(ctx context.Context, session *InterviewSession) error {
	table := c.bqClient.Dataset(c.datasetID).Table("interview_sessions")
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, session); err != nil {
		return fmt.Errorf("failed to insert interview session: %w", err)
	}
	
	return nil
}

// UpdateInterviewSession updates an existing interview session
func (c *Client) UpdateInterviewSession(ctx context.Context, sessionID string, updates map[string]interface{}) error {
	// For updates, we'll insert a new row with the same session_id
	// BigQuery will handle deduplication in views/queries
	updates["session_id"] = sessionID
	updates["updated_at"] = time.Now()
	
	table := c.bqClient.Dataset(c.datasetID).Table("interview_sessions")
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, updates); err != nil {
		return fmt.Errorf("failed to update interview session: %w", err)
	}
	
	return nil
}

// InsertUserResponse inserts a user response
func (c *Client) InsertUserResponse(ctx context.Context, response *UserResponse) error {
	// Calculate word count if not provided
	if response.WordCount == nil {
		words := len(response.ResponseText) / 5 // Rough estimate
		response.WordCount = &words
	}
	
	table := c.bqClient.Dataset(c.datasetID).Table("user_responses")
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, response); err != nil {
		return fmt.Errorf("failed to insert user response: %w", err)
	}
	
	return nil
}

// InsertEvaluationScore inserts an evaluation score
func (c *Client) InsertEvaluationScore(ctx context.Context, score *EvaluationScore) error {
	table := c.bqClient.Dataset(c.datasetID).Table("evaluation_scores")
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, score); err != nil {
		return fmt.Errorf("failed to insert evaluation score: %w", err)
	}
	
	return nil
}

// InsertAgentInteraction inserts an agent interaction
func (c *Client) InsertAgentInteraction(ctx context.Context, interaction *AgentInteraction) error {
	table := c.bqClient.Dataset(c.datasetID).Table("agent_interactions")
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, interaction); err != nil {
		return fmt.Errorf("failed to insert agent interaction: %w", err)
	}
	
	return nil
}

// BatchInsert adds items to a batch for later insertion
func (c *Client) BatchInsert(tableName string, item interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if _, ok := c.batch[tableName]; !ok {
		c.batch[tableName] = make([]interface{}, 0)
	}
	
	c.batch[tableName] = append(c.batch[tableName], item)
	
	// Auto-flush if batch size exceeds threshold
	if len(c.batch[tableName]) >= 100 {
		go func() {
			ctx := context.Background()
			if err := c.FlushTable(ctx, tableName); err != nil {
				log.Printf("Error flushing table %s: %v", tableName, err)
			}
		}()
	}
}

// FlushTable flushes batched data for a specific table
func (c *Client) FlushTable(ctx context.Context, tableName string) error {
	c.mu.Lock()
	items, ok := c.batch[tableName]
	if !ok || len(items) == 0 {
		c.mu.Unlock()
		return nil
	}
	
	// Clear the batch
	c.batch[tableName] = make([]interface{}, 0)
	c.mu.Unlock()
	
	// Insert the items
	table := c.bqClient.Dataset(c.datasetID).Table(tableName)
	inserter := table.Inserter()
	
	if err := inserter.Put(ctx, items); err != nil {
		return fmt.Errorf("failed to batch insert to %s: %w", tableName, err)
	}
	
	log.Printf("Successfully flushed %d items to %s", len(items), tableName)
	return nil
}

// FlushAll flushes all batched data
func (c *Client) FlushAll(ctx context.Context) error {
	tables := make([]string, 0)
	c.mu.Lock()
	for tableName := range c.batch {
		tables = append(tables, tableName)
	}
	c.mu.Unlock()
	
	for _, tableName := range tables {
		if err := c.FlushTable(ctx, tableName); err != nil {
			return err
		}
	}
	
	return nil
}

// Helper function to create a pointer to a string
func StringPtr(s string) *string {
	return &s
}

// Helper function to create a pointer to an int
func IntPtr(i int) *int {
	return &i
}

// Helper function to create a pointer to a float64
func Float64Ptr(f float64) *float64 {
	return &f
}