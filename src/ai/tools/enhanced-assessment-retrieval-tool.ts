'use server';
/**
 * @fileOverview Enhanced assessment retrieval tool that uses real semantic search
 * with embeddings and vector similarity instead of simulated keyword matching.
 *
 * This tool integrates with the vector search service to provide RAG capabilities.
 */

import { type Genkit } from 'genkit';
import { z } from 'genkit';

const EnhancedAssessmentRetrievalInputSchema = z.object({
  query: z.string().describe('A query describing the type of assessment or topic to search for (e.g., "product sense L5 metrics", "behavioral question about conflict").'),
  count: z.number().min(1).max(10).default(5).describe('The number of relevant assessment snippets to retrieve.'),
  filters: z.object({
    interviewType: z.string().optional().describe('Filter by interview type (e.g., "behavioral", "technical_system_design")'),
    targetLevel: z.string().optional().describe('Filter by target level (e.g., "L4", "L5", "L6")'),
    targetCompany: z.string().optional().describe('Filter by target company'),
    contentType: z.string().optional().describe('Filter by content type (e.g., "interview_experience", "tips")'),
    minQuality: z.number().optional().describe('Minimum quality score (0-1)')
  }).optional().describe('Optional filters to narrow down search results')
});

export type EnhancedAssessmentRetrievalInput = z.infer<typeof EnhancedAssessmentRetrievalInputSchema>;

const EnhancedAssessmentRetrievalOutputSchema = z.object({
  retrievedSnippets: z.array(z.object({
    content: z.string().describe('The relevant content snippet'),
    source: z.string().describe('Source URL or reference'),
    title: z.string().describe('Title of the source content'),
    score: z.number().describe('Relevance score (0-1)'),
    metadata: z.object({
      interviewType: z.string().optional(),
      targetLevel: z.string().optional(),
      targetCompany: z.string().optional(),
      contentType: z.string().optional(),
      author: z.string().optional(),
      qualityScore: z.number().optional()
    }).describe('Additional metadata about the source')
  })).describe('Array of relevant content snippets with metadata'),
  totalFound: z.number().describe('Total number of matching results'),
  searchQuery: z.string().describe('The processed search query')
});

export type EnhancedAssessmentRetrievalOutput = z.infer<typeof EnhancedAssessmentRetrievalOutputSchema>;

// Configuration for the vector search service
const VECTOR_SEARCH_CONFIG = {
  baseUrl: process.env.VECTOR_SEARCH_BASE_URL || 'https://vectorsearch-function-url',
  timeout: 30000, // 30 seconds
};

/**
 * Performs semantic search using the vector search service
 */
async function performSemanticSearch(
  query: string, 
  filters: any = {}, 
  limit: number = 5
): Promise<any> {
  try {
    const searchPayload = {
      query,
      filters,
      limit
    };

    const response = await fetch(`${VECTOR_SEARCH_CONFIG.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In production, you'd include authentication headers here
        'Authorization': `Bearer ${process.env.VECTOR_SEARCH_API_KEY || ''}`
      },
      body: JSON.stringify(searchPayload),
      signal: AbortSignal.timeout(VECTOR_SEARCH_CONFIG.timeout)
    });

    if (!response.ok) {
      throw new Error(`Vector search failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Semantic search failed:', error);
    // Fallback to simulated results
    return await fallbackToSimulatedSearch(query, limit);
  }
}

/**
 * Fallback function that uses the original simulated approach
 * when vector search is unavailable
 */
async function fallbackToSimulatedSearch(query: string, limit: number): Promise<any> {
  console.log('[Enhanced RAG] Falling back to simulated search');
  
  // Enhanced simulated database with more realistic content
  const ENHANCED_SIMULATED_DB = [
    {
      content: "System Design: Design a chat system like WhatsApp or Slack. Key considerations include real-time messaging, scalability for millions of users, message persistence, push notifications, and handling different message types. Focus on WebSocket connections, message queues, database sharding, and CDN for media files.",
      source: "https://youtube.com/watch?v=example1",
      title: "System Design Interview: Chat System",
      score: 0.85,
      metadata: {
        interviewType: "technical_system_design",
        targetLevel: "L5",
        contentType: "interview_experience",
        author: "TechLead",
        qualityScore: 0.9
      }
    },
    {
      content: "Behavioral Interview: 'Tell me about a time you disagreed with your manager.' Use the STAR method: Situation - working on feature prioritization, Task - needed to advocate for user research, Action - prepared data-driven proposal, Result - manager agreed and user satisfaction improved 15%.",
      source: "https://medium.com/behavioral-interviews",
      title: "Behavioral Interview Best Practices",
      score: 0.78,
      metadata: {
        interviewType: "behavioral",
        targetLevel: "L4",
        contentType: "tips",
        author: "Product Manager",
        qualityScore: 0.8
      }
    },
    {
      content: "Product Sense: 'How would you improve Google Maps?' Focus on user segments (commuters, tourists, drivers), identify pain points (traffic, discovery, accessibility), propose solutions (real-time crowd-sourced updates, AR navigation, voice-first interface), and define success metrics (engagement, user satisfaction, navigation accuracy).",
      source: "https://blog.product-interviews.com/google-maps",
      title: "Product Sense Questions: Google Maps",
      score: 0.82,
      metadata: {
        interviewType: "product_sense",
        targetLevel: "L5",
        targetCompany: "Google",
        contentType: "interview_experience",
        author: "Senior PM",
        qualityScore: 0.85
      }
    }
  ];

  // Simple keyword matching for simulation
  const queryLower = query.toLowerCase();
  const relevant = ENHANCED_SIMULATED_DB.filter(item => 
    item.content.toLowerCase().includes(queryLower) ||
    item.title.toLowerCase().includes(queryLower) ||
    Object.values(item.metadata).some(val => 
      typeof val === 'string' && val.toLowerCase().includes(queryLower)
    )
  );

  return {
    results: relevant.slice(0, limit),
    total: relevant.length,
    query: query
  };
}

/**
 * Enhanced assessment retrieval tool factory
 */
export async function defineEnhancedAssessmentRetrievalTool(kit: Genkit) {
  return kit.defineTool(
    {
      name: 'enhancedAssessmentRetrievalTool',
      description: 'Retrieves relevant interview content using semantic search with embeddings. Provides real interview questions, tips, and examples from YouTube videos and blog posts. Use this to get contextual, high-quality examples for interview preparation.',
      inputSchema: EnhancedAssessmentRetrievalInputSchema,
      outputSchema: EnhancedAssessmentRetrievalOutputSchema,
    },
    async (input): Promise<EnhancedAssessmentRetrievalOutput> => {
      console.log(`[Enhanced RAG] Searching for: "${input.query}" with filters:`, input.filters);

      try {
        // Perform semantic search
        const searchResult = await performSemanticSearch(
          input.query,
          input.filters || {},
          input.count
        );

        // Transform results to match output schema
        const retrievedSnippets = searchResult.results.map((result: any) => ({
          content: result.content || result.Content || '',
          source: result.source || result.Source || '',
          title: result.title || result.Title || 'Untitled',
          score: result.score || result.Score || 0,
          metadata: {
            interviewType: result.metadata?.interviewType || result.ContentType,
            targetLevel: result.metadata?.targetLevel || result.metadata?.level,
            targetCompany: result.metadata?.targetCompany || result.metadata?.company,
            contentType: result.metadata?.contentType || result.ContentType,
            author: result.metadata?.author,
            qualityScore: result.metadata?.qualityScore || result.QualityScore
          }
        }));

        console.log(`[Enhanced RAG] Found ${retrievedSnippets.length} relevant snippets`);

        return {
          retrievedSnippets,
          totalFound: searchResult.total || searchResult.results?.length || 0,
          searchQuery: input.query
        };

      } catch (error) {
        console.error('[Enhanced RAG] Search failed:', error);
        
        // Return empty results rather than throwing
        return {
          retrievedSnippets: [{
            content: "Unable to retrieve content at this time. Please try rephrasing your query or check your connection.",
            source: "system",
            title: "Search Unavailable",
            score: 0,
            metadata: {}
          }],
          totalFound: 0,
          searchQuery: input.query
        };
      }
    }
  );
}

/**
 * Utility function to create a semantic search query from interview context
 */
export function buildSearchQuery(context: {
  interviewType?: string;
  targetLevel?: string;
  targetCompany?: string;
  topic?: string;
}): string {
  const parts = [];
  
  if (context.topic) {
    parts.push(context.topic);
  }
  
  if (context.interviewType) {
    parts.push(context.interviewType.replace('_', ' '));
  }
  
  if (context.targetCompany) {
    parts.push(context.targetCompany);
  }
  
  if (context.targetLevel) {
    parts.push(context.targetLevel);
  }
  
  return parts.join(' ');
}

/**
 * Utility function to filter and rank results by relevance
 */
export function rankResults(results: any[], preferences: {
  preferredCompanies?: string[];
  preferredLevels?: string[];
  minQualityScore?: number;
} = {}): any[] {
  return results
    .filter(result => {
      // Filter by minimum quality score
      if (preferences.minQualityScore && 
          result.metadata?.qualityScore < preferences.minQualityScore) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Boost preferred companies
      const aCompanyBoost = preferences.preferredCompanies?.includes(a.metadata?.targetCompany) ? 0.1 : 0;
      const bCompanyBoost = preferences.preferredCompanies?.includes(b.metadata?.targetCompany) ? 0.1 : 0;
      
      // Boost preferred levels
      const aLevelBoost = preferences.preferredLevels?.includes(a.metadata?.targetLevel) ? 0.1 : 0;
      const bLevelBoost = preferences.preferredLevels?.includes(b.metadata?.targetLevel) ? 0.1 : 0;
      
      const aScore = (a.score || 0) + aCompanyBoost + aLevelBoost;
      const bScore = (b.score || 0) + bCompanyBoost + bLevelBoost;
      
      return bScore - aScore; // Descending order
    });
}