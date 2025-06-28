# RAG System Design for Interview AI Platform

## Overview
This document outlines the design of a Retrieval-Augmented Generation (RAG) system that enhances the Interview AI platform by leveraging scraped content from YouTube videos and blog posts to provide more accurate, contextual, and up-to-date interview guidance.

## Current State Analysis

### Existing RAG Infrastructure
1. **Assessment Retrieval Tool**: Already implemented in `src/ai/tools/assessment-retrieval-tool.ts` with placeholder data
2. **Firestore Integration**: Established database with structured assessment storage
3. **Genkit Framework**: AI flows with context injection capabilities
4. **BYOK Support**: User-provided API keys for personalized AI services

### Gaps to Address
1. **No Vector Database**: Missing embedding storage and similarity search
2. **No Embedding Pipeline**: No automated content vectorization
3. **Simulated Retrieval**: Current tool uses hardcoded data
4. **Limited Context Sources**: Only user assessments, missing external knowledge

## RAG System Architecture

### 1. Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │   Embedding      │    │   Vector        │
│   Scraper       │───▶│   Generation     │───▶│   Database      │
│   (Existing)    │    │   Pipeline       │    │   (New)         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Flows      │◄───│   RAG Enhanced   │◄───│   Semantic      │
│   (Enhanced)    │    │   Retrieval      │    │   Search API    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 2. Component Design

#### A. Vector Database Options
**Recommended: Google Vertex AI Vector Search**
- **Pros**: Native GCP integration, automatic scaling, no separate infrastructure
- **Cons**: Newer service, fewer community resources
- **Integration**: Seamless with existing Google AI setup

**Alternative: Pinecone**
- **Pros**: Mature, excellent performance, rich metadata filtering
- **Cons**: Additional service cost, external dependency
- **Integration**: RESTful API, easy to integrate

#### B. Embedding Generation Strategy
```typescript
interface EmbeddingStrategy {
  // Multi-level embeddings for better retrieval
  documentLevel: string;     // Full content summary
  chunkLevel: string[];      // Paragraph/section chunks
  questionLevel: string[];   // Individual questions
  conceptLevel: string[];    // Technical concepts
}
```

#### C. Content Indexing Pipeline
```go
// Enhanced models/content.go
type IndexedContent struct {
    // Existing ScrapedContent fields
    ScrapedContent
    
    // New RAG fields
    Embeddings     map[string][]float64 `firestore:"embeddings"`     // Multiple embedding types
    ChunkIDs       []string             `firestore:"chunkIds"`       // References to chunks
    IndexedAt      time.Time            `firestore:"indexedAt"`      // When vectorized
    QualityScore   float64              `firestore:"qualityScore"`   // Content quality rating
}

type ContentChunk struct {
    ID           string    `firestore:"id"`
    ParentID     string    `firestore:"parentId"`     // Reference to main content
    ChunkType    string    `firestore:"chunkType"`    // "question", "concept", "explanation"
    Content      string    `firestore:"content"`
    Embedding    []float64 `firestore:"embedding"`
    Metadata     ChunkMetadata `firestore:"metadata"`
}
```

### 3. Integration Points

#### A. Enhanced Content Scraper
```go
// Add to scrapers/youtube.go and scrapers/blog.go
func (ys *YouTubeScraper) ScrapeVideoWithEmbeddings(videoURL string, generateEmbeddings bool) (*models.IndexedContent, error) {
    // Existing scraping logic...
    
    if generateEmbeddings {
        // Generate embeddings for different content levels
        embeddings := make(map[string][]float64)
        
        // Document-level embedding
        embeddings["document"] = ys.generateEmbedding(scrapedContent.Content.Summary)
        
        // Question-level embeddings
        for i, question := range scrapedContent.Content.Questions {
            embeddings[fmt.Sprintf("question_%d", i)] = ys.generateEmbedding(question.QuestionText)
        }
        
        // Concept-level embeddings
        for i, concept := range scrapedContent.Content.Concepts {
            embeddings[fmt.Sprintf("concept_%d", i)] = ys.generateEmbedding(concept.Explanation)
        }
    }
    
    return indexedContent, nil
}
```

#### B. Enhanced AI Flows
```typescript
// src/ai/flows/rag-enhanced-flows.ts
import { defineFlow } from '@genkit-ai/flow';
import { semanticSearch } from '../tools/semantic-search-tool';

export const ragEnhancedQuestionGeneration = defineFlow(
  {
    name: 'ragEnhancedQuestionGeneration',
    inputSchema: QuestionGenerationInputSchema,
    outputSchema: QuestionGenerationOutputSchema,
  },
  async (input) => {
    // 1. Semantic search for relevant content
    const relevantContent = await semanticSearch({
      query: `${input.jobTitle} ${input.interviewType} questions`,
      filters: {
        interviewType: input.interviewType,
        targetLevel: input.faangLevel,
        contentType: 'interview_experience'
      },
      limit: 5
    });
    
    // 2. Enhance prompt with retrieved context
    const enhancedPrompt = enhancePromptWithRAG(basePrompt, relevantContent);
    
    // 3. Generate with enhanced context
    return await generateWithContext(enhancedPrompt, input);
  }
);
```

### 4. Vector Database Implementation

#### Option A: Vertex AI Vector Search Integration
```go
// backends/catalyst-interviewai/functions/vectorsearch/main.go
package vectorsearch

import (
    "context"
    "google.golang.org/api/aiplatform/v1"
)

type VertexVectorService struct {
    client    *aiplatform.Service
    projectID string
    location  string
    indexID   string
}

func (vvs *VertexVectorService) UpsertEmbeddings(ctx context.Context, documents []IndexedDocument) error {
    // Implementation for Vertex AI Vector Search
}

func (vvs *VertexVectorService) SemanticSearch(ctx context.Context, query SearchQuery) ([]SearchResult, error) {
    // Vector similarity search implementation
}
```

#### Option B: Pinecone Integration
```typescript
// src/ai/services/pinecone-service.ts
import { PineconeClient } from '@pinecone-database/pinecone';

export class PineconeRAGService {
  private pinecone: PineconeClient;
  
  async semanticSearch(query: string, filters: RAGFilters): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Search with metadata filters
    const results = await this.index.query({
      vector: queryEmbedding,
      filter: this.buildMetadataFilter(filters),
      topK: filters.limit || 10,
      includeMetadata: true
    });
    
    return this.formatResults(results);
  }
}
```

### 5. Enhanced Retrieval Tool

```typescript
// src/ai/tools/enhanced-assessment-retrieval-tool.ts
import { defineTool } from '@genkit-ai/ai';
import { z } from 'zod';

export const enhancedAssessmentRetrievalTool = defineTool(
  {
    name: 'enhancedAssessmentRetrieval',
    description: 'Retrieves relevant interview content using semantic search',
    inputSchema: z.object({
      query: z.string(),
      interviewType: z.string().optional(),
      targetLevel: z.string().optional(),
      company: z.string().optional(),
      limit: z.number().default(5)
    }),
    outputSchema: z.array(z.object({
      content: z.string(),
      source: z.string(),
      relevanceScore: z.number(),
      metadata: z.record(z.any())
    }))
  },
  async (input) => {
    // Real semantic search instead of hardcoded data
    const searchResults = await vectorSearchService.semanticSearch({
      query: input.query,
      filters: {
        interviewType: input.interviewType,
        targetLevel: input.targetLevel,
        company: input.company
      },
      limit: input.limit
    });
    
    return searchResults.map(result => ({
      content: result.content,
      source: result.metadata.source,
      relevanceScore: result.score,
      metadata: result.metadata
    }));
  }
);
```

### 6. Content Quality & Ranking

```typescript
// Content quality scoring for better retrieval
interface QualityMetrics {
  viewCount: number;        // For YouTube videos
  transcriptQuality: number; // Transcript completeness/accuracy
  interviewRelevance: number; // How interview-focused the content is
  recency: number;          // How recent the content is
  authorCredibility: number; // Channel/author reputation
}

function calculateQualityScore(content: ScrapedContent): number {
  const metrics = extractQualityMetrics(content);
  
  return (
    metrics.viewCount * 0.2 +
    metrics.transcriptQuality * 0.3 +
    metrics.interviewRelevance * 0.3 +
    metrics.recency * 0.1 +
    metrics.authorCredibility * 0.1
  );
}
```

### 7. Implementation Phases

#### Phase 1: Foundation (Week 1-2)
- [ ] Choose vector database (Vertex AI recommended)
- [ ] Create embedding generation pipeline
- [ ] Set up vector storage infrastructure
- [ ] Index existing assessment data

#### Phase 2: Integration (Week 3-4)
- [ ] Enhance content scraper with embedding generation
- [ ] Replace simulated retrieval tool with real semantic search
- [ ] Create RAG-enhanced AI flows
- [ ] Add quality scoring and ranking

#### Phase 3: Optimization (Week 5-6)
- [ ] Fine-tune embedding models for interview domain
- [ ] Implement hybrid search (keyword + semantic)
- [ ] Add content freshness and update mechanisms
- [ ] Performance optimization and caching

### 8. Monitoring & Analytics

```typescript
// RAG performance tracking
interface RAGMetrics {
  retrievalLatency: number;
  embeddingGenerationTime: number;
  relevanceScore: number;
  userEngagement: number;
  retrievalAccuracy: number;
}
```

### 9. Cost Optimization

1. **Embedding Caching**: Store embeddings to avoid regeneration
2. **Batch Processing**: Generate embeddings in batches for efficiency
3. **Tiered Storage**: Hot/warm/cold storage based on access patterns
4. **Smart Indexing**: Only index high-quality, relevant content

This RAG system will significantly enhance the Interview AI platform by providing contextual, up-to-date information from real interview experiences and expert content, while maintaining the existing architecture's strengths and patterns.