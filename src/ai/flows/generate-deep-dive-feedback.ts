
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
  idealAnswerCharacteristics: z.array(z.string()).optional().describe("Pre-defined characteristics of a strong answer to this specific question, to be used as a benchmark."),
});

// Schema for what the AI model is expected to return
const DeepDiveOutputSchema = z.object({
  detailedIdealAnswerBreakdown: z
    .array(z.string())
    .describe('A step-by-step breakdown or key structural components of an ideal answer to this specific question, tailored to the faangLevel. This should be informed by any provided idealAnswerCharacteristics.'),
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
  idealAnswerCharacteristics: z.array(z.string()).optional(), // Added
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
- Level: {{{faangLevel}}}
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

{{#if idealAnswerCharacteristics.length}}
Key Characteristics of an Ideal Answer to this Question (Benchmark):
{{#each idealAnswerCharacteristics}}
- {{{this}}}
{{/each}}
{{/if}}

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
Provide a detailed "Deep Dive" analysis with the following components. Be specific, constructive, and tailored.
Crucially, your analysis, especially the 'detailedIdealAnswerBreakdown', should be informed by and align with the 'Key Characteristics of an Ideal Answer to this Question' provided above, if any.

1.  **detailedIdealAnswerBreakdown**: (Array of strings)
    *   Provide a step-by-step breakdown of how an ideal answer might be structured or key components it should include, particularly considering the 'interviewFocus', '{{{faangLevel}}}', and the benchmark 'idealAnswerCharacteristics'.
    *   This should go beyond generic advice and relate directly to the question asked.
        {{#if (eq interviewType "machine learning")}}
        If ML conceptual: definition, characteristics, pros/cons, use cases, pitfalls.
        If ML system design: problem understanding, data, features, model, training, evaluation, deployment, monitoring.
        {{else if (eq interviewType "technical system design")}}
        Aspects like requirements, high-level design, components, scalability, reliability, etc.
        {{else if (eq interviewType "data structures & algorithms")}}
        Breakdown: understanding problem, high-level approach, detailed algorithm, data structures justification, complexity analysis, edge cases.
        {{/if}}
    *   Ensure this breakdown reflects the insights from the 'idealAnswerCharacteristics'.

2.  **alternativeApproaches**: (Array of strings)
    *   Describe 2-3 different valid perspectives, frameworks, or methods, especially if they highlight different ways to address the 'interviewFocus' or meet the 'idealAnswerCharacteristics'. Sophistication should align with '{{{faangLevel}}}'.

3.  **followUpScenarios**: (Array of strings)
    *   Generate 2-3 challenging "what if" scenarios or probing follow-ups to test deeper understanding, related to 'interviewFocus' and complexity for '{{{faangLevel}}}'.

4.  **suggestedStudyConcepts**: (Array of strings)
    *   List 2-4 key concepts, technologies, or areas relevant to the original question, 'interviewFocus', '{{{faangLevel}}}', and insights from 'idealAnswerCharacteristics'.

Ensure your output is in the specified JSON format with these four keys.
Focus on providing actionable, insightful, and educational content, calibrated to '{{{faangLevel}}}' and guided by the provided 'idealAnswerCharacteristics'.
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
      idealAnswerCharacteristics: input.idealAnswerCharacteristics, // Pass characteristics
    };

    const {output} = await prompt(promptInput);

    if (!output) {
      throw new Error('AI did not return deep dive feedback.');
    }
    return output;
  }
);
