package contentscraper

import (
	"fmt"
	"log"
	"os"

	"interviewai.wkv.local/contentscraper/scrapers"
)

// This is a standalone test file to verify YouTube API integration
// To run: go run test_youtube_integration.go
// Make sure to set YOUTUBE_API_KEY environment variable

func main() {
	apiKey := os.Getenv("YOUTUBE_API_KEY")
	if apiKey == "" {
		log.Fatal("YOUTUBE_API_KEY environment variable is required")
	}

	// Test video URL - a popular system design interview video
	testURL := "https://www.youtube.com/watch?v=xpDnVSmNFX0"

	fmt.Printf("Testing YouTube API integration with video: %s\n", testURL)

	// Create YouTube scraper
	scraper, err := scrapers.NewYouTubeScraper(apiKey)
	if err != nil {
		log.Fatalf("Failed to create YouTube scraper: %v", err)
	}

	// Scrape video content
	content, err := scraper.ScrapeVideo(testURL)
	if err != nil {
		log.Fatalf("Failed to scrape video: %v", err)
	}

	// Display results
	fmt.Printf("\n=== SCRAPED CONTENT ===\n")
	fmt.Printf("Title: %s\n", content.Source.Title)
	fmt.Printf("Author: %s\n", content.Source.Author)
	fmt.Printf("Date: %s\n", content.Source.DatePublished)
	fmt.Printf("Duration: %s\n", content.Source.Duration)
	fmt.Printf("Views: %d\n", content.Source.ViewCount)
	fmt.Printf("Content Type: %s\n", content.ContentType)
	fmt.Printf("Interview Type: %s\n", content.InterviewType)
	fmt.Printf("Target Level: %s\n", content.TargetLevel)
	
	if len(content.Content.Tags) > 0 {
		fmt.Printf("Tags: %v\n", content.Content.Tags)
	}
	
	if len(content.Content.Questions) > 0 {
		fmt.Printf("\nQuestions found: %d\n", len(content.Content.Questions))
		for i, q := range content.Content.Questions {
			fmt.Printf("  %d. %s\n", i+1, q.QuestionText)
		}
	}
	
	if len(content.Content.Concepts) > 0 {
		fmt.Printf("\nConcepts found: %d\n", len(content.Content.Concepts))
		for i, c := range content.Content.Concepts {
			fmt.Printf("  %d. %s: %s\n", i+1, c.Term, c.Explanation)
		}
	}
	
	if content.Content.FullTranscript != "" {
		transcriptPreview := content.Content.FullTranscript
		if len(transcriptPreview) > 200 {
			transcriptPreview = transcriptPreview[:200] + "..."
		}
		fmt.Printf("\nTranscript Preview: %s\n", transcriptPreview)
	}

	fmt.Println("\n✅ YouTube API integration test completed successfully!")
}