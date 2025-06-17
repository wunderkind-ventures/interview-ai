package scrapers

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"interviewai.wkv.local/contentscraper/models"
	"github.com/PuerkitoBio/goquery"
)

// BlogScraper handles scraping content from blog posts and articles
type BlogScraper struct {
	client *http.Client
}

// NewBlogScraper creates a new blog scraper
func NewBlogScraper() *BlogScraper {
	return &BlogScraper{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ScrapeArticle extracts content from a blog post or article URL
func (bs *BlogScraper) ScrapeArticle(articleURL string) (*models.ScrapedContent, error) {
	// Validate URL
	if _, err := url.Parse(articleURL); err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	// Fetch the webpage
	resp, err := bs.client.Get(articleURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch article: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	// Parse HTML
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract article metadata and content
	article := bs.extractArticleData(doc, articleURL)

	// Process content to extract structured data
	content := bs.processContent(article.Content, article)

	scrapedContent := &models.ScrapedContent{
		Source: models.ContentSource{
			Type:          "blog",
			URL:           articleURL,
			Title:         article.Title,
			Author:        article.Author,
			DatePublished: article.DatePublished,
			Description:   article.Description,
		},
		Content: content,
	}

	// Classify content type and interview type
	bs.classifyContent(scrapedContent)

	return scrapedContent, nil
}

// ArticleData contains extracted article information
type ArticleData struct {
	Title         string
	Author        string
	DatePublished string
	Description   string
	Content       string
	Tags          []string
}

// extractArticleData extracts structured data from the HTML document
func (bs *BlogScraper) extractArticleData(doc *goquery.Document, url string) *ArticleData {
	article := &ArticleData{}

	// Extract title - try multiple selectors
	article.Title = bs.extractTitle(doc)
	
	// Extract author
	article.Author = bs.extractAuthor(doc)
	
	// Extract publication date
	article.DatePublished = bs.extractDate(doc)
	
	// Extract description/summary
	article.Description = bs.extractDescription(doc)
	
	// Extract main content
	article.Content = bs.extractMainContent(doc)
	
	// Extract tags
	article.Tags = bs.extractTags(doc)

	log.Printf("Extracted article: %s by %s", article.Title, article.Author)
	
	return article
}

// extractTitle tries various selectors to find the article title
func (bs *BlogScraper) extractTitle(doc *goquery.Document) string {
	selectors := []string{
		"h1",
		"title",
		"meta[property='og:title']",
		"meta[name='twitter:title']",
		".entry-title",
		".post-title",
		".article-title",
	}

	for _, selector := range selectors {
		if title := strings.TrimSpace(doc.Find(selector).First().Text()); title != "" {
			return title
		}
		// For meta tags, check content attribute
		if content, exists := doc.Find(selector).First().Attr("content"); exists && content != "" {
			return content
		}
	}

	return "Untitled Article"
}

// extractAuthor tries to find the article author
func (bs *BlogScraper) extractAuthor(doc *goquery.Document) string {
	selectors := []string{
		"meta[name='author']",
		"meta[property='article:author']",
		".author",
		".byline",
		".post-author",
		".article-author",
	}

	for _, selector := range selectors {
		if author := strings.TrimSpace(doc.Find(selector).First().Text()); author != "" {
			return author
		}
		// For meta tags, check content attribute
		if content, exists := doc.Find(selector).First().Attr("content"); exists && content != "" {
			return content
		}
	}

	return "Unknown Author"
}

// extractDate tries to find the publication date
func (bs *BlogScraper) extractDate(doc *goquery.Document) string {
	selectors := []string{
		"meta[property='article:published_time']",
		"meta[name='pubdate']",
		"time[datetime]",
		".date",
		".published",
		".post-date",
	}

	for _, selector := range selectors {
		element := doc.Find(selector).First()
		
		// Check datetime attribute first
		if datetime, exists := element.Attr("datetime"); exists && datetime != "" {
			return datetime
		}
		
		// Check content attribute for meta tags
		if content, exists := element.Attr("content"); exists && content != "" {
			return content
		}
		
		// Check text content
		if date := strings.TrimSpace(element.Text()); date != "" {
			return date
		}
	}

	return time.Now().Format("2006-01-02")
}

// extractDescription tries to find the article description/summary
func (bs *BlogScraper) extractDescription(doc *goquery.Document) string {
	selectors := []string{
		"meta[name='description']",
		"meta[property='og:description']",
		"meta[name='twitter:description']",
		".excerpt",
		".summary",
		".article-summary",
	}

	for _, selector := range selectors {
		element := doc.Find(selector).First()
		
		// Check content attribute for meta tags
		if content, exists := element.Attr("content"); exists && content != "" {
			return content
		}
		
		// Check text content
		if desc := strings.TrimSpace(element.Text()); desc != "" {
			return desc
		}
	}

	return ""
}

// extractMainContent extracts the main article content
func (bs *BlogScraper) extractMainContent(doc *goquery.Document) string {
	// Try to find the main content area
	contentSelectors := []string{
		"article",
		".post-content",
		".entry-content",
		".article-content",
		".content",
		"main",
		".post-body",
	}

	var content strings.Builder
	
	for _, selector := range contentSelectors {
		element := doc.Find(selector).First()
		if element.Length() > 0 {
			// Extract text from paragraphs and headings
			element.Find("p, h1, h2, h3, h4, h5, h6, li").Each(func(i int, s *goquery.Selection) {
				text := strings.TrimSpace(s.Text())
				if text != "" {
					content.WriteString(text)
					content.WriteString("\n\n")
				}
			})
			break
		}
	}

	// If no specific content area found, try to get all paragraphs
	if content.Len() == 0 {
		doc.Find("p").Each(func(i int, s *goquery.Selection) {
			text := strings.TrimSpace(s.Text())
			if text != "" && len(text) > 50 { // Filter out short paragraphs
				content.WriteString(text)
				content.WriteString("\n\n")
			}
		})
	}

	return strings.TrimSpace(content.String())
}

// extractTags tries to find article tags or categories
func (bs *BlogScraper) extractTags(doc *goquery.Document) []string {
	var tags []string
	
	// Try different tag selectors
	tagSelectors := []string{
		"meta[name='keywords']",
		".tags a",
		".categories a",
		".tag",
		".category",
	}

	for _, selector := range tagSelectors {
		if selector == "meta[name='keywords']" {
			if content, exists := doc.Find(selector).First().Attr("content"); exists {
				for _, tag := range strings.Split(content, ",") {
					if tag = strings.TrimSpace(tag); tag != "" {
						tags = append(tags, tag)
					}
				}
			}
		} else {
			doc.Find(selector).Each(func(i int, s *goquery.Selection) {
				if tag := strings.TrimSpace(s.Text()); tag != "" {
					tags = append(tags, tag)
				}
			})
		}
		
		if len(tags) > 0 {
			break
		}
	}

	return tags
}

// processContent extracts structured data from the article content
func (bs *BlogScraper) processContent(content string, article *ArticleData) models.ContentData {
	// TODO: Implement NLP processing to extract questions, concepts, and tips
	// This is a placeholder implementation
	
	contentData := models.ContentData{
		FullTranscript: content,
		Tags:           article.Tags,
		Summary:        generateSummary(content),
	}

	// Extract interview questions
	contentData.Questions = extractQuestionsFromText(content)
	
	// Extract technical concepts
	contentData.Concepts = extractConceptsFromText(content)
	
	// Extract tips and advice
	contentData.Tips = extractTipsFromText(content)

	return contentData
}

// classifyContent determines the content type and interview type for blog content
func (bs *BlogScraper) classifyContent(content *models.ScrapedContent) {
	title := strings.ToLower(content.Source.Title)
	description := strings.ToLower(content.Source.Description)
	text := title + " " + description + " " + strings.ToLower(content.Content.FullTranscript)

	// Classify content type
	if strings.Contains(text, "interview") && strings.Contains(text, "question") {
		content.ContentType = "interview_experience"
	} else if strings.Contains(text, "tutorial") || strings.Contains(text, "guide") {
		content.ContentType = "tutorial"
	} else if strings.Contains(text, "tips") || strings.Contains(text, "advice") {
		content.ContentType = "tips"
	} else if strings.Contains(text, "system design") || strings.Contains(text, "architecture") {
		content.ContentType = "system_design"
	} else {
		content.ContentType = "general"
	}

	// Classify interview type
	if strings.Contains(text, "system design") || strings.Contains(text, "architecture") {
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

	// Extract target level
	content.TargetLevel = extractTargetLevel(text)

	// Extract target company
	content.TargetCompany = extractTargetCompany(text)
}

// Helper functions for blog content processing

func extractQuestionsFromText(content string) []models.Question {
	// TODO: Implement more sophisticated question extraction
	questions := []models.Question{}
	
	// Simple pattern matching for common question formats
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasSuffix(line, "?") && len(line) > 20 {
			questions = append(questions, models.Question{
				QuestionText: line,
				Context:      "Extracted from blog content",
				Category:     "general",
			})
		}
	}
	
	return questions
}

func extractConceptsFromText(content string) []models.Concept {
	// TODO: Implement NLP-based concept extraction
	return []models.Concept{
		{
			Term:        "System Design",
			Explanation: "The process of defining the architecture, components, and interfaces of a system",
			Importance:  "high",
		},
	}
}

func extractTipsFromText(content string) []models.Tip {
	// TODO: Implement tip extraction from blog content
	tips := []models.Tip{}
	
	// Look for bullet points or numbered lists that might contain tips
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "•") || strings.HasPrefix(line, "-") || 
		   (len(line) > 0 && line[0] >= '1' && line[0] <= '9' && strings.HasPrefix(line[1:], ".")) {
			if len(line) > 20 {
				tips = append(tips, models.Tip{
					Category: "general",
					Tip:      strings.TrimLeft(line, "•-123456789. "),
				})
			}
		}
	}
	
	return tips
}