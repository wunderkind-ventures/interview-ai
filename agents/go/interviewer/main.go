package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/trace"
)

// ComplexityLevel represents the complexity of the interview
type ComplexityLevel string

const (
	ComplexityLow    ComplexityLevel = "low"
	ComplexityMedium ComplexityLevel = "medium"
	ComplexityHigh   ComplexityLevel = "high"
)

// ReasoningStrategy represents the reasoning approach
type ReasoningStrategy string

const (
	StrategyLean     ReasoningStrategy = "lean"
	StrategyCoT      ReasoningStrategy = "chain_of_thought"
	StrategyStepBack ReasoningStrategy = "step_back"
)

// InterviewPhase represents the current phase of the interview
type InterviewPhase string

const (
	PhaseScoping       InterviewPhase = "scoping"
	PhaseAnalysis      InterviewPhase = "analysis"
	PhaseSolutioning   InterviewPhase = "solutioning"
	PhaseMetrics       InterviewPhase = "metrics"
	PhaseChallenging   InterviewPhase = "challenging"
	PhaseReportGen     InterviewPhase = "report_generation"
)

// QuestionRequest represents the input for question generation
type QuestionRequest struct {
	SessionID         string            `json:"session_id"`
	Phase             InterviewPhase    `json:"phase"`
	Complexity        ComplexityLevel   `json:"complexity"`
	ReasoningStrategy ReasoningStrategy `json:"reasoning_strategy"`
	Context           map[string]any    `json:"context,omitempty"`
	PreviousResponses []string          `json:"previous_responses,omitempty"`
	CurrentScores     map[string]float64 `json:"current_scores,omitempty"`
	InterventionData  map[string]any    `json:"intervention_data,omitempty"`
}

// QuestionResponse represents the output of question generation
type QuestionResponse struct {
	SessionID    string               `json:"session_id"`
	Question     string               `json:"question"`
	QuestionType string               `json:"question_type"`
	Phase        InterviewPhase       `json:"phase"`
	Guidance     []string             `json:"guidance,omitempty"`
	FollowUps    []string             `json:"follow_ups,omitempty"`
	Performance  InterviewerMetrics   `json:"performance"`
	Timestamp    time.Time            `json:"timestamp"`
}

// InterventionRequest represents an intervention directive
type InterventionRequest struct {
	SessionID        string         `json:"session_id"`
	InterventionType string         `json:"intervention_type"`
	Message          string         `json:"message"`
	Context          map[string]any `json:"context"`
	Priority         string         `json:"priority"`
}

// InterventionResponse represents the response to an intervention
type InterventionResponse struct {
	SessionID       string             `json:"session_id"`
	Question        string             `json:"question"`
	InterventionApplied bool           `json:"intervention_applied"`
	Performance     InterviewerMetrics `json:"performance"`
	Timestamp       time.Time          `json:"timestamp"`
}

// ChallengeRequest represents a challenge generation request
type ChallengeRequest struct {
	SessionID      string               `json:"session_id"`
	SessionHistory []map[string]any     `json:"session_history"`
	CurrentScores  map[string]float64   `json:"current_scores"`
	Complexity     ComplexityLevel      `json:"complexity"`
	UserStrengths  []string             `json:"user_strengths,omitempty"`
	UserWeaknesses []string             `json:"user_weaknesses,omitempty"`
}

// ChallengeResponse represents the challenge question response
type ChallengeResponse struct {
	SessionID      string             `json:"session_id"`
	Challenge      string             `json:"challenge"`
	ChallengeType  string             `json:"challenge_type"`
	Difficulty     string             `json:"difficulty"`
	TargetArea     string             `json:"target_area"`
	Performance    InterviewerMetrics `json:"performance"`
	Timestamp      time.Time          `json:"timestamp"`
}

// InterviewerMetrics represents performance metrics
type InterviewerMetrics struct {
	LatencyMs          int64   `json:"latency_ms"`
	TokensUsed         int     `json:"tokens_used"`
	Cost               float64 `json:"cost"`
	QuestionComplexity float64 `json:"question_complexity"`
	CacheHit           bool    `json:"cache_hit"`
	StrategyUsed       string  `json:"strategy_used"`
}

// QuestionTemplate represents a question template
type QuestionTemplate struct {
	ID          string         `json:"id"`
	Phase       InterviewPhase `json:"phase"`
	Complexity  ComplexityLevel `json:"complexity"`
	Template    string         `json:"template"`
	Variables   []string       `json:"variables"`
	FollowUps   []string       `json:"follow_ups"`
	Guidance    []string       `json:"guidance"`
}

// InterviewerAgent handles question generation and interventions
type InterviewerAgent struct {
	firestoreClient *firestore.Client
	tracer          trace.Tracer
	templates       map[string][]QuestionTemplate
	cache           map[string]*QuestionResponse
}

// NewInterviewerAgent creates a new interviewer agent
func NewInterviewerAgent() (*InterviewerAgent, error) {
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
	tracer := otel.Tracer("interviewer-agent")

	ia := &InterviewerAgent{
		firestoreClient: client,
		tracer:          tracer,
		templates:       make(map[string][]QuestionTemplate),
		cache:           make(map[string]*QuestionResponse),
	}

	// Initialize question templates
	ia.initializeTemplates()

	return ia, nil
}

// GenerateQuestion generates appropriate interview questions
func (ia *InterviewerAgent) GenerateQuestion(ctx context.Context, req *QuestionRequest) (*QuestionResponse, error) {
	ctx, span := ia.tracer.Start(ctx, "interviewer.generate_question")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("phase", string(req.Phase)),
		attribute.String("complexity", string(req.Complexity)),
		attribute.String("strategy", string(req.ReasoningStrategy)),
	)

	startTime := time.Now()

	// Check cache first
	cacheKey := ia.generateCacheKey(req)
	if cached, exists := ia.cache[cacheKey]; exists {
		log.Printf("Cache hit for question generation: %s", cacheKey)
		cached.Performance.CacheHit = true
		return cached, nil
	}

	// Select appropriate question template
	template, err := ia.selectQuestionTemplate(req.Phase, req.Complexity)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to select question template: %v", err)
	}

	// Generate question using strategy
	question, guidance, followUps, tokensUsed, err := ia.generateWithStrategy(ctx, req, template)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("question generation failed: %v", err)
	}

	latency := time.Since(startTime)
	cost := ia.calculateCost(tokensUsed, string(req.ReasoningStrategy))

	response := &QuestionResponse{
		SessionID:    req.SessionID,
		Question:     question,
		QuestionType: template.ID,
		Phase:        req.Phase,
		Guidance:     guidance,
		FollowUps:    followUps,
		Performance: InterviewerMetrics{
			LatencyMs:          latency.Milliseconds(),
			TokensUsed:         tokensUsed,
			Cost:               cost,
			QuestionComplexity: ia.calculateQuestionComplexity(question, req.Complexity),
			CacheHit:           false,
			StrategyUsed:       string(req.ReasoningStrategy),
		},
		Timestamp: time.Now(),
	}

	// Cache the response
	ia.cache[cacheKey] = response

	// Store in Firestore
	if err := ia.storeQuestion(ctx, response); err != nil {
		log.Printf("Failed to store question: %v", err)
	}

	span.SetAttributes(
		attribute.Int64("latency_ms", latency.Milliseconds()),
		attribute.Int("tokens_used", tokensUsed),
		attribute.Float64("cost", cost),
	)

	return response, nil
}

// HandleIntervention handles intervention directives from orchestrator
func (ia *InterviewerAgent) HandleIntervention(ctx context.Context, req *InterventionRequest) (*InterventionResponse, error) {
	ctx, span := ia.tracer.Start(ctx, "interviewer.handle_intervention")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("intervention_type", req.InterventionType),
		attribute.String("priority", req.Priority),
	)

	startTime := time.Now()

	// Generate intervention-specific question
	question, tokensUsed, err := ia.generateInterventionQuestion(ctx, req)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("intervention question generation failed: %v", err)
	}

	latency := time.Since(startTime)
	cost := ia.calculateCost(tokensUsed, "intervention")

	response := &InterventionResponse{
		SessionID:           req.SessionID,
		Question:            question,
		InterventionApplied: true,
		Performance: InterviewerMetrics{
			LatencyMs:    latency.Milliseconds(),
			TokensUsed:   tokensUsed,
			Cost:         cost,
			CacheHit:     false,
			StrategyUsed: "intervention",
		},
		Timestamp: time.Now(),
	}

	// Store in Firestore
	if err := ia.storeIntervention(ctx, response); err != nil {
		log.Printf("Failed to store intervention: %v", err)
	}

	return response, nil
}

// GenerateChallenge generates challenge questions based on performance
func (ia *InterviewerAgent) GenerateChallenge(ctx context.Context, req *ChallengeRequest) (*ChallengeResponse, error) {
	ctx, span := ia.tracer.Start(ctx, "interviewer.generate_challenge")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("complexity", string(req.Complexity)),
		attribute.Int("scores_count", len(req.CurrentScores)),
	)

	startTime := time.Now()

	// Analyze user performance to identify challenge area
	targetArea, difficulty := ia.analyzePerformanceForChallenge(req.CurrentScores, req.UserWeaknesses)

	// Generate challenge question
	challenge, challengeType, tokensUsed, err := ia.generateChallengeQuestion(ctx, req, targetArea, difficulty)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("challenge generation failed: %v", err)
	}

	latency := time.Since(startTime)
	cost := ia.calculateCost(tokensUsed, "challenge")

	response := &ChallengeResponse{
		SessionID:     req.SessionID,
		Challenge:     challenge,
		ChallengeType: challengeType,
		Difficulty:    difficulty,
		TargetArea:    targetArea,
		Performance: InterviewerMetrics{
			LatencyMs:    latency.Milliseconds(),
			TokensUsed:   tokensUsed,
			Cost:         cost,
			CacheHit:     false,
			StrategyUsed: "challenge",
		},
		Timestamp: time.Now(),
	}

	// Store in Firestore
	if err := ia.storeChallengeQuestion(ctx, response); err != nil {
		log.Printf("Failed to store challenge: %v", err)
	}

	return response, nil
}

// Private methods

func (ia *InterviewerAgent) initializeTemplates() {
	// Initialize question templates for different phases and complexities
	ia.templates[string(PhaseScoping)] = []QuestionTemplate{
		{
			ID:         "scoping_basic",
			Phase:      PhaseScoping,
			Complexity: ComplexityLow,
			Template:   "Let's start by understanding the problem. Can you walk me through how you would approach {problem_type}?",
			Variables:  []string{"problem_type"},
			FollowUps:  []string{"What would be your first step?", "Who are the main stakeholders?"},
			Guidance:   []string{"Look for problem decomposition", "Assess stakeholder identification"},
		},
		{
			ID:         "scoping_advanced",
			Phase:      PhaseScoping,
			Complexity: ComplexityHigh,
			Template:   "Given the complexity of {problem_domain}, how would you structure your approach to ensure we address all critical aspects while maintaining focus on the core problem?",
			Variables:  []string{"problem_domain"},
			FollowUps:  []string{"How would you prioritize these aspects?", "What assumptions are you making?"},
			Guidance:   []string{"Evaluate systematic thinking", "Check for assumption validation"},
		},
	}

	ia.templates[string(PhaseAnalysis)] = []QuestionTemplate{
		{
			ID:         "analysis_users",
			Phase:      PhaseAnalysis,
			Complexity: ComplexityMedium,
			Template:   "Now let's dive deeper into the users. Who exactly are we designing this for, and what are their specific pain points?",
			Variables:  []string{},
			FollowUps:  []string{"How would you validate these pain points?", "What data would you need?"},
			Guidance:   []string{"Assess user empathy", "Check for validation thinking"},
		},
	}

	ia.templates[string(PhaseSolutioning)] = []QuestionTemplate{
		{
			ID:         "solution_approach",
			Phase:      PhaseSolutioning,
			Complexity: ComplexityMedium,
			Template:   "Based on your analysis, what solution would you propose? Walk me through your approach.",
			Variables:  []string{},
			FollowUps:  []string{"Why this approach over alternatives?", "What are the trade-offs?"},
			Guidance:   []string{"Evaluate solution clarity", "Check for trade-off analysis"},
		},
	}

	ia.templates[string(PhaseMetrics)] = []QuestionTemplate{
		{
			ID:         "metrics_definition",
			Phase:      PhaseMetrics,
			Complexity: ComplexityMedium,
			Template:   "How would you measure the success of this solution? What metrics would you track?",
			Variables:  []string{},
			FollowUps:  []string{"What's your North Star metric?", "How would you validate these metrics?"},
			Guidance:   []string{"Check for measurable outcomes", "Assess metric relevance"},
		},
	}
}

func (ia *InterviewerAgent) selectQuestionTemplate(phase InterviewPhase, complexity ComplexityLevel) (*QuestionTemplate, error) {
	templates := ia.templates[string(phase)]
	if len(templates) == 0 {
		return nil, fmt.Errorf("no templates found for phase %s", phase)
	}

	// Find templates matching complexity
	var candidates []QuestionTemplate
	for _, template := range templates {
		if template.Complexity == complexity {
			candidates = append(candidates, template)
		}
	}

	// If no exact match, use any template from the phase
	if len(candidates) == 0 {
		candidates = templates
	}

	// Select random template (in production, this would be more sophisticated)
	rand.Seed(time.Now().UnixNano())
	selected := candidates[rand.Intn(len(candidates))]
	return &selected, nil
}

func (ia *InterviewerAgent) generateWithStrategy(
	ctx context.Context,
	req *QuestionRequest,
	template *QuestionTemplate,
) (string, []string, []string, int, error) {
	ctx, span := ia.tracer.Start(ctx, fmt.Sprintf("interviewer.strategy_%s", req.ReasoningStrategy))
	defer span.End()

	switch req.ReasoningStrategy {
	case StrategyLean:
		return ia.generateLeanQuestion(ctx, req, template)
	case StrategyCoT:
		return ia.generateCoTQuestion(ctx, req, template)
	case StrategyStepBack:
		return ia.generateStepBackQuestion(ctx, req, template)
	default:
		return ia.generateLeanQuestion(ctx, req, template)
	}
}

func (ia *InterviewerAgent) generateLeanQuestion(
	ctx context.Context,
	req *QuestionRequest,
	template *QuestionTemplate,
) (string, []string, []string, int, error) {
	// Simple template substitution for lean strategy
	question := template.Template
	
	// Replace variables with context-specific values
	for _, variable := range template.Variables {
		if contextValue, exists := req.Context[variable]; exists {
			if str, ok := contextValue.(string); ok {
				question = strings.Replace(question, "{"+variable+"}", str, -1)
			}
		}
	}

	// Remove any remaining variable placeholders
	question = strings.ReplaceAll(question, "{problem_type}", "this system design challenge")
	question = strings.ReplaceAll(question, "{problem_domain}", "this complex technical problem")

	tokensUsed := len(strings.Split(question, " ")) * 2 // Simulated token usage

	return question, template.Guidance, template.FollowUps, tokensUsed, nil
}

func (ia *InterviewerAgent) generateCoTQuestion(
	ctx context.Context,
	req *QuestionRequest,
	template *QuestionTemplate,
) (string, []string, []string, int, error) {
	// Enhanced question generation with reasoning prompts
	baseQuestion, guidance, followUps, baseTokens, err := ia.generateLeanQuestion(ctx, req, template)
	if err != nil {
		return "", nil, nil, 0, err
	}

	// Add reasoning prompts
	enhancedQuestion := baseQuestion + " Please walk me through your thought process step by step."
	
	// Enhanced guidance
	enhancedGuidance := append(guidance, "Look for step-by-step reasoning", "Assess logical flow")
	
	// Enhanced follow-ups
	enhancedFollowUps := append(followUps, "Can you explain your reasoning for that choice?", "What led you to that conclusion?")

	tokensUsed := baseTokens * 2 // More tokens for enhanced generation

	return enhancedQuestion, enhancedGuidance, enhancedFollowUps, tokensUsed, nil
}

func (ia *InterviewerAgent) generateStepBackQuestion(
	ctx context.Context,
	req *QuestionRequest,
	template *QuestionTemplate,
) (string, []string, []string, int, error) {
	// Most comprehensive question generation
	baseQuestion, guidance, followUps, baseTokens, err := ia.generateCoTQuestion(ctx, req, template)
	if err != nil {
		return "", nil, nil, 0, err
	}

	// Add meta-cognitive prompts
	comprehensiveQuestion := baseQuestion + " Also consider: What assumptions are you making? What could go wrong with this approach? How would you validate your solution?"

	// Comprehensive guidance
	comprehensiveGuidance := append(guidance, "Evaluate meta-cognitive awareness", "Check for risk assessment", "Look for validation strategies")

	// Comprehensive follow-ups
	comprehensiveFollowUps := append(followUps, "What are the biggest risks here?", "How would you test this hypothesis?", "What would change your mind about this approach?")

	tokensUsed := baseTokens * 3 // Most tokens for comprehensive generation

	return comprehensiveQuestion, comprehensiveGuidance, comprehensiveFollowUps, tokensUsed, nil
}

func (ia *InterviewerAgent) generateInterventionQuestion(ctx context.Context, req *InterventionRequest) (string, int, error) {
	// Generate intervention-specific questions based on type
	interventionQuestions := map[string]string{
		"prevent_premature_solutioning": "That's an interesting idea. Before we dive into solutions, could you first walk me through how you're structuring your overall approach to this problem?",
		"ensure_user_focus":             "This is a good start. Could you tell me more about the specific users or customers you are designing this for?",
		"demand_prioritization_rationale": "That sounds like a viable solution. Can you walk me through why you chose this particular solution over other alternatives you may have considered?",
		"require_measurable_metrics":    "How would you measure the success of what you just described? What specific metrics would tell us this is working?",
		"handle_silence_or_confusion":   "Take your time. Sometimes it helps to start with what you know for certain and build from there. What aspect of this problem feels most clear to you right now?",
	}

	question, exists := interventionQuestions[req.InterventionType]
	if !exists {
		question = req.Message // Fall back to the provided message
	}

	tokensUsed := len(strings.Split(question, " ")) * 2

	return question, tokensUsed, nil
}

func (ia *InterviewerAgent) analyzePerformanceForChallenge(scores map[string]float64, weaknesses []string) (string, string) {
	// Identify the area with lowest scores for targeted challenges
	lowestScore := 5.0
	targetArea := "technical_depth"

	for area, score := range scores {
		if score < lowestScore {
			lowestScore = score
			targetArea = area
		}
	}

	// Determine difficulty based on overall performance
	averageScore := 0.0
	for _, score := range scores {
		averageScore += score
	}
	averageScore /= float64(len(scores))

	difficulty := "medium"
	if averageScore < 2.5 {
		difficulty = "easy"
	} else if averageScore > 4.0 {
		difficulty = "hard"
	}

	return targetArea, difficulty
}

func (ia *InterviewerAgent) generateChallengeQuestion(
	ctx context.Context,
	req *ChallengeRequest,
	targetArea string,
	difficulty string,
) (string, string, int, error) {
	challengeTemplates := map[string]map[string]string{
		"technical_depth": {
			"easy":   "Let's explore the technical aspects a bit more. Can you walk me through the specific technologies you would use and why?",
			"medium": "I'd like to challenge your technical approach. How would you handle [specific technical constraint] while maintaining [performance requirement]?",
			"hard":   "Let's dive deep into the technical implementation. Design the complete system architecture including fault tolerance, monitoring, and deployment strategies.",
		},
		"scalability": {
			"easy":   "How would this solution work if we had 10x more users?",
			"medium": "Design for scale: How would you handle 1 million concurrent users while maintaining sub-second response times?",
			"hard":   "Your solution needs to scale globally across multiple regions with strict consistency requirements. Walk me through your approach.",
		},
		"problem_definition": {
			"easy":   "Let's make sure we have the problem clearly defined. What's the core issue we're really solving here?",
			"medium": "I want to challenge your problem framing. What if the real problem is actually something different? How would you validate your assumptions?",
			"hard":   "Design an experiment to prove that the problem you've identified is actually the right problem to solve. What would convince you to pivot?",
		},
	}

	challengeType := fmt.Sprintf("%s_%s", targetArea, difficulty)
	
	templates, exists := challengeTemplates[targetArea]
	if !exists {
		templates = challengeTemplates["technical_depth"]
	}

	challenge, exists := templates[difficulty]
	if !exists {
		challenge = templates["medium"]
	}

	tokensUsed := len(strings.Split(challenge, " ")) * 3 // Challenge questions use more tokens

	return challenge, challengeType, tokensUsed, nil
}

func (ia *InterviewerAgent) calculateQuestionComplexity(question string, complexity ComplexityLevel) float64 {
	wordCount := len(strings.Split(question, " "))
	baseComplexity := map[ComplexityLevel]float64{
		ComplexityLow:    1.0,
		ComplexityMedium: 2.0,
		ComplexityHigh:   3.0,
	}

	// Adjust based on question length and content
	lengthFactor := float64(wordCount) / 20.0 // Normalize by typical question length
	complexWords := strings.Count(strings.ToLower(question), "architecture") +
		strings.Count(strings.ToLower(question), "scalability") +
		strings.Count(strings.ToLower(question), "implementation")

	return baseComplexity[complexity] + lengthFactor + float64(complexWords)*0.1
}

func (ia *InterviewerAgent) calculateCost(tokensUsed int, strategy string) float64 {
	// Gemini Pro pricing: approximately $0.00125 per 1K tokens
	baseRate := 0.00125

	// Different strategies have different cost multipliers
	multiplier := 1.0
	switch strategy {
	case "chain_of_thought":
		multiplier = 1.5
	case "step_back":
		multiplier = 2.0
	case "intervention":
		multiplier = 1.2
	case "challenge":
		multiplier = 1.8
	}

	return float64(tokensUsed) * baseRate * multiplier / 1000.0
}

func (ia *InterviewerAgent) generateCacheKey(req *QuestionRequest) string {
	hash := fmt.Sprintf("%s_%s_%s_%s_%d", 
		req.SessionID, 
		string(req.Phase), 
		string(req.Complexity), 
		string(req.ReasoningStrategy),
		len(req.PreviousResponses))
	return hash
}

func (ia *InterviewerAgent) storeQuestion(ctx context.Context, question *QuestionResponse) error {
	collection := ia.firestoreClient.Collection("questions")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", question.SessionID, question.Timestamp.Unix()))

	_, err := docRef.Set(ctx, question)
	return err
}

func (ia *InterviewerAgent) storeIntervention(ctx context.Context, intervention *InterventionResponse) error {
	collection := ia.firestoreClient.Collection("interventions")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", intervention.SessionID, intervention.Timestamp.Unix()))

	_, err := docRef.Set(ctx, intervention)
	return err
}

func (ia *InterviewerAgent) storeChallengeQuestion(ctx context.Context, challenge *ChallengeResponse) error {
	collection := ia.firestoreClient.Collection("challenges")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", challenge.SessionID, challenge.Timestamp.Unix()))

	_, err := docRef.Set(ctx, challenge)
	return err
}

// HTTP handlers
func (ia *InterviewerAgent) handleGenerateQuestion(c *gin.Context) {
	var req QuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ia.GenerateQuestion(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ia *InterviewerAgent) handleIntervention(c *gin.Context) {
	var req InterventionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ia.HandleIntervention(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ia *InterviewerAgent) handleGenerateChallenge(c *gin.Context) {
	var req ChallengeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ia.GenerateChallenge(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ia *InterviewerAgent) handleHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"agent":     "interviewer",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

func (ia *InterviewerAgent) handleMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"cache_size":     len(ia.cache),
		"templates":      len(ia.templates),
		"uptime_seconds": time.Now().Unix(),
	})
}

func main() {
	// Initialize interviewer agent
	interviewer, err := NewInterviewerAgent()
	if err != nil {
		log.Fatalf("Failed to initialize interviewer agent: %v", err)
	}

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Routes
	router.POST("/generate", interviewer.handleGenerateQuestion)
	router.POST("/intervention", interviewer.handleIntervention)
	router.POST("/challenge", interviewer.handleGenerateChallenge)
	router.GET("/health", interviewer.handleHealthCheck)
	router.GET("/metrics", interviewer.handleMetrics)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("Starting Interviewer Agent on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}