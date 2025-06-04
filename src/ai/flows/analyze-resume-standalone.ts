'use server';
/**
 * @fileOverview Provides AI-driven analysis for a standalone resume.
 *
 * - analyzeResumeStandalone - Fetches analysis of a resume.
 * - AnalyzeResumeStandaloneInput - Input type for the flow.
 * - AnalyzeResumeStandaloneOutput - Output type for the flow.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import { z } from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const AnalyzeResumeStandaloneInputSchema = z.object({
  resumeText: z.string().min(100, "Resume text must be at least 100 characters."),
});
export type AnalyzeResumeStandaloneInput = z.infer<typeof AnalyzeResumeStandaloneInputSchema>;

const AnalyzeResumeStandaloneOutputSchema = z.object({
  strengths: z.array(z.string()).describe("Identified strengths of the resume."),
  areasForImprovement: z.array(z.string()).describe("Areas where the resume could be improved."),
  clarityScore: z.number().min(1).max(5).describe("A score from 1 (Very Unclear) to 5 (Very Clear) for resume clarity and readability."),
  impactScore: z.number().min(1).max(5).describe("A score from 1 (Low Impact) to 5 (High Impact) assessing the impactfulness of achievements and language used."),
  overallFeedback: z.string().describe("A brief overall summary of the resume's effectiveness."),
  actionableSuggestions: z.array(z.string()).describe("Specific, actionable suggestions for general improvement of the resume."),
});
export type AnalyzeResumeStandaloneOutput = z.infer<typeof AnalyzeResumeStandaloneOutputSchema>;

export async function analyzeResumeStandalone(
  input: AnalyzeResumeStandaloneInput,
  options?: { apiKey?: string }
): Promise<AnalyzeResumeStandaloneOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'analyzeResumeStandalone';

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
      activeAI = globalAi;
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No user API key provided; using default global AI instance.`);
  }

  try {
    const RAW_ANALYZE_PROMPT = loadPromptFile("analyze-resume-standalone.prompt");
    if (!RAW_ANALYZE_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load analyze-resume-standalone.prompt. Falling back to error response.`);
      return {
        strengths: ["Error: Could not load prompt file."],
        areasForImprovement: ["Error: Could not load prompt file."],
        clarityScore: 1,
        impactScore: 1,
        overallFeedback: "An error occurred while preparing resume analysis due to a missing prompt file. Please contact support.",
        actionableSuggestions: ["Error: Could not load prompt file."],
      };
    }
    const renderedPrompt = renderPromptTemplate(RAW_ANALYZE_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof AnalyzeResumeStandaloneOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: AnalyzeResumeStandaloneOutputSchema },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output;
    if (!output) {
      console.error(`[${flowNameForLogging}] AI did not return resume analysis or failed to parse. Using fallback.`);
      return {
        strengths: ["Error: AI returned no data or failed to parse."],
        areasForImprovement: ["Error: AI returned no data or failed to parse."],
        clarityScore: 1,
        impactScore: 1,
        overallFeedback: "AI service did not return valid resume analysis. Please try again.",
        actionableSuggestions: ["Error: AI returned no data or failed to parse."],
      };
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    return {
      strengths: ["Error: Could not analyze strengths due to an exception."],
      areasForImprovement: ["Error: Could not analyze areas for improvement due to an exception."],
      clarityScore: 1,
      impactScore: 1,
      overallFeedback: `An error occurred while analyzing the resume: ${(error as Error).message}. Please try again.`,
      actionableSuggestions: ["Error: Could not generate suggestions due to an exception."],
    };
  }
}
