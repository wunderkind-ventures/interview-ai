package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/trace"
)

// DocumentType represents the type of document being parsed
type DocumentType string

const (
	DocumentTypeResume        DocumentType = "resume"
	DocumentTypeJobDescription DocumentType = "job_description"
	DocumentTypeCoverLetter   DocumentType = "cover_letter"
)

// ParseRequest represents the input for document parsing
type ParseRequest struct {
	SessionID    string            `json:"session_id"`
	DocumentURL  string            `json:"document_url,omitempty"`
	DocumentText string            `json:"document_text,omitempty"`
	DocumentType DocumentType      `json:"document_type"`
	Options      map[string]any    `json:"options,omitempty"`
	Context      map[string]any    `json:"context,omitempty"`
}

// ParseResponse represents the output of document parsing
type ParseResponse struct {
	SessionID    string               `json:"session_id"`
	Status       string               `json:"status"`
	Context      *StructuredContext   `json:"context,omitempty"`
	Fallback     *FallbackContext     `json:"fallback,omitempty"`
	Performance  ContextAgentMetrics  `json:"performance"`
	Timestamp    time.Time            `json:"timestamp"`
	Error        string               `json:"error,omitempty"`
}

// StructuredContext represents parsed document content
type StructuredContext struct {
	PersonalInfo    PersonalInfo      `json:"personal_info"`
	Experience      []WorkExperience  `json:"experience"`
	Education       []Education       `json:"education"`
	Skills          SkillsBreakdown   `json:"skills"`
	Projects        []Project         `json:"projects"`
	Achievements    []Achievement     `json:"achievements"`
	Certifications  []Certification   `json:"certifications"`
	Summary         string            `json:"summary"`
	KeyStrengths    []string          `json:"key_strengths"`
	CareerLevel     string            `json:"career_level"`
	Industries      []string          `json:"industries"`
}

// PersonalInfo represents personal information
type PersonalInfo struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Location string `json:"location"`
	LinkedIn string `json:"linkedin"`
	GitHub   string `json:"github"`
}

// WorkExperience represents work experience
type WorkExperience struct {
	Company     string    `json:"company"`
	Title       string    `json:"title"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	IsCurrent   bool      `json:"is_current"`
	Duration    string    `json:"duration"`
	Description string    `json:"description"`
	Achievements []string `json:"achievements"`
	Technologies []string `json:"technologies"`
	TeamSize    string    `json:"team_size,omitempty"`
}

// Education represents educational background
type Education struct {
	Institution string `json:"institution"`
	Degree      string `json:"degree"`
	Major       string `json:"major"`
	GPA         string `json:"gpa,omitempty"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	Honors      []string `json:"honors,omitempty"`
}

// SkillsBreakdown represents categorized skills
type SkillsBreakdown struct {
	Technical    []Skill `json:"technical"`
	Programming  []Skill `json:"programming"`
	Frameworks   []Skill `json:"frameworks"`
	Tools        []Skill `json:"tools"`
	Soft         []Skill `json:"soft"`
	Languages    []Skill `json:"languages"`
}

// Skill represents an individual skill with proficiency
type Skill struct {
	Name        string `json:"name"`
	Proficiency string `json:"proficiency"` // Beginner, Intermediate, Advanced, Expert
	YearsExp    int    `json:"years_exp,omitempty"`
	Category    string `json:"category"`
}

// Project represents a project
type Project struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Technologies []string `json:"technologies"`
	URL          string   `json:"url,omitempty"`
	StartDate    string   `json:"start_date"`
	EndDate      string   `json:"end_date"`
	Role         string   `json:"role"`
	TeamSize     string   `json:"team_size,omitempty"`
}

// Achievement represents an achievement or accomplishment
type Achievement struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Date        string `json:"date"`
	Context     string `json:"context"` // Work, Personal, Academic
	Impact      string `json:"impact,omitempty"`
}

// Certification represents a certification
type Certification struct {
	Name         string `json:"name"`
	Issuer       string `json:"issuer"`
	Date         string `json:"date"`
	ExpiryDate   string `json:"expiry_date,omitempty"`
	CredentialID string `json:"credential_id,omitempty"`
}

// FallbackContext represents fallback context when parsing fails
type FallbackContext struct {
	RawText      string            `json:"raw_text"`
	ExtractedInfo map[string]string `json:"extracted_info"`
	Confidence   float64           `json:"confidence"`
	Reason       string            `json:"reason"`
}

// ContextAgentMetrics represents performance metrics
type ContextAgentMetrics struct {
	ParsingLatencyMs    int64   `json:"parsing_latency_ms"`
	ExtractionLatencyMs int64   `json:"extraction_latency_ms"`
	TotalLatencyMs      int64   `json:"total_latency_ms"`
	DocumentSizeBytes   int     `json:"document_size_bytes"`
	FieldsExtracted     int     `json:"fields_extracted"`
	Confidence          float64 `json:"confidence"`
	FallbackUsed        bool    `json:"fallback_used"`
	CacheHit            bool    `json:"cache_hit"`
}

// ContextAgent handles document parsing and context extraction
type ContextAgent struct {
	firestoreClient *firestore.Client
	storageClient   *storage.Client
	tracer          trace.Tracer
	cache           map[string]*ParseResponse
}

// NewContextAgent creates a new context agent
func NewContextAgent() (*ContextAgent, error) {
	ctx := context.Background()

	// Initialize Firestore
	firestoreClient, err := firestore.NewClient(ctx, os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %v", err)
	}

	// Initialize Cloud Storage
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create storage client: %v", err)
	}

	// Initialize OpenTelemetry tracer
	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %v", err)
	}

	tp := trace.NewTracerProvider(trace.WithBatcher(exporter))
	otel.SetTracerProvider(tp)
	tracer := otel.Tracer("context-agent")

	return &ContextAgent{
		firestoreClient: firestoreClient,
		storageClient:   storageClient,
		tracer:          tracer,
		cache:           make(map[string]*ParseResponse),
	}, nil
}

// ParseDocument parses a document and extracts structured context
func (ca *ContextAgent) ParseDocument(ctx context.Context, req *ParseRequest) (*ParseResponse, error) {
	ctx, span := ca.tracer.Start(ctx, "context.parse_document")
	defer span.End()

	span.SetAttributes(
		attribute.String("session_id", req.SessionID),
		attribute.String("document_type", string(req.DocumentType)),
		attribute.Bool("has_url", req.DocumentURL != ""),
		attribute.Bool("has_text", req.DocumentText != ""),
	)

	startTime := time.Now()

	// Check cache first
	cacheKey := ca.generateCacheKey(req)
	if cached, exists := ca.cache[cacheKey]; exists {
		log.Printf("Cache hit for parsing request: %s", cacheKey)
		cached.Performance.CacheHit = true
		return cached, nil
	}

	// Get document text
	documentText, documentSize, err := ca.getDocumentText(ctx, req)
	if err != nil {
		span.RecordError(err)
		return ca.createFallbackResponse(req, err.Error(), startTime), nil
	}

	span.SetAttributes(attribute.Int("document_size", documentSize))

	// Parse document based on type
	var structuredContext *StructuredContext
	var confidence float64
	var fieldsExtracted int

	switch req.DocumentType {
	case DocumentTypeResume:
		structuredContext, confidence, fieldsExtracted, err = ca.parseResume(ctx, documentText)
	case DocumentTypeJobDescription:
		structuredContext, confidence, fieldsExtracted, err = ca.parseJobDescription(ctx, documentText)
	default:
		err = fmt.Errorf("unsupported document type: %s", req.DocumentType)
	}

	totalLatency := time.Since(startTime)

	if err != nil || confidence < 0.5 {
		span.RecordError(err)
		return ca.createFallbackResponse(req, fmt.Sprintf("parsing failed: %v", err), startTime), nil
	}

	response := &ParseResponse{
		SessionID: req.SessionID,
		Status:    "success",
		Context:   structuredContext,
		Performance: ContextAgentMetrics{
			TotalLatencyMs:    totalLatency.Milliseconds(),
			DocumentSizeBytes: documentSize,
			FieldsExtracted:   fieldsExtracted,
			Confidence:        confidence,
			FallbackUsed:      false,
			CacheHit:          false,
		},
		Timestamp: time.Now(),
	}

	// Cache the response
	ca.cache[cacheKey] = response

	// Store in Firestore
	if err := ca.storeContext(ctx, response); err != nil {
		log.Printf("Failed to store context: %v", err)
	}

	span.SetAttributes(
		attribute.Int64("latency_ms", totalLatency.Milliseconds()),
		attribute.Float64("confidence", confidence),
		attribute.Int("fields_extracted", fieldsExtracted),
	)

	return response, nil
}

// getDocumentText retrieves document text from URL or uses provided text
func (ca *ContextAgent) getDocumentText(ctx context.Context, req *ParseRequest) (string, int, error) {
	if req.DocumentText != "" {
		return req.DocumentText, len(req.DocumentText), nil
	}

	if req.DocumentURL != "" {
		// In a real implementation, this would download and process the document
		// For now, we'll simulate document retrieval
		return ca.simulateDocumentRetrieval(req.DocumentURL)
	}

	return "", 0, fmt.Errorf("no document text or URL provided")
}

// simulateDocumentRetrieval simulates retrieving a document from a URL
func (ca *ContextAgent) simulateDocumentRetrieval(url string) (string, int, error) {
	// Simulate different document types based on URL
	if strings.Contains(url, "resume") {
		sampleResume := `
		John Doe
		Software Engineer
		john.doe@email.com | (555) 123-4567 | San Francisco, CA
		LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

		PROFESSIONAL SUMMARY
		Experienced software engineer with 5+ years developing scalable web applications and distributed systems.
		Expertise in Go, Python, and cloud technologies. Led teams of 3-5 engineers on multiple successful projects.

		EXPERIENCE
		Senior Software Engineer | TechCorp Inc. | Jan 2022 - Present
		• Led development of microservices architecture serving 1M+ daily users
		• Designed and implemented distributed caching system reducing latency by 40%
		• Mentored 3 junior developers and established code review best practices
		• Technologies: Go, Kubernetes, PostgreSQL, Redis, AWS

		Software Engineer | StartupXYZ | Jun 2020 - Dec 2021
		• Built RESTful APIs processing 10K+ requests per minute
		• Implemented CI/CD pipeline reducing deployment time from hours to minutes
		• Collaborated with product team to deliver features for 100K+ users
		• Technologies: Python, Django, Docker, MySQL, GCP

		Junior Software Engineer | DevCompany | Aug 2019 - May 2020
		• Developed web applications using React and Node.js
		• Participated in agile development process and daily standups
		• Fixed bugs and implemented small features
		• Technologies: JavaScript, React, Node.js, MongoDB

		EDUCATION
		Bachelor of Science in Computer Science | University of Technology | 2015-2019
		GPA: 3.7/4.0 | Dean's List: Fall 2018, Spring 2019

		SKILLS
		Programming Languages: Go, Python, JavaScript, SQL
		Frameworks: React, Django, Flask, Express.js
		Technologies: Kubernetes, Docker, AWS, GCP, PostgreSQL, Redis
		Tools: Git, Jenkins, Terraform, Grafana
		`
		return sampleResume, len(sampleResume), nil
	}

	return "", 0, fmt.Errorf("unsupported URL: %s", url)
}

// parseResume parses a resume document
func (ca *ContextAgent) parseResume(ctx context.Context, text string) (*StructuredContext, float64, int, error) {
	ctx, span := ca.tracer.Start(ctx, "context.parse_resume")
	defer span.End()

	context := &StructuredContext{}
	fieldsExtracted := 0
	confidence := 0.0

	// Extract personal information
	personalInfo, personalFields := ca.extractPersonalInfo(text)
	context.PersonalInfo = personalInfo
	fieldsExtracted += personalFields

	// Extract work experience
	experience, expFields := ca.extractWorkExperience(text)
	context.Experience = experience
	fieldsExtracted += expFields

	// Extract education
	education, eduFields := ca.extractEducation(text)
	context.Education = education
	fieldsExtracted += eduFields

	// Extract skills
	skills, skillFields := ca.extractSkills(text)
	context.Skills = skills
	fieldsExtracted += skillFields

	// Extract projects
	projects, projFields := ca.extractProjects(text)
	context.Projects = projects
	fieldsExtracted += projFields

	// Generate summary and career level
	context.Summary = ca.generateSummary(text, context)
	context.CareerLevel = ca.determineCareerLevel(context)
	context.KeyStrengths = ca.extractKeyStrengths(context)
	context.Industries = ca.extractIndustries(text)

	fieldsExtracted += 4 // summary, career level, key strengths, industries

	// Calculate confidence based on extracted fields
	maxPossibleFields := 50 // Approximate maximum fields we expect to extract
	confidence = float64(fieldsExtracted) / float64(maxPossibleFields)
	if confidence > 1.0 {
		confidence = 1.0
	}

	span.SetAttributes(
		attribute.Int("fields_extracted", fieldsExtracted),
		attribute.Float64("confidence", confidence),
	)

	return context, confidence, fieldsExtracted, nil
}

// parseJobDescription parses a job description document
func (ca *ContextAgent) parseJobDescription(ctx context.Context, text string) (*StructuredContext, float64, int, error) {
	// Simplified job description parsing
	// In a real implementation, this would extract requirements, responsibilities, etc.
	return &StructuredContext{
		Summary: "Job description parsing not fully implemented",
	}, 0.5, 1, nil
}

// extractPersonalInfo extracts personal information from text
func (ca *ContextAgent) extractPersonalInfo(text string) (PersonalInfo, int) {
	info := PersonalInfo{}
	fieldsFound := 0

	// Extract email
	emailRegex := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	if email := emailRegex.FindString(text); email != "" {
		info.Email = email
		fieldsFound++
	}

	// Extract phone
	phoneRegex := regexp.MustCompile(`\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`)
	if phone := phoneRegex.FindString(text); phone != "" {
		info.Phone = phone
		fieldsFound++
	}

	// Extract LinkedIn
	linkedinRegex := regexp.MustCompile(`linkedin\.com/in/[a-zA-Z0-9-]+`)
	if linkedin := linkedinRegex.FindString(text); linkedin != "" {
		info.LinkedIn = linkedin
		fieldsFound++
	}

	// Extract GitHub
	githubRegex := regexp.MustCompile(`github\.com/[a-zA-Z0-9-]+`)
	if github := githubRegex.FindString(text); github != "" {
		info.GitHub = github
		fieldsFound++
	}

	// Extract name (simplified - look for lines with proper case)
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) > 5 && len(line) < 50 && ca.looksLikeName(line) {
			info.Name = line
			fieldsFound++
			break
		}
	}

	// Extract location (look for city, state patterns)
	locationRegex := regexp.MustCompile(`[A-Z][a-z]+,\s+[A-Z]{2}`)
	if location := locationRegex.FindString(text); location != "" {
		info.Location = location
		fieldsFound++
	}

	return info, fieldsFound
}

// extractWorkExperience extracts work experience from text
func (ca *ContextAgent) extractWorkExperience(text string) ([]WorkExperience, int) {
	var experiences []WorkExperience
	fieldsFound := 0

	// Simplified extraction - look for common patterns
	lines := strings.Split(text, "\n")
	
	var currentExp *WorkExperience
	inExperienceSection := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Check if we're entering experience section
		if strings.Contains(strings.ToUpper(line), "EXPERIENCE") || 
		   strings.Contains(strings.ToUpper(line), "EMPLOYMENT") {
			inExperienceSection = true
			continue
		}

		// Check if we're leaving experience section
		if inExperienceSection && (strings.Contains(strings.ToUpper(line), "EDUCATION") ||
			strings.Contains(strings.ToUpper(line), "SKILLS")) {
			inExperienceSection = false
			continue
		}

		if inExperienceSection {
			// Look for job title | company | dates pattern
			if strings.Contains(line, "|") && !strings.HasPrefix(line, "•") {
				if currentExp != nil {
					experiences = append(experiences, *currentExp)
				}
				
				parts := strings.Split(line, "|")
				if len(parts) >= 2 {
					currentExp = &WorkExperience{
						Title:        strings.TrimSpace(parts[0]),
						Company:      strings.TrimSpace(parts[1]),
						Achievements: []string{},
						Technologies: []string{},
					}
					if len(parts) >= 3 {
						dateRange := strings.TrimSpace(parts[2])
						if strings.Contains(dateRange, " - ") {
							dateParts := strings.Split(dateRange, " - ")
							currentExp.StartDate = strings.TrimSpace(dateParts[0])
							currentExp.EndDate = strings.TrimSpace(dateParts[1])
							currentExp.IsCurrent = strings.Contains(strings.ToLower(currentExp.EndDate), "present")
						}
					}
					fieldsFound += 3
				}
			} else if currentExp != nil && strings.HasPrefix(line, "•") {
				// Add achievement
				achievement := strings.TrimPrefix(line, "•")
				achievement = strings.TrimSpace(achievement)
				currentExp.Achievements = append(currentExp.Achievements, achievement)
				fieldsFound++

				// Extract technologies from achievements
				if strings.Contains(strings.ToLower(line), "technologies:") {
					techPart := line[strings.Index(strings.ToLower(line), "technologies:")+13:]
					techs := strings.Split(techPart, ",")
					for _, tech := range techs {
						tech = strings.TrimSpace(tech)
						if tech != "" {
							currentExp.Technologies = append(currentExp.Technologies, tech)
							fieldsFound++
						}
					}
				}
			}
		}
	}

	// Add the last experience if exists
	if currentExp != nil {
		experiences = append(experiences, *currentExp)
	}

	return experiences, fieldsFound
}

// extractEducation extracts education information from text
func (ca *ContextAgent) extractEducation(text string) ([]Education, int) {
	var educations []Education
	fieldsFound := 0

	// Look for education section
	lines := strings.Split(text, "\n")
	inEducationSection := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.Contains(strings.ToUpper(line), "EDUCATION") {
			inEducationSection = true
			continue
		}

		if inEducationSection && (strings.Contains(strings.ToUpper(line), "SKILLS") ||
			strings.Contains(strings.ToUpper(line), "EXPERIENCE")) {
			break
		}

		if inEducationSection && line != "" {
			// Look for degree | institution | dates pattern
			if strings.Contains(line, "|") {
				parts := strings.Split(line, "|")
				if len(parts) >= 2 {
					education := Education{
						Degree:      strings.TrimSpace(parts[0]),
						Institution: strings.TrimSpace(parts[1]),
					}
					if len(parts) >= 3 {
						dateRange := strings.TrimSpace(parts[2])
						if strings.Contains(dateRange, "-") {
							dateParts := strings.Split(dateRange, "-")
							education.StartDate = strings.TrimSpace(dateParts[0])
							education.EndDate = strings.TrimSpace(dateParts[1])
						}
					}
					educations = append(educations, education)
					fieldsFound += 2
				}
			} else if strings.Contains(strings.ToUpper(line), "GPA") {
				// Extract GPA if present
				gpaRegex := regexp.MustCompile(`\d\.\d/\d\.\d`)
				if gpa := gpaRegex.FindString(line); gpa != "" && len(educations) > 0 {
					educations[len(educations)-1].GPA = gpa
					fieldsFound++
				}
			}
		}
	}

	return educations, fieldsFound
}

// extractSkills extracts skills from text
func (ca *ContextAgent) extractSkills(text string) (SkillsBreakdown, int) {
	skills := SkillsBreakdown{
		Technical:   []Skill{},
		Programming: []Skill{},
		Frameworks:  []Skill{},
		Tools:       []Skill{},
		Soft:        []Skill{},
		Languages:   []Skill{},
	}
	fieldsFound := 0

	// Define skill categories
	programmingLangs := []string{"go", "golang", "python", "javascript", "java", "c++", "c#", "sql", "typescript", "rust", "scala"}
	frameworks := []string{"react", "angular", "vue", "django", "flask", "express", "spring", "gin", "echo"}
	tools := []string{"docker", "kubernetes", "git", "jenkins", "terraform", "ansible", "grafana", "prometheus"}
	databases := []string{"postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra"}

	// Extract from skills section
	lines := strings.Split(text, "\n")
	inSkillsSection := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.Contains(strings.ToUpper(line), "SKILLS") {
			inSkillsSection = true
			continue
		}

		if inSkillsSection && (strings.Contains(strings.ToUpper(line), "PROJECTS") ||
			strings.Contains(strings.ToUpper(line), "CERTIFICATIONS")) {
			break
		}

		if inSkillsSection {
			lineLower := strings.ToLower(line)
			
			// Extract programming languages
			for _, lang := range programmingLangs {
				if strings.Contains(lineLower, lang) {
					skills.Programming = append(skills.Programming, Skill{
						Name:        lang,
						Proficiency: "Intermediate", // Default proficiency
						Category:    "Programming",
					})
					fieldsFound++
				}
			}

			// Extract frameworks
			for _, framework := range frameworks {
				if strings.Contains(lineLower, framework) {
					skills.Frameworks = append(skills.Frameworks, Skill{
						Name:        framework,
						Proficiency: "Intermediate",
						Category:    "Framework",
					})
					fieldsFound++
				}
			}

			// Extract tools
			for _, tool := range tools {
				if strings.Contains(lineLower, tool) {
					skills.Tools = append(skills.Tools, Skill{
						Name:        tool,
						Proficiency: "Intermediate",
						Category:    "Tool",
					})
					fieldsFound++
				}
			}

			// Extract databases as technical skills
			for _, db := range databases {
				if strings.Contains(lineLower, db) {
					skills.Technical = append(skills.Technical, Skill{
						Name:        db,
						Proficiency: "Intermediate",
						Category:    "Database",
					})
					fieldsFound++
				}
			}
		}
	}

	return skills, fieldsFound
}

// extractProjects extracts project information from text
func (ca *ContextAgent) extractProjects(text string) ([]Project, int) {
	// Simplified project extraction
	return []Project{}, 0
}

// Helper functions

func (ca *ContextAgent) looksLikeName(text string) bool {
	// Simple heuristic: should be title case, 2-4 words, no numbers
	words := strings.Fields(text)
	if len(words) < 2 || len(words) > 4 {
		return false
	}

	for _, word := range words {
		if !regexp.MustCompile(`^[A-Z][a-z]+$`).MatchString(word) {
			return false
		}
	}

	return true
}

func (ca *ContextAgent) generateSummary(text string, context *StructuredContext) string {
	// Generate a summary based on extracted information
	summary := "Experienced professional"
	
	if len(context.Experience) > 0 {
		mostRecentJob := context.Experience[0]
		summary = fmt.Sprintf("%s with experience as %s at %s", summary, mostRecentJob.Title, mostRecentJob.Company)
	}

	if len(context.Skills.Programming) > 0 {
		summary = fmt.Sprintf("%s. Skilled in %s", summary, context.Skills.Programming[0].Name)
		if len(context.Skills.Programming) > 1 {
			summary = fmt.Sprintf("%s and %s", summary, context.Skills.Programming[1].Name)
		}
	}

	return summary + "."
}

func (ca *ContextAgent) determineCareerLevel(context *StructuredContext) string {
	if len(context.Experience) == 0 {
		return "Entry Level"
	}

	// Calculate total years of experience
	totalYears := len(context.Experience) * 2 // Rough approximation

	if totalYears <= 2 {
		return "Entry Level"
	} else if totalYears <= 5 {
		return "Mid Level"
	} else if totalYears <= 10 {
		return "Senior Level"
	} else {
		return "Executive Level"
	}
}

func (ca *ContextAgent) extractKeyStrengths(context *StructuredContext) []string {
	strengths := []string{}

	// Extract from skills
	if len(context.Skills.Programming) > 0 {
		strengths = append(strengths, "Software Development")
	}
	if len(context.Skills.Technical) > 0 {
		strengths = append(strengths, "Technical Expertise")
	}

	// Extract from experience
	for _, exp := range context.Experience {
		if strings.Contains(strings.ToLower(exp.Title), "senior") || 
		   strings.Contains(strings.ToLower(exp.Title), "lead") {
			strengths = append(strengths, "Leadership")
			break
		}
	}

	return strengths
}

func (ca *ContextAgent) extractIndustries(text string) []string {
	industries := []string{}
	textLower := strings.ToLower(text)

	industryKeywords := map[string]string{
		"fintech":    "Financial Technology",
		"healthcare": "Healthcare",
		"ecommerce":  "E-commerce",
		"gaming":     "Gaming",
		"startup":    "Startup",
		"enterprise": "Enterprise",
	}

	for keyword, industry := range industryKeywords {
		if strings.Contains(textLower, keyword) {
			industries = append(industries, industry)
		}
	}

	return industries
}

func (ca *ContextAgent) createFallbackResponse(req *ParseRequest, reason string, startTime time.Time) *ParseResponse {
	fallback := &FallbackContext{
		RawText:      req.DocumentText,
		ExtractedInfo: map[string]string{
			"document_type": string(req.DocumentType),
			"session_id":    req.SessionID,
		},
		Confidence: 0.1,
		Reason:     reason,
	}

	return &ParseResponse{
		SessionID: req.SessionID,
		Status:    "fallback",
		Fallback:  fallback,
		Performance: ContextAgentMetrics{
			TotalLatencyMs:    time.Since(startTime).Milliseconds(),
			DocumentSizeBytes: len(req.DocumentText),
			FieldsExtracted:   0,
			Confidence:        0.1,
			FallbackUsed:      true,
			CacheHit:          false,
		},
		Timestamp: time.Now(),
		Error:     reason,
	}
}

func (ca *ContextAgent) generateCacheKey(req *ParseRequest) string {
	// Generate cache key based on document content and type
	textHash := fmt.Sprintf("%x", len(req.DocumentText)) // Simplified hash
	return fmt.Sprintf("%s_%s_%s", req.SessionID, string(req.DocumentType), textHash)
}

func (ca *ContextAgent) storeContext(ctx context.Context, response *ParseResponse) error {
	collection := ca.firestoreClient.Collection("contexts")
	docRef := collection.Doc(fmt.Sprintf("%s_%d", response.SessionID, response.Timestamp.Unix()))
	
	_, err := docRef.Set(ctx, response)
	return err
}

// HTTP handlers
func (ca *ContextAgent) handleParseDocument(c *gin.Context) {
	var req ParseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := ca.ParseDocument(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (ca *ContextAgent) handleHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"agent":     "context",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

func (ca *ContextAgent) handleMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"cache_size":     len(ca.cache),
		"uptime_seconds": time.Now().Unix(),
		"documents":      "metrics_here",
	})
}

func main() {
	// Initialize context agent
	contextAgent, err := NewContextAgent()
	if err != nil {
		log.Fatalf("Failed to initialize context agent: %v", err)
	}

	// Setup Gin router
	router := gin.Default()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Routes
	router.POST("/parse", contextAgent.handleParseDocument)
	router.GET("/health", contextAgent.handleHealthCheck)
	router.GET("/metrics", contextAgent.handleMetrics)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Starting Context Agent on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}