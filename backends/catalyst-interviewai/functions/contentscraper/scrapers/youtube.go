package scrapers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"interviewai.wkv.local/contentscraper/models"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

// YouTubeScraper handles scraping content from YouTube videos
type YouTubeScraper struct {
	apiKey string
	service *youtube.Service
}

// NewYouTubeScraper creates a new YouTube scraper with API key
func NewYouTubeScraper(apiKey string) (*YouTubeScraper, error) {
	ctx := context.Background()
	service, err := youtube.NewService(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create YouTube service: %w", err)
	}
	
	return &YouTubeScraper{
		apiKey: apiKey,
		service: service,
	}, nil
}

// ScrapeVideo extracts content from a YouTube video URL
func (ys *YouTubeScraper) ScrapeVideo(videoURL string) (*models.ScrapedContent, error) {
	videoID, err := extractVideoID(videoURL)
	if err != nil {
		return nil, fmt.Errorf("invalid YouTube URL: %w", err)
	}

	// Get video metadata
	videoData, err := ys.getVideoMetadata(videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video metadata: %w", err)
	}

	// Get video captions/transcript
	transcript, err := ys.getVideoTranscript(videoID)
	if err != nil {
		log.Printf("Warning: Failed to get transcript for video %s: %v", videoID, err)
		transcript = ""
	}

	// Process content to extract structured data
	content := ys.processContent(transcript, videoData)

	scrapedContent := &models.ScrapedContent{
		Source: models.ContentSource{
			Type:          "youtube",
			URL:           videoURL,
			Title:         videoData.Title,
			Author:        videoData.ChannelTitle,
			DatePublished: videoData.PublishedAt,
			Duration:      videoData.Duration,
			ViewCount:     videoData.ViewCount,
			Description:   videoData.Description,
		},
		Content: content,
	}

	// Classify content type and interview type
	ys.classifyContent(scrapedContent)

	return scrapedContent, nil
}

// VideoMetadata contains basic video information
type VideoMetadata struct {
	Title        string
	Description  string
	ChannelTitle string
	PublishedAt  string
	Duration     string
	ViewCount    int64
	Tags         []string
}

// getVideoMetadata retrieves video metadata using YouTube Data API
func (ys *YouTubeScraper) getVideoMetadata(videoID string) (*VideoMetadata, error) {
	log.Printf("Getting metadata for video ID: %s", videoID)
	
	// Call YouTube Data API v3 to get video details
	call := ys.service.Videos.List([]string{"snippet", "statistics", "contentDetails"}).Id(videoID)
	response, err := call.Do()
	if err != nil {
		return nil, fmt.Errorf("failed to get video details: %w", err)
	}
	
	if len(response.Items) == 0 {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}
	
	video := response.Items[0]
	snippet := video.Snippet
	statistics := video.Statistics
	contentDetails := video.ContentDetails
	
	// Parse view count
	viewCount, _ := strconv.ParseInt(fmt.Sprintf("%d", statistics.ViewCount), 10, 64)
	
	// Extract tags
	tags := []string{}
	if snippet.Tags != nil {
		tags = snippet.Tags
	}
	
	return &VideoMetadata{
		Title:        snippet.Title,
		Description:  snippet.Description,
		ChannelTitle: snippet.ChannelTitle,
		PublishedAt:  snippet.PublishedAt,
		Duration:     contentDetails.Duration,
		ViewCount:    viewCount,
		Tags:         tags,
	}, nil
}

// getVideoTranscript retrieves video captions/transcript
func (ys *YouTubeScraper) getVideoTranscript(videoID string) (string, error) {
	log.Printf("Getting transcript for video ID: %s", videoID)
	
	// First, try to get captions using YouTube Data API
	transcript, err := ys.getCaptionsFromAPI(videoID)
	if err != nil {
		log.Printf("Failed to get captions from API: %v", err)
		// Fallback to scraping transcript from YouTube page
		transcript, err = ys.scrapeTranscriptFromPage(videoID)
		if err != nil {
			log.Printf("Failed to scrape transcript: %v", err)
			return "", fmt.Errorf("no transcript available for video %s", videoID)
		}
	}
	
	return transcript, nil
}

// processContent extracts structured data from the transcript
func (ys *YouTubeScraper) processContent(transcript string, metadata *VideoMetadata) models.ContentData {
	// TODO: Implement NLP processing to extract questions, concepts, and tips
	// This is a placeholder implementation
	
	content := models.ContentData{
		FullTranscript: transcript,
		Tags:           metadata.Tags,
		Summary:        generateSummary(transcript),
	}

	// Extract interview questions
	content.Questions = extractQuestions(transcript)
	
	// Extract technical concepts
	content.Concepts = extractConcepts(transcript)
	
	// Extract tips and advice
	content.Tips = extractTips(transcript)

	return content
}

// classifyContent determines the content type and interview type
func (ys *YouTubeScraper) classifyContent(content *models.ScrapedContent) {
	title := strings.ToLower(content.Source.Title)
	description := strings.ToLower(content.Source.Description)
	text := title + " " + description

	// Classify content type
	if strings.Contains(text, "interview") || strings.Contains(text, "question") {
		content.ContentType = "interview_experience"
	} else if strings.Contains(text, "tutorial") || strings.Contains(text, "how to") {
		content.ContentType = "tutorial"
	} else if strings.Contains(text, "tips") || strings.Contains(text, "advice") {
		content.ContentType = "tips"
	} else if strings.Contains(text, "system design") || strings.Contains(text, "architecture") {
		content.ContentType = "system_design"
	} else {
		content.ContentType = "general"
	}

	// Classify interview type
	if strings.Contains(text, "system design") {
		content.InterviewType = "technical_system_design"
	} else if strings.Contains(text, "behavioral") {
		content.InterviewType = "behavioral"
	} else if strings.Contains(text, "coding") || strings.Contains(text, "algorithm") {
		content.InterviewType = "coding"
	} else if strings.Contains(text, "product") {
		content.InterviewType = "product_sense"
	} else {
		content.InterviewType = "general"
	}

	// Extract target level (L3, L4, L5, etc.)
	content.TargetLevel = extractTargetLevel(text)

	// Extract target company
	content.TargetCompany = extractTargetCompany(text)
}

// Helper functions (placeholder implementations)

func extractVideoID(videoURL string) (string, error) {
	u, err := url.Parse(videoURL)
	if err != nil {
		return "", err
	}

	// Handle different YouTube URL formats
	if u.Host == "youtu.be" {
		return strings.TrimPrefix(u.Path, "/"), nil
	}

	if u.Host == "www.youtube.com" || u.Host == "youtube.com" {
		return u.Query().Get("v"), nil
	}

	return "", fmt.Errorf("unsupported YouTube URL format")
}

func generateSummary(transcript string) string {
	// TODO: Implement AI-based summarization
	if len(transcript) > 200 {
		return transcript[:200] + "..."
	}
	return transcript
}

func extractQuestions(transcript string) []models.Question {
	// TODO: Implement NLP-based question extraction
	return []models.Question{
		{
			QuestionText: "Design a chat system like WhatsApp",
			Context:      "System design interview question",
			KeyPoints:    []string{"scalability", "real-time messaging", "database design"},
			Difficulty:   "medium",
			Category:     "system_design",
		},
	}
}

func extractConcepts(transcript string) []models.Concept {
	// TODO: Implement concept extraction
	return []models.Concept{
		{
			Term:        "Load Balancer",
			Explanation: "Distributes incoming requests across multiple servers",
			Examples:    []string{"NGINX", "AWS ELB"},
			Importance:  "high",
		},
	}
}

func extractTips(transcript string) []models.Tip {
	// TODO: Implement tip extraction
	return []models.Tip{
		{
			Category:  "system_design",
			Tip:       "Always clarify requirements before starting the design",
			Reasoning: "Helps ensure you're solving the right problem",
		},
	}
}

func extractTargetLevel(text string) string {
	levels := []string{"L3", "L4", "L5", "L6", "L7"}
	for _, level := range levels {
		if strings.Contains(text, strings.ToLower(level)) {
			return level
		}
	}
	return "L4" // Default level
}

func extractTargetCompany(text string) string {
	companies := []string{"Google", "Amazon", "Microsoft", "Apple", "Meta", "Netflix"}
	for _, company := range companies {
		if strings.Contains(text, strings.ToLower(company)) {
			return company
		}
	}
	return ""
}

// getCaptionsFromAPI attempts to get captions using YouTube Data API
func (ys *YouTubeScraper) getCaptionsFromAPI(videoID string) (string, error) {
	// Get list of available captions
	call := ys.service.Captions.List([]string{"snippet"}, videoID)
	response, err := call.Do()
	if err != nil {
		return "", fmt.Errorf("failed to list captions: %w", err)
	}
	
	if len(response.Items) == 0 {
		return "", fmt.Errorf("no captions available")
	}
	
	// Find English captions (auto-generated or manual)
	var captionID string
	for _, caption := range response.Items {
		if caption.Snippet.Language == "en" {
			captionID = caption.Id
			break
		}
	}
	
	if captionID == "" {
		// Use the first available caption if no English found
		captionID = response.Items[0].Id
	}
	
	// Download the caption file
	// Note: This requires OAuth 2.0 authentication, not just API key
	// For now, we'll return an error and use the scraping fallback
	return "", fmt.Errorf("caption download requires OAuth authentication")
}

// scrapeTranscriptFromPage scrapes transcript from YouTube page
func (ys *YouTubeScraper) scrapeTranscriptFromPage(videoID string) (string, error) {
	// This method scrapes the transcript from the YouTube page
	// Note: This is more fragile as it depends on YouTube's page structure
	
	url := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
	client := &http.Client{Timeout: 30 * time.Second}
	
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch YouTube page: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}
	
	// Read the page content
	body := make([]byte, 0)
	buf := make([]byte, 1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
		}
		if err != nil {
			break
		}
	}
	
	pageContent := string(body)
	
	// Look for transcript data in the page
	// YouTube embeds transcript data in JSON within script tags
	transcript := extractTranscriptFromHTML(pageContent)
	if transcript == "" {
		return "", fmt.Errorf("no transcript found in page")
	}
	
	return transcript, nil
}

// extractTranscriptFromHTML extracts transcript from YouTube page HTML
func extractTranscriptFromHTML(html string) string {
	// Look for transcript data patterns in YouTube's HTML
	// This is a simplified implementation - YouTube's actual structure is complex
	
	// Pattern 1: Look for captions in ytInitialPlayerResponse
	pattern1 := regexp.MustCompile(`"captions":\{[^}]+"playerCaptionsTracklistRenderer":\{[^}]+"captionTracks":\[([^\]]+)\]`)
	matches1 := pattern1.FindStringSubmatch(html)
	if len(matches1) > 1 {
		// Extract caption URL and fetch it
		urlPattern := regexp.MustCompile(`"baseUrl":"([^"]+)"`)
		urlMatches := urlPattern.FindStringSubmatch(matches1[1])
		if len(urlMatches) > 1 {
			captionURL := strings.ReplaceAll(urlMatches[1], "\\u0026", "&")
			return fetchCaptionContent(captionURL)
		}
	}
	
	// Pattern 2: Look for transcript in page data (fallback)
	pattern2 := regexp.MustCompile(`"transcriptRenderer":\{[^}]+"content":\{[^}]+"runs":\[([^\]]+)\]`)
	matches2 := pattern2.FindStringSubmatch(html)
	if len(matches2) > 1 {
		// Extract text from runs
		textPattern := regexp.MustCompile(`"text":"([^"]+)"`)
		textMatches := textPattern.FindAllStringSubmatch(matches2[1], -1)
		var transcript strings.Builder
		for _, match := range textMatches {
			if len(match) > 1 {
				transcript.WriteString(match[1])
				transcript.WriteString(" ")
			}
		}
		return strings.TrimSpace(transcript.String())
	}
	
	return ""
}

// fetchCaptionContent fetches and parses caption content from URL
func fetchCaptionContent(captionURL string) string {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(captionURL)
	if err != nil {
		log.Printf("Failed to fetch caption content: %v", err)
		return ""
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		log.Printf("Caption fetch HTTP error: %d", resp.StatusCode)
		return ""
	}
	
	// Read caption content
	body := make([]byte, 0)
	buf := make([]byte, 1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
		}
		if err != nil {
			break
		}
	}
	
	captionXML := string(body)
	
	// Parse XML captions and extract text
	// YouTube captions are in XML format with <text> tags
	textPattern := regexp.MustCompile(`<text[^>]*>([^<]+)</text>`)
	matches := textPattern.FindAllStringSubmatch(captionXML, -1)
	
	var transcript strings.Builder
	for _, match := range matches {
		if len(match) > 1 {
			// Clean up HTML entities and formatting
			text := strings.ReplaceAll(match[1], "&amp;", "&")
			text = strings.ReplaceAll(text, "&lt;", "<")
			text = strings.ReplaceAll(text, "&gt;", ">")
			text = strings.ReplaceAll(text, "&quot;", "\"")
			text = strings.ReplaceAll(text, "&#39;", "'")
			
			transcript.WriteString(text)
			transcript.WriteString(" ")
		}
	}
	
	return strings.TrimSpace(transcript.String())
}