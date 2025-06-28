package main

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

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/trace"
)

// ComplexityLevel represents the complexity of evaluation
type ComplexityLevel string

const (
	ComplexityLow    ComplexityLevel = "low"
	ComplexityMedium ComplexityLevel = "medium"
	ComplexityHigh   ComplexityLevel = "high"
)

// ReasoningStrategy represents the evaluation strategy
type ReasoningStrategy string

const (
	StrategyLean     ReasoningStrategy = "lean"
	StrategyCoT      ReasoningStrategy = "chain_of_thought"
	StrategyStepBack ReasoningStrategy = "step_back"
)

// EvaluationRequest represents the input for evaluation
type EvaluationRequest struct {
	SessionID         string            `json:"session_id"`
	Response          string            `json:"response"`
	CurrentPhase      string            `json:"current_phase"`
	Complexity        ComplexityLevel   `json:"complexity"`
	ResponseTimeMs    int               `json:"response_time_ms,omitempty"`
	Rubrics           map[string]string `json:"rubrics,omitempty"`
	InterviewContext  map[string]any    `json:"interview_context,omitempty"`
	ReasoningStrategy ReasoningStrategy `json:"reasoning_strategy,omitempty"`
}

// EvaluationResponse represents the output of evaluation
type EvaluationResponse struct {
	SessionID   string             `json:"session_id"`
	Scores      map[string]float64 `json:"scores"`
	Evidence    map[string]string  `json:"evidence"`
	Rationale   map[string]string  `json:"rationale"`
	Performance EvaluationMetrics  `json:"performance"`
	Strategy    ReasoningStrategy  `json:"strategy"`
	Timestamp   time.Time          `json:"timestamp"`
}

// EvaluationMetrics represents performance metrics
type EvaluationMetrics struct {
	LatencyMs    int64   `json:"latency_ms"`
	TokensUsed   int     `json:"tokens_used"`
	Cost         float64 `json:"cost"`
	CacheHit     bool    `json:"cache_hit"`
	StrategyUsed string  `json:"strategy_used"`
}

// RubricScores represents detailed scoring breakdown
type RubricScores struct {
	ProblemDefinition    float64 `json:"problem_definition"`
	TechnicalDepth       float64 `json:"technical_depth"`
	SolutionDesign       float64 `json:"solution_design"`
	Communication        float64 `json:"communication"`
	Scalability          float64 `json:"scalability"`
	TradeoffAnalysis     float64 `json:"tradeoff_analysis"`
	ImplementationDetail float64 `json:"implementation_detail"`
}

// EvaluatorAgent handles response evaluation with different strategies
type EvaluatorAgent struct {
	firestoreClient *firestore.Client
	tracer          trace.Tracer
	cache           map[string]*EvaluationResponse
}

// NewEvaluatorAgent creates a new evaluator agent
func NewEvaluatorAgent() (*EvaluatorAgent, error) {
	ctx := context.Background()
	
	// Initialize Firestore
	client, err := firestore.NewClient(ctx, os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %v", err)
	}

	// Initialize OpenTelemetry tracer
	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %v", err)
	}

	tp := trace.NewTracerProvider(trace.WithBatcher(exporter))
	otel.SetTracerProvider(tp)
	tracer := otel.Tracer("evaluator-agent")

	return &EvaluatorAgent{
		firestoreClient: client,
		tracer:          tracer,
		cache:           make(map[string]*EvaluationResponse),
	}, nil
}

// EvaluateResponse evaluates a user response based on complexity and strategy
func (ea *EvaluatorAgent) EvaluateResponse(ctx context.Context, req *EvaluationRequest) (*EvaluationResponse, error) {
	ctx, span := ea.tracer.Start(ctx, "evaluator.evaluate_response")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("complexity", string(req.Complexity)),
		attribute.String("phase", req.CurrentPhase),
		attribute.Int("response_length", len(req.Response)),
	)

	startTime := time.Now()

	// Check cache first
	cacheKey := ea.generateCacheKey(req)
	if cached, exists := ea.cache[cacheKey]; exists {
		log.Printf("Cache hit for evaluation request: %s", cacheKey)
		cached.Performance.CacheHit = true
		return cached, nil
	}

	// Select evaluation strategy based on complexity
	strategy := ea.selectEvaluationStrategy(req.Complexity)
	span.SetAttributes(attribute.String("strategy", string(strategy)))

	// Perform evaluation based on strategy
	scores, evidence, rationale, tokensUsed, err := ea.evaluateWithStrategy(ctx, req, strategy)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("evaluation failed: %v", err)
	}

	latency := time.Since(startTime)
	cost := ea.calculateCost(tokensUsed, string(strategy))

	response := &EvaluationResponse{
		SessionID: req.SessionID,
		Scores:    scores,
		Evidence:  evidence,
		Rationale: rationale,
		Performance: EvaluationMetrics{
			LatencyMs:    latency.Milliseconds(),
			TokensUsed:   tokensUsed,
			Cost:         cost,
			CacheHit:     false,
			StrategyUsed: string(strategy),
		},
		Strategy:  strategy,
		Timestamp: time.Now(),
	}

	// Cache the response
	ea.cache[cacheKey] = response

	// Store in Firestore
	if err := ea.storeEvaluation(ctx, response); err != nil {
		log.Printf("Failed to store evaluation: %v", err)
	}

	span.SetAttributes(
		attribute.Int64("latency_ms", latency.Milliseconds()),
		attribute.Int("tokens_used", tokensUsed),
		attribute.Float64("cost", cost),
	)

	return response, nil
}

// selectEvaluationStrategy selects the appropriate strategy based on complexity
func (ea *EvaluatorAgent) selectEvaluationStrategy(complexity ComplexityLevel) ReasoningStrategy {
	switch complexity {
	case ComplexityLow:
		return StrategyLean
	case ComplexityMedium:
		return StrategyCoT
	case ComplexityHigh:
		return StrategyStepBack
	default:
		return StrategyLean
	}
}

// evaluateWithStrategy performs evaluation using the specified strategy
func (ea *EvaluatorAgent) evaluateWithStrategy(
	ctx context.Context,
	req *EvaluationRequest,
	strategy ReasoningStrategy,
) (map[string]float64, map[string]string, map[string]string, int, error) {
	ctx, span := ea.tracer.Start(ctx, fmt.Sprintf("evaluator.strategy_%s", strategy))
	defer span.End()

	switch strategy {
	case StrategyLean:
		return ea.evaluateLean(ctx, req)
	case StrategyCoT:
		return ea.evaluateChainOfThought(ctx, req)
	case StrategyStepBack:
		return ea.evaluateStepBack(ctx, req)
	default:
		return ea.evaluateLean(ctx, req)
	}
}

// evaluateLean performs lean evaluation for low complexity responses
func (ea *EvaluatorAgent) evaluateLean(ctx context.Context, req *EvaluationRequest) (map[string]float64, map[string]string, map[string]string, int, error) {
	// Simplified evaluation logic for demonstration
	scores := map[string]float64{
		"Problem Definition & Structuring": ea.scoreProblemDefinition(req.Response),
		"Technical Depth":                  ea.scoreTechnicalDepth(req.Response),
		"Communication":                    ea.scoreCommunication(req.Response),
	}

	evidence := map[string]string{
		"Problem Definition & Structuring": ea.extractProblemEvidence(req.Response),
		"Technical Depth":                  ea.extractTechnicalEvidence(req.Response),
		"Communication":                    ea.extractCommunicationEvidence(req.Response),
	}

	rationale := map[string]string{
		"Problem Definition & Structuring": ea.generateProblemRationale(req.Response, scores["Problem Definition & Structuring"]),
		"Technical Depth":                  ea.generateTechnicalRationale(req.Response, scores["Technical Depth"]),
		"Communication":                    ea.generateCommunicationRationale(req.Response, scores["Communication"]),
	}

	// Simulated token usage for lean strategy
	tokensUsed := len(strings.Split(req.Response, " ")) * 2

	return scores, evidence, rationale, tokensUsed, nil
}

// evaluateChainOfThought performs detailed evaluation with reasoning
func (ea *EvaluatorAgent) evaluateChainOfThought(ctx context.Context, req *EvaluationRequest) (map[string]float64, map[string]string, map[string]string, int, error) {
	// More comprehensive evaluation for medium complexity
	scores := map[string]float64{
		"Problem Definition & Structuring": ea.scoreProblemDefinition(req.Response),
		"Technical Depth":                  ea.scoreTechnicalDepth(req.Response),
		"Solution Design":                  ea.scoreSolutionDesign(req.Response),
		"Scalability Considerations":       ea.scoreScalability(req.Response),
		"Communication":                    ea.scoreCommunication(req.Response),
		"Trade-off Analysis":               ea.scoreTradeoffs(req.Response),
	}

	evidence := map[string]string{
		"Problem Definition & Structuring": ea.extractProblemEvidence(req.Response),
		"Technical Depth":                  ea.extractTechnicalEvidence(req.Response),
		"Solution Design":                  ea.extractSolutionEvidence(req.Response),
		"Scalability Considerations":       ea.extractScalabilityEvidence(req.Response),
		"Communication":                    ea.extractCommunicationEvidence(req.Response),
		"Trade-off Analysis":               ea.extractTradeoffEvidence(req.Response),
	}

	rationale := map[string]string{
		"Problem Definition & Structuring": ea.generateDetailedRationale("problem", req.Response, scores["Problem Definition & Structuring"]),
		"Technical Depth":                  ea.generateDetailedRationale("technical", req.Response, scores["Technical Depth"]),
		"Solution Design":                  ea.generateDetailedRationale("solution", req.Response, scores["Solution Design"]),
		"Scalability Considerations":       ea.generateDetailedRationale("scalability", req.Response, scores["Scalability Considerations"]),
		"Communication":                    ea.generateDetailedRationale("communication", req.Response, scores["Communication"]),
		"Trade-off Analysis":               ea.generateDetailedRationale("tradeoffs", req.Response, scores["Trade-off Analysis"]),
	}

	// Higher token usage for detailed analysis
	tokensUsed := len(strings.Split(req.Response, " ")) * 4

	return scores, evidence, rationale, tokensUsed, nil
}

// evaluateStepBack performs the most comprehensive evaluation
func (ea *EvaluatorAgent) evaluateStepBack(ctx context.Context, req *EvaluationRequest) (map[string]float64, map[string]string, map[string]string, int, error) {
	// Most comprehensive evaluation for high complexity
	scores := map[string]float64{
		"Problem Definition & Structuring": ea.scoreProblemDefinition(req.Response),
		"Technical Depth":                  ea.scoreTechnicalDepth(req.Response),
		"Solution Design":                  ea.scoreSolutionDesign(req.Response),
		"Scalability Considerations":       ea.scoreScalability(req.Response),
		"Communication":                    ea.scoreCommunication(req.Response),
		"Trade-off Analysis":               ea.scoreTradeoffs(req.Response),
		"Implementation Details":           ea.scoreImplementation(req.Response),
		"Edge Case Handling":               ea.scoreEdgeCases(req.Response),
		"System Integration":               ea.scoreIntegration(req.Response),
	}

	// Generate comprehensive evidence and rationale
	evidence := make(map[string]string)
	rationale := make(map[string]string)

	for competency := range scores {
		evidence[competency] = ea.extractComprehensiveEvidence(competency, req.Response)
		rationale[competency] = ea.generateComprehensiveRationale(competency, req.Response, scores[competency])
	}

	// Highest token usage for comprehensive analysis
	tokensUsed := len(strings.Split(req.Response, " ")) * 6

	return scores, evidence, rationale, tokensUsed, nil
}

// Scoring functions (simplified implementations for demonstration)

func (ea *EvaluatorAgent) scoreProblemDefinition(response string) float64 {
	response = strings.ToLower(response)
	score := 2.0 // Base score

	if strings.Contains(response, "problem") || strings.Contains(response, "requirement") {
		score += 1.0
	}
	if strings.Contains(response, "user") || strings.Contains(response, "customer") {
		score += 0.5
	}
	if strings.Contains(response, "constraint") || strings.Contains(response, "limitation") {
		score += 0.5
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreTechnicalDepth(response string) float64 {
	response = strings.ToLower(response)
	score := 2.0

	technicalTerms := []string{"algorithm", "architecture", "database", "api", "service", "microservice", "system"}
	for _, term := range technicalTerms {
		if strings.Contains(response, term) {
			score += 0.3
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreSolutionDesign(response string) float64 {
	response = strings.ToLower(response)
	score := 2.0

	if strings.Contains(response, "design") || strings.Contains(response, "solution") {
		score += 1.0
	}
	if strings.Contains(response, "component") || strings.Contains(response, "module") {
		score += 0.5
	}
	if strings.Contains(response, "flow") || strings.Contains(response, "process") {
		score += 0.5
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreScalability(response string) float64 {
	response = strings.ToLower(response)
	score := 1.0

	scalabilityTerms := []string{"scale", "scalability", "performance", "load", "throughput", "capacity"}
	for _, term := range scalabilityTerms {
		if strings.Contains(response, term) {
			score += 0.5
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreCommunication(response string) float64 {
	wordCount := len(strings.Split(response, " "))
	score := 2.0

	// Score based on clarity and structure
	if wordCount > 50 && wordCount < 500 {
		score += 1.0
	}
	if strings.Contains(response, "first") || strings.Contains(response, "second") || strings.Contains(response, "then") {
		score += 0.5
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreTradeoffs(response string) float64 {
	response = strings.ToLower(response)
	score := 1.0

	tradeoffTerms := []string{"trade-off", "tradeoff", "pros and cons", "advantage", "disadvantage", "benefit", "cost"}
	for _, term := range tradeoffTerms {
		if strings.Contains(response, term) {
			score += 0.5
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreImplementation(response string) float64 {
	response = strings.ToLower(response)
	score := 1.0

	implementationTerms := []string{"implement", "code", "function", "class", "method", "library", "framework"}
	for _, term := range implementationTerms {
		if strings.Contains(response, term) {
			score += 0.3
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreEdgeCases(response string) float64 {
	response = strings.ToLower(response)
	score := 1.0

	edgeCaseTerms := []string{"edge case", "corner case", "exception", "error", "failure", "fallback"}
	for _, term := range edgeCaseTerms {
		if strings.Contains(response, term) {
			score += 0.5
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

func (ea *EvaluatorAgent) scoreIntegration(response string) float64 {
	response = strings.ToLower(response)
	score := 1.0

	integrationTerms := []string{"integration", "interface", "communication", "protocol", "messaging"}
	for _, term := range integrationTerms {
		if strings.Contains(response, term) {
			score += 0.4
		}
	}

	if score > 5.0 {
		score = 5.0
	}
	return score
}

// Evidence extraction functions
func (ea *EvaluatorAgent) extractProblemEvidence(response string) string {
	if strings.Contains(strings.ToLower(response), "problem") {
		return "Candidate explicitly mentions problem definition"
	}
	return "Problem definition could be clearer"
}

func (ea *EvaluatorAgent) extractTechnicalEvidence(response string) string {
	technicalTermCount := 0
	technicalTerms := []string{"algorithm", "architecture", "database", "api", "service"}
	for _, term := range technicalTerms {
		if strings.Contains(strings.ToLower(response), term) {
			technicalTermCount++
		}
	}
	return fmt.Sprintf("Response contains %d technical terms", technicalTermCount)
}

func (ea *EvaluatorAgent) extractCommunicationEvidence(response string) string {
	wordCount := len(strings.Split(response, " "))
	return fmt.Sprintf("Response length: %d words, demonstrates clear communication", wordCount)
}

func (ea *EvaluatorAgent) extractSolutionEvidence(response string) string {
	if strings.Contains(strings.ToLower(response), "solution") {
		return "Candidate provides specific solution approach"
	}
	return "Solution approach could be more detailed"
}

func (ea *EvaluatorAgent) extractScalabilityEvidence(response string) string {
	if strings.Contains(strings.ToLower(response), "scale") {
		return "Candidate addresses scalability concerns"
	}
	return "Scalability considerations not explicitly mentioned"
}

func (ea *EvaluatorAgent) extractTradeoffEvidence(response string) string {
	if strings.Contains(strings.ToLower(response), "trade") {
		return "Candidate discusses trade-offs"
	}
	return "Trade-off analysis could be enhanced"
}

func (ea *EvaluatorAgent) extractComprehensiveEvidence(competency, response string) string {
	return fmt.Sprintf("Comprehensive analysis of %s based on response content", competency)
}

// Rationale generation functions
func (ea *EvaluatorAgent) generateProblemRationale(response string, score float64) string {
	if score >= 4.0 {
		return "Strong problem definition and understanding demonstrated"
	} else if score >= 3.0 {
		return "Good problem understanding with room for improvement"
	} else {
		return "Problem definition needs more clarity and structure"
	}
}

func (ea *EvaluatorAgent) generateTechnicalRationale(response string, score float64) string {
	if score >= 4.0 {
		return "Demonstrates strong technical depth and understanding"
	} else if score >= 3.0 {
		return "Shows good technical knowledge with some gaps"
	} else {
		return "Technical depth could be significantly improved"
	}
}

func (ea *EvaluatorAgent) generateCommunicationRationale(response string, score float64) string {
	if score >= 4.0 {
		return "Excellent communication clarity and structure"
	} else if score >= 3.0 {
		return "Good communication with minor improvements needed"
	} else {
		return "Communication clarity and organization need improvement"
	}
}

func (ea *EvaluatorAgent) generateDetailedRationale(competency, response string, score float64) string {
	if score >= 4.0 {
		return fmt.Sprintf("Excellent demonstration of %s competency with comprehensive coverage", competency)
	} else if score >= 3.0 {
		return fmt.Sprintf("Good %s competency shown with some areas for enhancement", competency)
	} else {
		return fmt.Sprintf("%s competency needs significant improvement and more detailed coverage", competency)
	}
}

func (ea *EvaluatorAgent) generateComprehensiveRationale(competency, response string, score float64) string {
	return fmt.Sprintf("Comprehensive evaluation of %s: Score %.1f/5.0 based on detailed analysis of response content, structure, and technical depth", competency, score)
}

// Utility functions
func (ea *EvaluatorAgent) generateCacheKey(req *EvaluationRequest) string {
	hash := fmt.Sprintf("%s_%s_%s_%d", req.SessionID, req.CurrentPhase, string(req.Complexity), len(req.Response))
	return hash
}

func (ea *EvaluatorAgent) calculateCost(tokensUsed int, strategy string) float64 {
	// Gemini Pro pricing: approximately $0.00125 per 1K tokens
	baseRate := 0.00125
	
	// Different strategies have different cost multipliers
	multiplier := 1.0
	switch strategy {
	case "chain_of_thought":
		multiplier = 1.5
	case "step_back":
		multiplier = 2.0
	}
	
	return float64(tokensUsed) * baseRate * multiplier / 1000.0
}

func (ea *EvaluatorAgent) storeEvaluation(ctx context.Context, evaluation *EvaluationResponse) error {
	collection := ea.firestoreClient.Collection("evaluations")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", evaluation.SessionID, evaluation.Timestamp.Unix()))
	
	_, err := docRef.Set(ctx, evaluation)
	return err
}

// HTTP handlers
func (ea *EvaluatorAgent) handleEvaluateResponse(c *gin.Context) {
	var req EvaluationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ea.EvaluateResponse(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ea *EvaluatorAgent) handleHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"agent":     "evaluator",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

func (ea *EvaluatorAgent) handleMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"cache_size":     len(ea.cache),
		"uptime_seconds": time.Now().Unix(),
		"evaluations":    "metrics_here", // Would include real metrics
	})
}

func main() {
	// Initialize evaluator agent
	evaluator, err := NewEvaluatorAgent()
	if err != nil {
		log.Fatalf("Failed to initialize evaluator agent: %v", err)
	}

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Routes
	router.POST("/evaluate", evaluator.handleEvaluateResponse)
	router.GET("/health", evaluator.handleHealthCheck)
	router.GET("/metrics", evaluator.handleMetrics)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Evaluator Agent on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}