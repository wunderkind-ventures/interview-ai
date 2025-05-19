
'use server';
/**
 * @fileOverview Generates "deep dive" feedback for a specific interview question and answer.
 *
 * - generateDeepDiveFeedback - A function that provides detailed analysis for a question.
 * - GenerateDeepDiveFeedbackInput - The input type for the deep dive generation.
 * - GenerateDeepDiveFeedbackOutput - The return type containing detailed feedback components.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { FeedbackItem } from '@/lib/types'; 

// Input schema for the data needed by the prompt template
const DeepDivePromptInputSchema = z.object({
  questionText: z.string().describe('The original interview question.'),
  userAnswerText: z.string().describe("The user's answer to the question."),
  interviewType: z.string().describe('The overall type of the interview (e.g., "product sense", "machine learning", "data structures & algorithms").'),
  faangLevel: z.string().describe('The target FAANG complexity level of the interview. This should influence the depth and rigor of the ideal answer and alternative approaches.'),
  jobTitle: z.string().optional().describe('The job title, if provided.'),
  jobDescription: z.string().optional().describe('The job description, if provided.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills the user focused on.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'), 
  originalCritique: z.string().optional().describe('The initial critique provided for this answer, if any.'),
  originalStrengths: z.array(z.string()).optional().describe('Initial strengths identified, if any.'),
  originalAreasForImprovement: z.array(z.string()).optional().describe('Initial areas for improvement, if any.'),
});

// Schema for what the AI model is expected to return
const DeepDiveOutputSchema = z.object({
  detailedIdealAnswerBreakdown: z
    .array(z.string())
    .describe('A step-by-step breakdown or key structural components of an ideal answer to this specific question, tailored to the faangLevel. Be detailed and actionable.'),
  alternativeApproaches: z
    .array(z.string())
    .describe('Different valid perspectives, frameworks, or methods the candidate could have used to approach this question, reflecting the sophistication expected at the faangLevel.'),
  followUpScenarios: z
    .array(z.string())
    .describe('A few hypothetical "what if" or probing follow-up questions an interviewer might ask based on the original question or typical answer patterns. These should push the candidate to think deeper, considering the faangLevel.'),
  suggestedStudyConcepts: z
    .array(z.string())
    .describe('Key concepts, technologies, or areas of knowledge relevant to the question that the candidate might benefit from studying further to meet faangLevel expectations.'),
});
export type GenerateDeepDiveFeedbackOutput = z.infer<typeof DeepDiveOutputSchema>;


// Input schema for the exported flow function
export const GenerateDeepDiveFeedbackInputSchema = z.object({
  questionText: z.string(),
  userAnswerText: z.string(),
  interviewType: z.string(), 
  faangLevel: z.string(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  targetedSkills: z.array(z.string()).optional(),
  interviewFocus: z.string().optional(), 
  originalFeedback: z.custom<FeedbackItem>().optional().describe('The original feedback item for this question, if available.'),
});
export type GenerateDeepDiveFeedbackInput = z.infer<typeof GenerateDeepDiveFeedbackInputSchema>;


export async function generateDeepDiveFeedback(
  input: GenerateDeepDiveFeedbackInput
): Promise<GenerateDeepDiveFeedbackOutput> {
  return generateDeepDiveFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDeepDiveFeedbackPrompt',
  input: {schema: DeepDivePromptInputSchema},
  output: {schema: DeepDiveOutputSchema},
  prompt: `You are an expert Interview Coach AI, providing a "Deep Dive" analysis for a specific interview question and the user's answer.
The goal is to help the user understand the nuances of the question, explore various ways to approach it, and identify areas for further learning, all calibrated to the specified 'faangLevel'.

Interview Context:
- Type: {{{interviewType}}}
- Level: {{{faangLevel}}} (Consider expectations for ambiguity, complexity, scope, and execution for this level when crafting the deep dive.)
{{#if jobTitle}}- Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}- Job Description: {{{jobDescription}}}{{/if}}
{{#if targetedSkills.length}}
- Targeted Skills:
{{#each targetedSkills}}
  - {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}- Specific Focus: {{{interviewFocus}}}{{/if}}

Original Question:
"{{{questionText}}}"

User's Answer to this Question:
"{{{userAnswerText}}}"

{{#if originalCritique}}
Context from Initial Feedback (if available):
- Initial Critique: {{{originalCritique}}}
{{#if originalStrengths.length}}
- Initial Strengths: {{#each originalStrengths}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if originalAreasForImprovement.length}}
- Initial Areas for Improvement: {{#each originalAreasForImprovement}} "{{this}}"{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/if}}

Your Task:
Provide a detailed "Deep Dive" analysis with the following components. Be specific, constructive, and tailored to the question, answer, and interview context (including the 'interviewFocus' and critically, the 'faangLevel').

1.  **detailedIdealAnswerBreakdown**: (Array of strings)
    *   Provide a step-by-step breakdown of how an ideal answer might be structured or key components it should include, particularly considering the 'interviewFocus' and the depth expected for '{{{faangLevel}}}'.
    *   Think about logical flow, critical points to cover, and common frameworks if applicable (e.g., STAR for behavioral, specific system design approaches for different levels of complexity).
    *   Make this highly specific to the question. 
        {{#if (eq interviewType "machine learning")}}
        If this is a Machine Learning conceptual question, the breakdown might include: clear definition, key characteristics, pros/cons, common use cases, and potential pitfalls. 
        If it's an ML system design question, breakdown could include: problem understanding & scoping, data considerations (sources, preprocessing, labeling), feature engineering, model selection rationale, training strategy, evaluation metrics, deployment plan, and monitoring.
        {{else if (eq interviewType "technical system design")}}
        If the question is "Design a notification system," break down aspects like requirements gathering (more detailed for higher levels), high-level design, component deep-dive, scalability (more critical for higher levels), reliability, etc., all while relating back to the 'interviewFocus' and '{{{faangLevel}}}'.
        {{else if (eq interviewType "data structures & algorithms")}}
        If this is a Data Structures & Algorithms problem, the breakdown should cover:
        - Understanding the problem: Restating, clarifying constraints, identifying inputs/outputs.
        - High-level approach: General strategy (e.g., two pointers, BFS, recursion).
        - Detailed algorithm steps: Pseudo-code like description of the logic.
        - Data structures: Justification for chosen data structures (e.g., hash map for lookups, heap for priority).
        - Complexity analysis: Step-by-step derivation of time and space complexity.
        - Edge cases: How the solution handles common edge cases (e.g., empty input, single element).
        {{else}}
        Tailor the breakdown to the specific '{{{interviewType}}}'.
        {{/if}}

2.  **alternativeApproaches**: (Array of strings)
    *   Describe 2-3 different valid perspectives, frameworks, or methods the candidate could have used to approach this question, especially if they highlight different ways to address the 'interviewFocus'.
    *   Explain briefly why these alternatives are also valid or what different aspects they might highlight. The sophistication of these alternatives should align with '{{{faangLevel}}}'.
        {{#if (eq interviewType "machine learning")}}
        For ML questions, alternatives could include different model families (e.g., tree-based vs. neural nets), different evaluation strategies, or alternative ways to frame the problem (e.g., classification vs. regression if applicable).
        {{else if (eq interviewType "data structures & algorithms")}}
        For DSA, alternatives could include different algorithms (e.g., brute-force vs. optimized), variations in data structures (e.g., array vs. linked list for storing a sequence), or different ways to approach complexity trade-offs (time vs. space).
        {{/if}}
    *   This helps the user understand there isn't always one "right" way.

3.  **followUpScenarios**: (Array of strings)
    *   Generate 2-3 challenging but fair hypothetical "what if" scenarios or probing follow-up questions an interviewer might ask based on the original question or common answer patterns, especially ones that push deeper into the 'interviewFocus'.
    *   These should be designed to test deeper understanding, adaptability, or the ability to handle edge cases, with complexity appropriate for '{{{faangLevel}}}'.
    *   Example: If the original question was about system design with an 'interviewFocus' on cost-optimization for an L6, a follow-up could be "How would your design change if the budget was halved but performance requirements remained, and how would you negotiate these constraints with stakeholders?"
        {{#if (eq interviewType "machine learning")}}
        For ML system design, follow-ups could be: "What if your primary data source becomes unavailable?", "How would you handle a sudden concept drift in your model's predictions related to {{{interviewFocus}}}?", "How would you explain your model's decision-making process to a non-technical stakeholder, especially for {{{faangLevel}}} roles that require strong communication?"
        {{else if (eq interviewType "data structures & algorithms")}}
        For DSA, follow-ups could be: "How would your solution adapt if the input numbers could be negative?", "What if the input array is sorted?", "Can you optimize your solution if memory is very constrained but time is less critical?", "How would this problem change if we were dealing with a stream of data instead of a fixed array?"
        {{/if}}

4.  **suggestedStudyConcepts**: (Array of strings)
    *   List 2-4 key concepts, technologies, frameworks, or areas of knowledge directly relevant to the original question, the 'interviewFocus', and what would be expected for someone at '{{{faangLevel}}}' to master.
    *   Be specific. Instead of "data structures," suggest "advanced hash map collision resolution techniques for '{{{interviewFocus}}}' at scale" or "understanding eventual consistency vs. strong consistency trade-offs in distributed databases when dealing with '{{{interviewFocus}}}' for an L5/L6 role."
        {{#if (eq interviewType "machine learning")}}
        For ML, this could be specific algorithms (e.g., "Transformer architectures for NLP tasks related to {{{interviewFocus}}}"), MLOps tools/practices (e.g., "Kubeflow or MLflow for model lifecycle management at {{{faangLevel}}} scale"), or advanced statistical concepts relevant to {{{interviewFocus}}}.
        {{else if (eq interviewType "data structures & algorithms")}}
        For DSA, this could be specific algorithmic paradigms (e.g., "Kadane's algorithm for maximum subarray problems", "Floyd-Warshall for all-pairs shortest paths"), advanced data structures (e.g., "Trie for string prefix operations", "Segment Trees for range queries"), or proof techniques for complexity.
        {{/if}}

Ensure your output is in the specified JSON format with these four keys.
Focus on providing actionable, insightful, and educational content, calibrated to the '{{{faangLevel}}}'.
`,
});

const generateDeepDiveFeedbackFlow = ai.defineFlow(
  {
    name: 'generateDeepDiveFeedbackFlow',
    inputSchema: GenerateDeepDiveFeedbackInputSchema,
    outputSchema: DeepDiveOutputSchema,
  },
  async (input: GenerateDeepDiveFeedbackInput) => {
    const promptInput: z.infer<typeof DeepDivePromptInputSchema> = {
      questionText: input.questionText,
      userAnswerText: input.userAnswerText,
      interviewType: input.interviewType,
      faangLevel: input.faangLevel,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      targetedSkills: input.targetedSkills,
      interviewFocus: input.interviewFocus, 
      originalCritique: input.originalFeedback?.critique,
      originalStrengths: input.originalFeedback?.strengths,
      originalAreasForImprovement: input.originalFeedback?.areasForImprovement,
    };

    const {output} = await prompt(promptInput);

    if (!output) {
      throw new Error('AI did not return deep dive feedback.');
    }
    return output;
  }
);
