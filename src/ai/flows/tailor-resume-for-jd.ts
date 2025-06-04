'use server';
/**
 * @fileOverview Provides AI-driven suggestions for tailoring a resume to a specific job description.
 *
 * - tailorResumeForJD - Fetches tailoring suggestions.
 * - TailorResumeForJDInput - Input type for the flow.
 * - TailorResumeForJDOutput - Output type for the flow.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import { z } from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const TailorResumeForJDInputSchema = z.object({
  resumeText: z.string().min(100, "Resume text must be at least 100 characters."),
  jobDescriptionText: z.string().min(100, "Job description text must be at least 100 characters."),
});
export type TailorResumeForJDInput = z.infer<typeof TailorResumeForJDInputSchema>;

const TailorResumeForJDOutputSchema = z.object({
  keywordsFromJD: z.array(z.string()).describe("Key skills, technologies, or qualifications extracted from the job description."),
  missingKeywordsInResume: z.array(z.string()).describe("Important keywords/skills from the JD that seem to be missing or underrepresented in the resume."),
  relevantExperiencesToHighlight: z.array(z.string()).describe("Specific experiences or sections from the resume that should be emphasized or elaborated on for this particular job description."),
  suggestionsForTailoring: z.array(z.string()).describe("Actionable suggestions on how to tailor the resume content (e.g., rephrasing bullet points using JD language, adding specific metrics relevant to JD requirements, reordering sections)."),
  overallFitAssessment: z.string().describe("A brief assessment (2-3 sentences) of how well the current resume aligns with the job description and overarching suggestions for improving this alignment."),
});
export type TailorResumeForJDOutput = z.infer<typeof TailorResumeForJDOutputSchema>;

export async function tailorResumeForJD(
  input: TailorResumeForJDInput,
  options?: { apiKey?: string }
): Promise<TailorResumeForJDOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'tailorResumeForJD';

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
    const RAW_TAILOR_PROMPT = loadPromptFile("tailor-resume-for-jd.prompt");
    if (!RAW_TAILOR_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load tailor-resume-for-jd.prompt. Falling back to error response.`);
      return {
        keywordsFromJD: ["Error: Could not load prompt file."],
        missingKeywordsInResume: ["Error: Could not load prompt file."],
        relevantExperiencesToHighlight: ["Error: Could not load prompt file."],
        suggestionsForTailoring: ["Error: Could not load prompt file."],
        overallFitAssessment: "An error occurred while preparing tailoring advice due to a missing prompt file. Please contact support.",
      };
    }
    const renderedPrompt = renderPromptTemplate(RAW_TAILOR_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof TailorResumeForJDOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: TailorResumeForJDOutputSchema },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output; 
    if (!output) {
      console.error(`[${flowNameForLogging}] AI did not return tailoring suggestions or failed to parse.`);
      return {
        keywordsFromJD: ["Error: AI returned no data."],
        missingKeywordsInResume: ["Error: AI returned no data."],
        relevantExperiencesToHighlight: ["Error: AI returned no data."],
        suggestionsForTailoring: ["Error: AI returned no data."],
        overallFitAssessment: "AI service did not return valid tailoring advice. Please try again.",
      };
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    return {
      keywordsFromJD: ["Error: Could not extract keywords due to an exception."],
      missingKeywordsInResume: ["Error: Could not analyze missing keywords due to an exception."],
      relevantExperiencesToHighlight: ["Error: Could not identify experiences due to an exception."],
      suggestionsForTailoring: ["Error: Could not generate tailoring suggestions due to an exception."],
      overallFitAssessment: `An error occurred while generating resume tailoring advice: ${(error as Error).message}. Please try again.`,
    };
  }
}
