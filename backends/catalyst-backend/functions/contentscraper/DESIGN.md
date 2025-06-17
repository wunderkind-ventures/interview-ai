# Content Scraper Service Design

## Overview
A backend service for scraping and processing interview-related content from YouTube videos and blog posts to enhance the Interview AI platform's knowledge base.

## Architecture

### Service Structure
```
backends/catalyst-backend/functions/contentscraper/
├── go.mod
├── go.sum
├── main.go                    # Main handler with ScrapeContentGCF
├── scrapers/
│   ├── youtube.go            # YouTube caption extraction
│   └── blog.go               # Blog content extraction
├── processors/
│   ├── content_parser.go     # Parse content into structured format
│   └── embeddings.go         # Generate embeddings for RAG
└── models/
    └── content.go            # Data models matching AI flow schemas
```

## API Endpoints

### POST /api/content/scrape
Scrape content from a YouTube video or blog post.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "contentType": "youtube|blog",
  "extractionOptions": {
    "generateEmbeddings": true,
    "extractQuestions": true,
    "extractConcepts": true
  }
}
```

**Response:**
```json
{
  "source": {
    "type": "youtube",
    "url": "...",
    "title": "System Design Interview at Google",
    "author": "TechLead",
    "datePublished": "2024-01-15",
    "company": "Google"
  },
  "contentType": "system_design",
  "interviewType": "technical_system_design",
  "targetLevel": "L5",
  "content": {
    "questions": [...],
    "concepts": [...],
    "tips": [...],
    "fullTranscript": "..."
  }
}
```

### GET /api/content/search
Search scraped content by criteria.

**Query Parameters:**
- `company`: Filter by company
- `interviewType`: Filter by interview type
- `level`: Filter by target level
- `query`: Text search in content

## Implementation Details

### YouTube Scraping
1. Use YouTube Data API v3 for metadata
2. Extract captions using:
   - YouTube's built-in captions API
   - Fallback to transcript extraction libraries
3. Process timestamps for context

### Blog Scraping
1. Use Go's `goquery` for HTML parsing
2. Extract main content using:
   - Article detection algorithms
   - Schema.org metadata
   - Common content patterns
3. Clean and structure text

### Content Processing
1. **Question Extraction**
   - NLP to identify interview questions
   - Pattern matching for common formats
   - Context extraction around questions

2. **Concept Identification**
   - Technical term extraction
   - Definition parsing
   - Example collection

3. **Company/Level Detection**
   - Named entity recognition
   - Pattern matching for levels (L3, L4, etc.)
   - Company name normalization

### Integration with Existing System

1. **Authentication**: Use existing Firebase auth
2. **Storage**: Store in Firestore with indexes for search
3. **Secret Management**: API keys in Secret Manager
4. **Error Handling**: Follow existing patterns

## Environment Variables
```
# Required
GCP_PROJECT_ID=<existing project ID>

# Optional - YouTube API Key (can also be stored in Secret Manager)
YOUTUBE_API_KEY=<YouTube Data API key>

# Optional - Firebase Service Account (for local development)
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=<path to service account JSON>

# Future - for embeddings generation
EMBEDDING_API_KEY=<API key for embeddings>
```

## API Key Management

The service supports multiple ways to provide the YouTube API key:

1. **User-specific API keys**: Stored in Secret Manager with pattern `user-gemini-api-key-{userID}`
2. **System-wide API key**: Environment variable `YOUTUBE_API_KEY`
3. **System Secret Manager**: Secret named `youtube-api-key` in Secret Manager

The service tries these in order, falling back to the next option if the previous one fails.

## Dependencies
```go
// go.mod
module interviewai.wkv.local/contentscraper

go 1.23

require (
    cloud.google.com/go/firestore v1.15.0
    cloud.google.com/go/secretmanager v1.13.0
    firebase.google.com/go/v4 v4.14.0
    github.com/PuerkitoBio/goquery v1.9.0
    google.golang.org/api v0.180.0
    // ... other existing dependencies
)
```

## Security Considerations
1. Rate limiting for scraping requests
2. URL validation and sanitization
3. Content moderation for scraped data
4. Respect robots.txt and terms of service

## Future Enhancements
1. Batch processing for multiple URLs
2. Scheduled scraping for content updates
3. Integration with vector database for RAG
4. Support for additional content sources (podcasts, PDFs)