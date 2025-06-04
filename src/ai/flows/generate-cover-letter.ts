'use server';
/**
 * @fileOverview Generates a draft cover letter based on job description, resume, achievements, and user notes.
 *
 * - generateCoverLetter - A function that generates a cover letter.
 * - GenerateCoverLetterInput - The input type for the function.
 * - GenerateCoverLetterOutput - The return type for the function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import { z } from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const GenerateCoverLetterInputSchema = z.object({
  jobDescriptionText: z.string().min(50, "Job description must be at least 50 characters."),
  resumeText: z.string().min(100, "Resume text must be at least 100 characters."),
  achievementsText: z.string().optional().describe("User-provided text summarizing key achievements relevant to the job. Can be bullet points or short paragraphs."),
  userNotes: z.string().optional().describe("Specific points or instructions the user wants to include or emphasize in the cover letter."),
  companyName: z.string().min(1, "Company name is required."),
  hiringManagerName: z.string().optional().describe("Name of the hiring manager, if known."),
  tone: z.enum(["professional", "enthusiastic", "formal", "slightly-informal"]).default("professional").describe("The desired tone of the cover letter."),
});
export type GenerateCoverLetterInput = z.infer<typeof GenerateCoverLetterInputSchema>;

const GenerateCoverLetterOutputSchema = z.object({
  coverLetterDraft: z.string().describe("The generated draft of the cover letter."),
});
export type GenerateCoverLetterOutput = z.infer<typeof GenerateCoverLetterOutputSchema>;

export async function generateCoverLetter(
  input: GenerateCoverLetterInput,
  options?: { apiKey?: string }
): Promise<GenerateCoverLetterOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'generateCoverLetter';

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
    const RAW_COVER_LETTER_PROMPT = loadPromptFile("generate-cover-letter.prompt");
    if (!RAW_COVER_LETTER_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load generate-cover-letter.prompt. Falling back to error response.`);
      const errorMessage = "Could not load the prompt template file.";
      return {
        coverLetterDraft: `Error: Could not generate cover letter. ${errorMessage}\nPlease ensure all required fields are sufficiently detailed and try again.`,
      };
    }
    const renderedPrompt = renderPromptTemplate(RAW_COVER_LETTER_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof GenerateCoverLetterOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: GenerateCoverLetterOutputSchema },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output;
    if (!output || !output.coverLetterDraft) {
      console.error(`[${flowNameForLogging}] AI did not return a cover letter draft or it was empty.`);
      throw new Error('AI did not return a cover letter draft.');
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      coverLetterDraft: `Error: Could not generate cover letter. ${errorMessage}\nPlease ensure all required fields are sufficiently detailed and try again.`,
    };
  }
}
