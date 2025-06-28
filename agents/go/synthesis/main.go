package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/trace"
)

// ComplexityLevel represents the complexity of analysis
type ComplexityLevel string

const (
	ComplexityLow    ComplexityLevel = "low"
	ComplexityMedium ComplexityLevel = "medium"
	ComplexityHigh   ComplexityLevel = "high"
)

// ReportType represents different types of reports
type ReportType string

const (
	ReportTypeDetailed ReportType = "detailed"
	ReportTypeSummary  ReportType = "summary"
	ReportTypeExecutive ReportType = "executive"
)

// SynthesisRequest represents the input for report generation
type SynthesisRequest struct {
	SessionID      string             `json:"session_id"`
	UserID         string             `json:"user_id"`
	SessionData    map[string]any     `json:"session_data"`
	FinalScores    map[string]float64 `json:"final_scores"`
	ReportType     ReportType         `json:"report_type"`
	InterviewType  string             `json:"interview_type"`
	Duration       int64              `json:"duration_minutes"`
	Interventions  []map[string]any   `json:"interventions,omitempty"`
	StateHistory   []map[string]any   `json:"state_history,omitempty"`
}

// SynthesisResponse represents the complete interview report
type SynthesisResponse struct {
	SessionID      string             `json:"session_id"`
	UserID         string             `json:"user_id"`
	Report         InterviewReport    `json:"report"`
	Performance    SynthesisMetrics   `json:"performance"`
	Timestamp      time.Time          `json:"timestamp"`
}

// InterviewReport represents the complete interview analysis
type InterviewReport struct {
	OverallScore       float64                    `json:"overall_score"`
	OverallRating      string                     `json:"overall_rating"`
	Summary            string                     `json:"summary"`
	CompetencyScores   map[string]CompetencyScore `json:"competency_scores"`
	KeyStrengths       []string                   `json:"key_strengths"`
	AreasForImprovement []string                  `json:"areas_for_improvement"`
	DetailedAnalysis   DetailedAnalysis           `json:"detailed_analysis"`
	Recommendations    []Recommendation           `json:"recommendations"`
	InterviewMetadata  InterviewMetadata          `json:"metadata"`
}

// CompetencyScore represents scoring for specific competencies
type CompetencyScore struct {
	Score       float64   `json:"score"`
	Rating      string    `json:"rating"`
	Evidence    []string  `json:"evidence"`
	Improvement []string  `json:"improvement_suggestions"`
}

// DetailedAnalysis provides in-depth analysis
type DetailedAnalysis struct {
	ProblemApproach    AnalysisSection `json:"problem_approach"`
	TechnicalDepth     AnalysisSection `json:"technical_depth"`
	SolutionDesign     AnalysisSection `json:"solution_design"`
	Communication      AnalysisSection `json:"communication"`
	CriticalThinking   AnalysisSection `json:"critical_thinking"`
	CreativityInnovation AnalysisSection `json:"creativity_innovation"`
}

// AnalysisSection represents detailed analysis for each area
type AnalysisSection struct {
	Score       float64  `json:"score"`
	Observation string   `json:"observation"`
	Evidence    []string `json:"evidence"`
	Suggestions []string `json:"suggestions"`
}

// Recommendation represents actionable feedback
type Recommendation struct {
	Category    string `json:"category"`
	Priority    string `json:"priority"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Resources   []string `json:"resources,omitempty"`
}

// InterviewMetadata provides context about the interview
type InterviewMetadata struct {
	InterviewType     string    `json:"interview_type"`
	Duration          string    `json:"duration"`
	CompletionRate    float64   `json:"completion_rate"`
	InterventionCount int       `json:"intervention_count"`
	ComplexityLevel   string    `json:"complexity_level"`
	Timestamp         time.Time `json:"timestamp"`
}

// SynthesisMetrics represents performance metrics
type SynthesisMetrics struct {
	ProcessingLatencyMs int64   `json:"processing_latency_ms"`
	TokensUsed          int     `json:"tokens_used"`
	Cost                float64 `json:"cost"`
	ReportLength        int     `json:"report_length"`
	AnalysisDepth       string  `json:"analysis_depth"`
}

// SynthesisAgent handles report generation and interview analysis
type SynthesisAgent struct {
	firestoreClient *firestore.Client
	tracer          trace.Tracer
	cache           map[string]*SynthesisResponse
}

// NewSynthesisAgent creates a new synthesis agent
func NewSynthesisAgent() (*SynthesisAgent, error) {
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
	tracer := otel.Tracer("synthesis-agent")

	return &SynthesisAgent{
		firestoreClient: client,
		tracer:          tracer,
		cache:           make(map[string]*SynthesisResponse),
	}, nil
}

// GenerateReport generates comprehensive interview report
func (sa *SynthesisAgent) GenerateReport(ctx context.Context, req *SynthesisRequest) (*SynthesisResponse, error) {
	ctx, span := sa.tracer.Start(ctx, "synthesis.generate_report")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("user_id", req.UserID),
		attribute.String("report_type", string(req.ReportType)),
		attribute.String("interview_type", req.InterviewType),
		attribute.Int64("duration_minutes", req.Duration),
	)

	startTime := time.Now()

	// Check cache first
	cacheKey := sa.generateCacheKey(req)
	if cached, exists := sa.cache[cacheKey]; exists {
		log.Printf("Cache hit for report generation: %s", cacheKey)
		return cached, nil
	}

	// Calculate overall score
	overallScore := sa.calculateOverallScore(req.FinalScores)
	overallRating := sa.scoreToRating(overallScore)

	// Generate competency scores with detailed analysis
	competencyScores := sa.generateCompetencyScores(req.FinalScores, req.SessionData)

	// Generate summary
	summary := sa.generateSummary(req, overallScore, competencyScores)

	// Identify strengths and improvement areas
	strengths, improvements := sa.identifyStrengthsAndImprovements(competencyScores)

	// Generate detailed analysis
	detailedAnalysis := sa.generateDetailedAnalysis(req.FinalScores, req.SessionData)

	// Generate recommendations
	recommendations := sa.generateRecommendations(competencyScores, req.InterviewType)

	// Create metadata
	metadata := sa.createInterviewMetadata(req)

	// Create interview report
	report := InterviewReport{
		OverallScore:        overallScore,
		OverallRating:       overallRating,
		Summary:             summary,
		CompetencyScores:    competencyScores,
		KeyStrengths:        strengths,
		AreasForImprovement: improvements,
		DetailedAnalysis:    detailedAnalysis,
		Recommendations:     recommendations,
		InterviewMetadata:   metadata,
	}

	// Calculate processing metrics
	latency := time.Since(startTime)
	tokensUsed := sa.estimateTokenUsage(&report, req.ReportType)
	cost := sa.calculateCost(tokensUsed, string(req.ReportType))

	response := &SynthesisResponse{
		SessionID: req.SessionID,
		UserID:    req.UserID,
		Report:    report,
		Performance: SynthesisMetrics{
			ProcessingLatencyMs: latency.Milliseconds(),
			TokensUsed:          tokensUsed,
			Cost:                cost,
			ReportLength:        sa.calculateReportLength(&report),
			AnalysisDepth:       sa.determineAnalysisDepth(req.ReportType),
		},
		Timestamp: time.Now(),
	}

	// Cache the response
	sa.cache[cacheKey] = response

	// Store in Firestore
	if err := sa.storeReport(ctx, response); err != nil {
		log.Printf("Failed to store report: %v", err)
	}

	span.SetAttributes(
		attribute.Int64("latency_ms", latency.Milliseconds()),
		attribute.Int("tokens_used", tokensUsed),
		attribute.Float64("cost", cost),
		attribute.Float64("overall_score", overallScore),
	)

	return response, nil
}

// Private methods

func (sa *SynthesisAgent) calculateOverallScore(scores map[string]float64) float64 {
	if len(scores) == 0 {
		return 0.0
	}

	// Weight different competencies
	weights := map[string]float64{
		"Problem Definition & Structuring": 0.20,
		"Technical Depth":                  0.25,
		"Solution Design":                  0.20,
		"Communication":                    0.15,
		"Scalability Considerations":       0.10,
		"Trade-off Analysis":               0.10,
	}

	weightedSum := 0.0
	totalWeight := 0.0

	for competency, score := range scores {
		weight := weights[competency]
		if weight == 0 {
			weight = 0.1 // Default weight for unknown competencies
		}
		weightedSum += score * weight
		totalWeight += weight
	}

	if totalWeight == 0 {
		return 0.0
	}

	return weightedSum / totalWeight
}

func (sa *SynthesisAgent) scoreToRating(score float64) string {
	if score >= 4.5 {
		return "Excellent"
	} else if score >= 4.0 {
		return "Strong"
	} else if score >= 3.5 {
		return "Good"
	} else if score >= 3.0 {
		return "Satisfactory"
	} else if score >= 2.0 {
		return "Needs Improvement"
	} else {
		return "Poor"
	}
}

func (sa *SynthesisAgent) generateCompetencyScores(scores map[string]float64, sessionData map[string]any) map[string]CompetencyScore {
	competencyScores := make(map[string]CompetencyScore)

	for competency, score := range scores {
		rating := sa.scoreToRating(score)
		evidence := sa.generateEvidence(competency, score, sessionData)
		improvements := sa.generateImprovementSuggestions(competency, score)

		competencyScores[competency] = CompetencyScore{
			Score:       score,
			Rating:      rating,
			Evidence:    evidence,
			Improvement: improvements,
		}
	}

	return competencyScores
}

func (sa *SynthesisAgent) generateEvidence(competency string, score float64, sessionData map[string]any) []string {
	evidenceTemplates := map[string][]string{
		"Problem Definition & Structuring": {
			"Clearly articulated the problem statement",
			"Identified key stakeholders and constraints",
			"Broke down complex requirements systematically",
		},
		"Technical Depth": {
			"Demonstrated solid understanding of underlying technologies",
			"Discussed implementation details with accuracy",
			"Showed awareness of technical trade-offs",
		},
		"Solution Design": {
			"Proposed well-structured solution architecture",
			"Considered multiple solution approaches",
			"Designed modular and extensible system",
		},
		"Communication": {
			"Explained concepts clearly and logically",
			"Used appropriate technical vocabulary",
			"Structured responses in a coherent manner",
		},
		"Scalability Considerations": {
			"Addressed performance at scale",
			"Considered resource optimization",
			"Discussed horizontal scaling strategies",
		},
		"Trade-off Analysis": {
			"Identified key trade-offs in design decisions",
			"Analyzed pros and cons of different approaches",
			"Justified solution choices with clear reasoning",
		},
	}

	evidence := evidenceTemplates[competency]
	if evidence == nil {
		evidence = []string{"Demonstrated competency in this area"}
	}

	// Filter evidence based on score (higher scores get more evidence)
	evidenceCount := int(score) // Simplified: use score as evidence count
	if evidenceCount > len(evidence) {
		evidenceCount = len(evidence)
	}
	if evidenceCount < 1 {
		evidenceCount = 1
	}

	return evidence[:evidenceCount]
}

func (sa *SynthesisAgent) generateImprovementSuggestions(competency string, score float64) []string {
	if score >= 4.0 {
		return []string{"Continue demonstrating strong performance in this area"}
	}

	improvementTemplates := map[string][]string{
		"Problem Definition & Structuring": {
			"Practice breaking down complex problems into smaller components",
			"Work on identifying and validating assumptions early",
			"Develop frameworks for systematic problem analysis",
		},
		"Technical Depth": {
			"Deepen understanding of system architecture patterns",
			"Study implementation details of relevant technologies",
			"Practice explaining technical concepts at different levels",
		},
		"Solution Design": {
			"Practice designing systems with clear component boundaries",
			"Study design patterns and when to apply them",
			"Work on creating extensible and maintainable architectures",
		},
		"Communication": {
			"Practice structuring technical explanations logically",
			"Work on adapting communication style to audience",
			"Develop skills in visual communication and diagramming",
		},
		"Scalability Considerations": {
			"Study distributed systems patterns and principles",
			"Practice analyzing performance bottlenecks",
			"Learn about caching, load balancing, and optimization techniques",
		},
		"Trade-off Analysis": {
			"Practice identifying and articulating trade-offs in design decisions",
			"Develop frameworks for evaluating different solution approaches",
			"Study case studies of successful system design decisions",
		},
	}

	improvements := improvementTemplates[competency]
	if improvements == nil {
		improvements = []string{"Focus on developing this competency further"}
	}

	// Return 2-3 suggestions based on score
	suggestionCount := 3
	if score < 2.0 {
		suggestionCount = 3
	} else if score < 3.0 {
		suggestionCount = 2
	} else {
		suggestionCount = 1
	}

	if suggestionCount > len(improvements) {
		suggestionCount = len(improvements)
	}

	return improvements[:suggestionCount]
}

func (sa *SynthesisAgent) generateSummary(req *SynthesisRequest, overallScore float64, competencyScores map[string]CompetencyScore) string {
	rating := sa.scoreToRating(overallScore)
	
	var summary strings.Builder
	summary.WriteString(fmt.Sprintf("Overall performance: %s (%.1f/5.0). ", rating, overallScore))

	// Identify top competency
	var topCompetency string
	var topScore float64
	for competency, score := range competencyScores {
		if score.Score > topScore {
			topScore = score.Score
			topCompetency = competency
		}
	}

	if topCompetency != "" {
		summary.WriteString(fmt.Sprintf("Strongest area: %s (%.1f/5.0). ", topCompetency, topScore))
	}

	// Add interview type specific insights
	switch req.InterviewType {
	case "technical system design":
		summary.WriteString("Demonstrated system design thinking with focus on architecture and scalability. ")
	case "data structures & algorithms":
		summary.WriteString("Showed algorithmic problem-solving skills and technical implementation knowledge. ")
	case "product sense":
		summary.WriteString("Exhibited product thinking and user-centered design approach. ")
	case "behavioral":
		summary.WriteString("Demonstrated leadership and collaboration skills through experience examples. ")
	}

	// Add duration context
	if req.Duration < 30 {
		summary.WriteString("Interview was completed efficiently within a shorter timeframe. ")
	} else if req.Duration > 60 {
		summary.WriteString("Took time to thoroughly explore concepts and provide detailed responses. ")
	}

	return summary.String()
}

func (sa *SynthesisAgent) identifyStrengthsAndImprovements(competencyScores map[string]CompetencyScore) ([]string, []string) {
	type scoredCompetency struct {
		competency string
		score      float64
	}

	var competencies []scoredCompetency
	for comp, score := range competencyScores {
		competencies = append(competencies, scoredCompetency{comp, score.Score})
	}

	// Sort by score
	sort.Slice(competencies, func(i, j int) bool {
		return competencies[i].score > competencies[j].score
	})

	var strengths []string
	var improvements []string

	for i, comp := range competencies {
		if i < 3 && comp.score >= 3.5 {
			strengths = append(strengths, comp.competency)
		} else if comp.score < 3.0 {
			improvements = append(improvements, comp.competency)
		}
	}

	return strengths, improvements
}

func (sa *SynthesisAgent) generateDetailedAnalysis(scores map[string]float64, sessionData map[string]any) DetailedAnalysis {
	return DetailedAnalysis{
		ProblemApproach: sa.createAnalysisSection("Problem Definition & Structuring", scores, sessionData),
		TechnicalDepth:  sa.createAnalysisSection("Technical Depth", scores, sessionData),
		SolutionDesign:  sa.createAnalysisSection("Solution Design", scores, sessionData),
		Communication:   sa.createAnalysisSection("Communication", scores, sessionData),
		CriticalThinking: sa.createAnalysisSection("Trade-off Analysis", scores, sessionData),
		CreativityInnovation: sa.createAnalysisSection("Innovation", scores, sessionData),
	}
}

func (sa *SynthesisAgent) createAnalysisSection(competency string, scores map[string]float64, sessionData map[string]any) AnalysisSection {
	score := scores[competency]
	if score == 0 {
		score = 2.5 // Default score if not available
	}

	observations := map[string]string{
		"Problem Definition & Structuring": "Candidate approached the problem systematically, identifying key components and constraints.",
		"Technical Depth": "Demonstrated solid technical knowledge with appropriate level of detail for the role.",
		"Solution Design": "Proposed well-thought-out solution with clear architecture and component boundaries.",
		"Communication": "Communicated ideas clearly with good structure and appropriate technical vocabulary.",
		"Trade-off Analysis": "Showed awareness of design trade-offs and ability to justify decisions.",
		"Innovation": "Demonstrated creative thinking and consideration of alternative approaches.",
	}

	evidence := []string{
		"Systematic approach to problem breakdown",
		"Clear articulation of solution components",
		"Consideration of edge cases and constraints",
	}

	suggestions := []string{
		"Continue developing expertise in this area",
		"Practice applying concepts to larger scale problems",
		"Seek opportunities to mentor others in this competency",
	}

	return AnalysisSection{
		Score:       score,
		Observation: observations[competency],
		Evidence:    evidence,
		Suggestions: suggestions,
	}
}

func (sa *SynthesisAgent) generateRecommendations(competencyScores map[string]CompetencyScore, interviewType string) []Recommendation {
	var recommendations []Recommendation

	// General recommendations based on scores
	for competency, score := range competencyScores {
		if score.Score < 3.0 {
			recommendations = append(recommendations, Recommendation{
				Category:    "Skill Development",
				Priority:    "High",
				Title:       fmt.Sprintf("Improve %s", competency),
				Description: fmt.Sprintf("Focus on developing stronger capabilities in %s through targeted practice and study.", strings.ToLower(competency)),
				Resources:   []string{"Relevant books and courses", "Practice problems", "Mentorship opportunities"},
			})
		}
	}

	// Interview type specific recommendations
	switch interviewType {
	case "technical system design":
		recommendations = append(recommendations, Recommendation{
			Category:    "System Design",
			Priority:    "Medium",
			Title:       "System Design Practice",
			Description: "Continue practicing system design problems with focus on scalability and reliability.",
			Resources:   []string{"Designing Data-Intensive Applications", "System Design Interview books", "High Scalability blog"},
		})
	case "data structures & algorithms":
		recommendations = append(recommendations, Recommendation{
			Category:    "Technical Skills",
			Priority:    "Medium",
			Title:       "Algorithm Practice",
			Description: "Regular practice with algorithmic problems to maintain and improve problem-solving speed.",
			Resources:   []string{"LeetCode", "HackerRank", "Algorithm Design Manual"},
		})
	}

	// Add general recommendations
	recommendations = append(recommendations, Recommendation{
		Category:    "Communication",
		Priority:    "Low",
		Title:       "Technical Communication",
		Description: "Continue developing ability to explain complex technical concepts clearly.",
		Resources:   []string{"Technical writing courses", "Presentation skills workshops", "Public speaking practice"},
	})

	return recommendations
}

func (sa *SynthesisAgent) createInterviewMetadata(req *SynthesisRequest) InterviewMetadata {
	completionRate := 100.0 // Assume completion if we're generating a report

	interventionCount := len(req.Interventions)

	// Determine complexity based on scores
	avgScore := sa.calculateOverallScore(req.FinalScores)
	complexityLevel := "medium"
	if avgScore < 2.5 {
		complexityLevel = "low"
	} else if avgScore > 4.0 {
		complexityLevel = "high"
	}

	duration := fmt.Sprintf("%d minutes", req.Duration)

	return InterviewMetadata{
		InterviewType:     req.InterviewType,
		Duration:          duration,
		CompletionRate:    completionRate,
		InterventionCount: interventionCount,
		ComplexityLevel:   complexityLevel,
		Timestamp:         time.Now(),
	}
}

func (sa *SynthesisAgent) estimateTokenUsage(report *InterviewReport, reportType ReportType) int {
	baseTokens := 0

	// Count text content
	baseTokens += len(strings.Split(report.Summary, " "))
	
	for _, analysis := range []AnalysisSection{
		report.DetailedAnalysis.ProblemApproach,
		report.DetailedAnalysis.TechnicalDepth,
		report.DetailedAnalysis.SolutionDesign,
		report.DetailedAnalysis.Communication,
		report.DetailedAnalysis.CriticalThinking,
		report.DetailedAnalysis.CreativityInnovation,
	} {
		baseTokens += len(strings.Split(analysis.Observation, " "))
	}

	for _, rec := range report.Recommendations {
		baseTokens += len(strings.Split(rec.Description, " "))
	}

	// Apply multiplier based on report type
	multiplier := 1.0
	switch reportType {
	case ReportTypeDetailed:
		multiplier = 2.0
	case ReportTypeSummary:
		multiplier = 1.0
	case ReportTypeExecutive:
		multiplier = 0.5
	}

	return int(float64(baseTokens) * multiplier)
}

func (sa *SynthesisAgent) calculateCost(tokensUsed int, reportType string) float64 {
	// Gemini Pro pricing: approximately $0.00125 per 1K tokens
	baseRate := 0.00125

	// Report generation is more expensive due to complexity
	multiplier := 2.0

	return float64(tokensUsed) * baseRate * multiplier / 1000.0
}

func (sa *SynthesisAgent) calculateReportLength(report *InterviewReport) int {
	length := len(report.Summary)
	
	for _, section := range []AnalysisSection{
		report.DetailedAnalysis.ProblemApproach,
		report.DetailedAnalysis.TechnicalDepth,
		report.DetailedAnalysis.SolutionDesign,
		report.DetailedAnalysis.Communication,
		report.DetailedAnalysis.CriticalThinking,
		report.DetailedAnalysis.CreativityInnovation,
	} {
		length += len(section.Observation)
	}

	return length
}

func (sa *SynthesisAgent) determineAnalysisDepth(reportType ReportType) string {
	switch reportType {
	case ReportTypeDetailed:
		return "comprehensive"
	case ReportTypeSummary:
		return "standard"
	case ReportTypeExecutive:
		return "concise"
	default:
		return "standard"
	}
}

func (sa *SynthesisAgent) generateCacheKey(req *SynthesisRequest) string {
	hash := fmt.Sprintf("%s_%s_%s_%d", 
		req.SessionID, 
		req.UserID,
		string(req.ReportType),
		len(req.FinalScores))
	return hash
}

func (sa *SynthesisAgent) storeReport(ctx context.Context, response *SynthesisResponse) error {
	collection := sa.firestoreClient.Collection("interview_reports")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", response.SessionID, response.Timestamp.Unix()))

	_, err := docRef.Set(ctx, response)
	return err
}

// HTTP handlers
func (sa *SynthesisAgent) handleGenerateReport(c *gin.Context) {
	var req SynthesisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := sa.GenerateReport(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (sa *SynthesisAgent) handleHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"agent":     "synthesis",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

func (sa *SynthesisAgent) handleMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"cache_size":     len(sa.cache),
		"uptime_seconds": time.Now().Unix(),
		"reports":        "metrics_here",
	})
}

func main() {
	// Initialize synthesis agent
	synthesis, err := NewSynthesisAgent()
	if err != nil {
		log.Fatalf("Failed to initialize synthesis agent: %v", err)
	}

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Routes
	router.POST("/generate", synthesis.handleGenerateReport)
	router.GET("/health", synthesis.handleHealthCheck)
	router.GET("/metrics", synthesis.handleMetrics)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("Starting Synthesis Agent on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}