
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

const analyzeResumeStandalonePromptObj = globalAi.definePrompt({
  name: 'analyzeResumeStandalonePrompt',
  input: { schema: AnalyzeResumeStandaloneInputSchema },
  output: { schema: AnalyzeResumeStandaloneOutputSchema },
  prompt: `You are an expert resume reviewer and career coach.
Analyze the following resume text thoroughly. Provide constructive feedback focusing on its strengths, areas for improvement, overall clarity, impact, and actionable suggestions.

Resume Text:
{{{resumeText}}}

Your analysis should include:
1.  **Strengths**: Identify 2-4 key strengths of the resume (e.g., well-quantified achievements, clear structure, strong action verbs).
2.  **Areas for Improvement**: Pinpoint 2-4 specific areas that could be enhanced (e.g., vague descriptions, lack of metrics, inconsistent formatting, passive language).
3.  **Clarity Score (1-5)**: Rate the resume's clarity and readability (1=Very Unclear, 5=Very Clear). Briefly justify.
4.  **Impact Score (1-5)**: Assess how well the resume conveys impact and achievements (1=Low Impact, 5=High Impact). Briefly justify.
5.  **Overall Feedback**: Provide a concise (2-3 sentences) overall assessment of the resume's current effectiveness.
6.  **Actionable Suggestions**: Offer 2-4 specific, actionable pieces of advice the user can implement to improve their resume.

Ensure your feedback is professional, supportive, and directly addresses the content of the resume provided.
Focus on content, structure, and impact. Avoid commenting on minor typos unless they significantly hinder readability.
`,
});

export async function analyzeResumeStandalone(
  input: AnalyzeResumeStandaloneInput,
  options?: { apiKey?: string }
): Promise<AnalyzeResumeStandaloneOutput> {
  let activeAI = globalAi;
  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        model: globalAi.getModel().name,
      });
      console.log("[BYOK] analyzeResumeStandalone: Using user-provided API key.");
    } catch (e) {
      console.warn(`[BYOK] analyzeResumeStandalone: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log("[BYOK] analyzeResumeStandalone: No user API key provided; using default global AI instance.");
  }

  try {
    const { output } = await activeAI.run(analyzeResumeStandalonePromptObj, input);
    if (!output) {
      throw new Error('AI did not return resume analysis.');
    }
    return output;
  } catch (error) {
    console.error("Error in analyzeResumeStandaloneFlow:", error);
    return {
      strengths: ["Error: Could not analyze strengths."],
      areasForImprovement: ["Error: Could not analyze areas for improvement."],
      clarityScore: 1,
      impactScore: 1,
      overallFeedback: "An error occurred while analyzing the resume. Please try again. If the problem persists, the resume text might be too complex or the AI model is temporarily unavailable.",
      actionableSuggestions: ["Error: Could not generate suggestions."],
    };
  }
}
