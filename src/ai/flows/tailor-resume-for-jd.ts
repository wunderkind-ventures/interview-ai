
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

const tailorResumeForJDPromptObj = globalAi.definePrompt({
  name: 'tailorResumeForJDPrompt',
  input: { schema: TailorResumeForJDInputSchema },
  output: { schema: TailorResumeForJDOutputSchema },
  prompt: `You are an expert career coach specializing in resume optimization and job application strategy.
A user has provided their resume and a job description. Your task is to provide specific, actionable advice on how to tailor their resume to this job description.

Job Description:
{{{jobDescriptionText}}}

User's Resume:
{{{resumeText}}}

Please provide the following:
1.  **Keywords from JD**: List 5-7 key skills, technologies, or qualifications explicitly mentioned or strongly implied in the job description.
2.  **Missing Keywords in Resume**: Identify 2-4 important keywords/skills from the JD that appear to be missing or significantly underrepresented in the provided resume.
3.  **Relevant Experiences to Highlight**: Point out 2-3 specific experiences, projects, or sections from the user's resume that are particularly relevant to this job description and should be emphasized or elaborated upon.
4.  **Suggestions for Tailoring**: Offer 3-5 concrete, actionable suggestions for how the user can tailor their resume. Examples:
    *   "Rephrase the bullet point under 'Project X' to highlight its relevance to [JD Requirement Y] by mentioning [Specific Detail/Metric]."
    *   "Consider adding a brief summary statement at the top that directly addresses your experience with [Key Technology from JD]."
    *   "Quantify your achievement in 'Role Z' using metrics that align with the impact sought in the JD (e.g., 'improved efficiency by X%')."
5.  **Overall Fit Assessment**: Provide a brief (2-3 sentences) assessment of how well the current resume aligns with the job description and general advice to improve this alignment.

Focus on providing practical, targeted advice. Avoid generic suggestions.
`,
});

export async function tailorResumeForJD(
  input: TailorResumeForJDInput,
  options?: { apiKey?: string }
): Promise<TailorResumeForJDOutput> {
  let activeAI = globalAi;
  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        model: globalAi.getModel().name,
      });
      console.log("[BYOK] tailorResumeForJD: Using user-provided API key.");
    } catch (e) {
      console.warn(`[BYOK] tailorResumeForJD: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log("[BYOK] tailorResumeForJD: No user API key provided; using default global AI instance.");
  }
  
  try {
    const { output } = await activeAI.run(tailorResumeForJDPromptObj, input);
    if (!output) {
      throw new Error('AI did not return resume tailoring suggestions.');
    }
    return output;
  } catch (error) {
    console.error("Error in tailorResumeForJDFlow:", error);
    return {
      keywordsFromJD: ["Error: Could not extract keywords."],
      missingKeywordsInResume: ["Error: Could not analyze missing keywords."],
      relevantExperiencesToHighlight: ["Error: Could not identify experiences."],
      suggestionsForTailoring: ["Error: Could not generate tailoring suggestions."],
      overallFitAssessment: "An error occurred while generating resume tailoring advice. Please try again. Ensure both resume and job description are sufficiently detailed.",
    };
  }
}
