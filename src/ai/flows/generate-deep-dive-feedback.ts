
'use server';
/**
 * @fileOverview Generates "deep dive" feedback for a specific interview question and answer.
 *
 * - generateDeepDiveFeedback - A function that provides detailed analysis for a question.
 * - GenerateDeepDiveFeedbackInput - The input type for the deep dive generation.
 * - GenerateDeepDiveFeedbackOutput - The return type containing detailed feedback components.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import type { FeedbackItem } from '@/lib/types';

// Input schema for the data needed by the prompt template (internal)
const DeepDivePromptInputSchemaInternal = z.object({
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
const DeepDiveOutputSchemaInternal = z.object({
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
export type GenerateDeepDiveFeedbackOutput = z.infer<typeof DeepDiveOutputSchemaInternal>;


// Input schema for the exported flow function
const GenerateDeepDiveFeedbackInputSchemaInternal = z.object({
  questionText: z.string(),
  userAnswerText: z.string(),
  interviewType: z.string(),
  faangLevel: z.string(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  targetedSkills: z.array(z.string()).optional(),
  interviewFocus: z.string().optional(),
  originalFeedback: z.custom<FeedbackItem>().optional().describe('The original feedback item for this question, if available.'),
  idealAnswerCharacteristics: z.array(z.string()).optional(),
});
export type GenerateDeepDiveFeedbackInput = z.infer<typeof GenerateDeepDiveFeedbackInputSchemaInternal>;

const deepDiveFeedbackPrompt = globalAi.definePrompt({
  name: 'generateDeepDiveFeedbackPrompt',
  input: {schema: DeepDivePromptInputSchemaInternal},
  output: {schema: DeepDiveOutputSchemaInternal},
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
        If the interviewType is "machine learning":
          If ML conceptual: definition, characteristics, pros/cons, use cases, pitfalls.
          If ML system design: problem understanding, data, features, model, training, evaluation, deployment, monitoring.
        Else if the interviewType is "technical system design":
          Aspects like requirements, high-level design, components, scalability, reliability, etc.
        Else if the interviewType is "data structures & algorithms":
          Breakdown: understanding problem, high-level approach, detailed algorithm, data structures justification, complexity analysis, edge cases.
        End of interviewType specific guidance.
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

export async function generateDeepDiveFeedback(
  input: GenerateDeepDiveFeedbackInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<GenerateDeepDiveFeedbackOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'generateDeepDiveFeedback';

  if (options?.aiInstance) {
    activeAI = options.aiInstance;
    console.log(`[BYOK] ${flowNameForLogging}: Using provided aiInstance.`);
  } else if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        model: globalAi.getModel().name,
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with user-provided API key: ${(e as Error).message}. Falling back to default.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  const promptInput: z.infer<typeof DeepDivePromptInputSchemaInternal> = {
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
    idealAnswerCharacteristics: input.idealAnswerCharacteristics,
  };

  try {
    const { output } = await activeAI.run(deepDiveFeedbackPrompt, promptInput);
    if (!output) {
      throw new Error('AI did not return deep dive feedback.');
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    // Consider returning a structured error that matches GenerateDeepDiveFeedbackOutput
    // For now, rethrowing to be handled by the caller or a generic error handler.
    throw error;
  }
}

    