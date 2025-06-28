package main

import (
	"fmt"
	"log"

	"github.com/mendableai/firecrawl-go"
)

func main() {
	// Initialize the FirecrawlApp with your API key
	apiKey := "fc-YOUR_API_KEY"
	apiUrl := "https://api.firecrawl.dev"
	version := "v1"

	app, err := firecrawl.NewFirecrawlApp(apiKey, apiUrl, version)
	if err != nil {
		log.Fatalf("Failed to initialize FirecrawlApp: %v", err)
	}

	// Scrape a website
	scrapeResult, err := app.ScrapeUrl("https://firecrawl.dev", map[string]any{
		"formats": []string{"markdown", "html"},
	})
	if err != nil {
		log.Fatalf("Failed to scrape URL: %v", err)
	}

	fmt.Println(scrapeResult)
}
