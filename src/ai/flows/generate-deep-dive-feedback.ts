
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
import type { FeedbackItem } from '@/lib/types'; // Used for originalFeedback context

// Input schema for the data needed by the prompt template
const DeepDivePromptInputSchema = z.object({
  questionText: z.string().describe('The original interview question.'),
  userAnswerText: z.string().describe("The user's answer to the question."),
  interviewType: z.string().describe('The overall type of the interview (e.g., "product sense").'),
  faangLevel: z.string().describe('The target FAANG complexity level of the interview.'),
  jobTitle: z.string().optional().describe('The job title, if provided.'),
  jobDescription: z.string().optional().describe('The job description, if provided.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills the user focused on.'),
  // Optional original feedback to give the AI more context, if available
  originalCritique: z.string().optional().describe('The initial critique provided for this answer, if any.'),
  originalStrengths: z.array(z.string()).optional().describe('Initial strengths identified, if any.'),
  originalAreasForImprovement: z.array(z.string()).optional().describe('Initial areas for improvement, if any.'),
});

// Schema for what the AI model is expected to return
const DeepDiveOutputSchema = z.object({
  detailedIdealAnswerBreakdown: z
    .array(z.string())
    .describe('A step-by-step breakdown or key structural components of an ideal answer to this specific question. Be detailed and actionable.'),
  alternativeApproaches: z
    .array(z.string())
    .describe('Different valid perspectives, frameworks, or methods the candidate could have used to approach this question.'),
  followUpScenarios: z
    .array(z.string())
    .describe('A few hypothetical "what if" or probing follow-up questions an interviewer might ask based on the original question or typical answer patterns. These should push the candidate to think deeper.'),
  suggestedStudyConcepts: z
    .array(z.string())
    .describe('Key concepts, technologies, or areas of knowledge relevant to the question that the candidate might benefit from studying further.'),
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
The goal is to help the user understand the nuances of the question, explore various ways to approach it, and identify areas for further learning.

Interview Context:
- Type: {{{interviewType}}}
- Level: {{{faangLevel}}}
{{#if jobTitle}}- Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}- Job Description: {{{jobDescription}}}{{/if}}
{{#if targetedSkills.length}}
- Targeted Skills:
{{#each targetedSkills}}
  - {{{this}}}
{{/each}}
{{/if}}

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
Provide a detailed "Deep Dive" analysis with the following components. Be specific, constructive, and tailored to the question, answer, and interview context.

1.  **detailedIdealAnswerBreakdown**: (Array of strings)
    *   Provide a step-by-step breakdown of how an ideal answer might be structured or key components it should include.
    *   Think about logical flow, critical points to cover, and common frameworks if applicable (e.g., STAR for behavioral, specific system design approaches).
    *   Make this highly specific to the question. For example, if the question is "Design a notification system," break down aspects like requirements gathering, high-level design, component deep-dive, scalability, reliability, etc.

2.  **alternativeApproaches**: (Array of strings)
    *   Describe 2-3 different valid perspectives, frameworks, or methods the candidate could have used to approach this question.
    *   Explain briefly why these alternatives are also valid or what different aspects they might highlight.
    *   This helps the user understand there isn't always one "right" way.

3.  **followUpScenarios**: (Array of strings)
    *   Generate 2-3 challenging but fair hypothetical "what if" scenarios or probing follow-up questions an interviewer might ask based on the original question or common answer patterns.
    *   These should be designed to test deeper understanding, adaptability, or the ability to handle edge cases.
    *   Example: If the original question was about system design, a follow-up could be "How would your design change if the user base suddenly increased by 100x?"

4.  **suggestedStudyConcepts**: (Array of strings)
    *   List 2-4 key concepts, technologies, frameworks, or areas of knowledge directly relevant to the original question that the candidate might benefit from studying further.
    *   Be specific. Instead of "data structures," suggest "hash maps for efficient lookups" or "understanding trade-offs in database consistency models."

Ensure your output is in the specified JSON format with these four keys.
Focus on providing actionable, insightful, and educational content.
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
