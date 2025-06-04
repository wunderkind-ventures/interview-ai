'use server';
/**
 * @fileOverview Analyzes a user's submission for a take-home assignment.
 *
 * - analyzeTakeHomeSubmission - A function that provides detailed analysis.
 * - AnalyzeTakeHomeSubmissionInput - The input type for the analysis.
 * - AnalyzeTakeHomeSubmissionOutput - The return type containing structured feedback.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeTakeHomeSubmissionInput as AnalyzeTakeHomeSubmissionInputType, AnalyzeTakeHomeSubmissionOutput as AnalyzeTakeHomeSubmissionOutputType } from '@/lib/types';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const AnalyzeTakeHomeSubmissionContextSchema = z.object({
    interviewType: z.string(),
    faangLevel: z.string(),
    jobTitle: z.string().optional(),
    interviewFocus: z.string().optional(),
});

const AnalyzeTakeHomeSubmissionInputSchema = z.object({
  assignmentText: z.string().describe('The original text of the take-home assignment brief.'),
  idealSubmissionCharacteristics: z.array(z.string()).describe('Pre-defined key characteristics of a strong submission for this assignment.'),
  userSubmissionText: z.string().min(50, { message: "Submission text must be at least 50 characters."}).describe("The user's full submitted text for the assignment."),
  interviewContext: AnalyzeTakeHomeSubmissionContextSchema,
});
export type AnalyzeTakeHomeSubmissionInput = AnalyzeTakeHomeSubmissionInputType;

const AnalyzeTakeHomeSubmissionOutputSchema = z.object({
  overallAssessment: z.string().describe("A holistic review of the submission, covering adherence to the brief, clarity, structure, and quality of the solution/analysis. (2-4 sentences)"),
  strengthsOfSubmission: z.array(z.string()).describe("2-3 specific strengths identified in the user's submission."),
  areasForImprovementInSubmission: z.array(z.string()).describe("2-3 specific areas where the submission could be improved."),
  actionableSuggestionsForRevision: z.array(z.string()).describe("2-3 concrete, actionable suggestions for how the user could revise or improve their submission."),
});
export type AnalyzeTakeHomeSubmissionOutput = AnalyzeTakeHomeSubmissionOutputType;

const RAW_ANALYZE_TAKE_HOME_PROMPT = loadPromptFile("analyze-take-home-submission.prompt");

export async function analyzeTakeHomeSubmission(
  input: AnalyzeTakeHomeSubmissionInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<AnalyzeTakeHomeSubmissionOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'analyzeTakeHomeSubmission';

  if (options?.aiInstance) {
    activeAI = options.aiInstance;
    console.log(`[BYOK] ${flowNameForLogging}: Using provided aiInstance.`);
  } else if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with user-provided API key: ${(e as Error).message}. Falling back to default.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const validatedInput = AnalyzeTakeHomeSubmissionInputSchema.parse(input);
    
    const renderedPrompt = renderPromptTemplate(RAW_ANALYZE_TAKE_HOME_PROMPT, validatedInput);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);
    
    const result = await activeAI.generate<typeof AnalyzeTakeHomeSubmissionOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: AnalyzeTakeHomeSubmissionOutputSchema },
        config: { responseMimeType: "application/json" },
    });
      
    if (!result.output) {
        console.warn(`[BYOK] ${flowNameForLogging}: AI did not return a submission analysis.`);
        throw new Error('AI did not return a submission analysis.');
    }
      
    const output = result.output;
    
    return output;
  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during submission analysis.";
    return {
      overallAssessment: `Error: Could not complete submission analysis. ${errorMessage}`,
      strengthsOfSubmission: ["Error: Could not identify strengths."],
      areasForImprovementInSubmission: ["Error: Could not identify areas for improvement."],
      actionableSuggestionsForRevision: ["Error: Could not generate revision suggestions. Please ensure the submission is sufficiently detailed and try again."],
    };
  }
}
