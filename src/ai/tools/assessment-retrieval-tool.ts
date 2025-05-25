
'use server';
/**
 * @fileOverview Defines a Genkit tool for simulating the retrieval of relevant assessments.
 * In a real RAG system, this would query a vector database.
 *
 * - findRelevantAssessmentsTool - A tool that "retrieves" assessment snippets.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FindRelevantAssessmentsInputSchema = z.object({
  query: z.string().describe('A query describing the type of assessment or topic to search for (e.g., "product sense L5 metrics", "behavioral question about conflict").'),
  count: z.number().min(1).max(5).default(3).describe('The number of relevant assessment snippets to retrieve.'),
});
export type FindRelevantAssessmentsInput = z.infer<typeof FindRelevantAssessmentsInputSchema>;

const FindRelevantAssessmentsOutputSchema = z.object({
  retrievedSnippets: z.array(z.string()).describe('An array of text snippets from supposedly relevant assessments.'),
});
export type FindRelevantAssessmentsOutput = z.infer<typeof FindRelevantAssessmentsOutputSchema>;

// Simulated data - in a real system, this would come from a vector DB
const SIMULATED_ASSESSMENT_DB: Array<{ keywords: string[]; content: string; type: string; level: string }> = [
  {
    keywords: ['product sense', 'metrics', 'l5', 'growth'],
    content: "Scenario: Our streaming service has seen a 10% dip in daily active users (DAU) in the last quarter. Propose a product strategy to reverse this trend. What are the key metrics you would track? How would you diagnose the root cause?",
    type: 'product sense',
    level: 'L5'
  },
  {
    keywords: ['system design', 'scalability', 'l6', 'notifications'],
    content: "Design a highly scalable notification system for a social media platform with 1 billion users. Focus on minimizing latency and ensuring reliability. Discuss potential bottlenecks and how you would monitor the system.",
    type: 'technical system design',
    level: 'L6'
  },
  {
    keywords: ['behavioral', 'conflict', 'l4', 'teamwork'],
    content: "Tell me about a time you had a significant disagreement with a team member. How did you approach the situation, what was the outcome, and what did you learn?",
    type: 'behavioral',
    level: 'L4'
  },
  {
    keywords: ['data structures', 'algorithms', 'l4', 'arrays'],
    content: "Problem: Given an array of integers, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum. (Kadane's Algorithm context)",
    type: 'data structures & algorithms',
    level: 'L4'
  },
  {
    keywords: ['machine learning', 'recommendation', 'l5', 'system design'],
    content: "Design an ML-powered recommendation system for an e-commerce platform. What features would you use? How would you evaluate model performance and handle cold starts?",
    type: 'machine learning',
    level: 'L5'
  },
  {
    keywords: ['take-home', 'product strategy', 'l6', 'new market'],
    content: "Assignment: Your company, a successful fitness app in North America, is considering expanding to Southeast Asia. Prepare a 5-page memo outlining your market entry strategy, including user research, localization considerations, MVP features, and GTM plan.",
    type: 'product sense',
    level: 'L6'
  }
];

export const findRelevantAssessmentsTool = ai.defineTool(
  {
    name: 'findRelevantAssessmentsTool',
    description: 'Simulates retrieving snippets from existing assessments based on a query. Use this to get inspiration or understand common patterns for certain types of interview questions or scenarios. Do not directly copy the retrieved content.',
    inputSchema: FindRelevantAssessmentsInputSchema,
    outputSchema: FindRelevantAssessmentsOutputSchema,
  },
  async (input): Promise<FindRelevantAssessmentsOutput> => {
    console.log(`[findRelevantAssessmentsTool] Received query: "${input.query}", count: ${input.count}`);
    const queryLower = input.query.toLowerCase();
    const queryKeywords = queryLower.split(/\s+/);

    const relevant = SIMULATED_ASSESSMENT_DB.filter(assessment => {
      const assessmentText = `${assessment.content.toLowerCase()} ${assessment.keywords.join(' ').toLowerCase()} ${assessment.type} ${assessment.level}`;
      return queryKeywords.some(qk => assessmentText.includes(qk));
    });

    const snippets = relevant
      .sort(() => 0.5 - Math.random()) // Basic shuffle for variety
      .slice(0, input.count)
      .map(r => `Type: ${r.type}, Level: ${r.level}, Content: ${r.content.substring(0, 250)}${r.content.length > 250 ? '...' : ''}`);
    
    if (snippets.length === 0) {
        snippets.push("Simulated: No highly relevant assessment snippets found for this specific query in the demo database. Consider general best practices for the requested interview type and level.");
    }
    
    console.log(`[findRelevantAssessmentsTool] Returning ${snippets.length} snippets.`);
    return { retrievedSnippets: snippets };
  }
);
