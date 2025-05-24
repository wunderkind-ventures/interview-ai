
'use server';
/**
 * @fileOverview Generates a draft cover letter based on job description, resume, achievements, and user notes.
 *
 * - generateCoverLetter - A function that generates a cover letter.
 * - GenerateCoverLetterInput - The input type for the function.
 * - GenerateCoverLetterOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  input: GenerateCoverLetterInput
): Promise<GenerateCoverLetterOutput> {
  return generateCoverLetterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCoverLetterPrompt',
  input: { schema: GenerateCoverLetterInputSchema },
  output: { schema: GenerateCoverLetterOutputSchema },
  prompt: `You are an expert Career Coach and Professional Writer, specializing in crafting compelling cover letters.
A user wants you to generate a draft cover letter.

Your task is to synthesize the provided information into a professional, persuasive, and well-structured cover letter.

**Key Information Provided:**

1.  **Company Name:** {{{companyName}}}
2.  **Job Description:**
    {{{jobDescriptionText}}}
3.  **Candidate's Resume:**
    {{{resumeText}}}
{{#if achievementsText}}
4.  **Key Achievements to Highlight (from user):**
    {{{achievementsText}}}
{{/if}}
{{#if userNotes}}
5.  **Specific User Notes/Instructions:**
    {{{userNotes}}}
{{/if}}
{{#if hiringManagerName}}
6.  **Hiring Manager Name:** {{{hiringManagerName}}}
{{/if}}
7.  **Desired Tone:** {{{tone}}}

**Cover Letter Structure & Content Guidelines:**

*   **Salutation:**
    *   If 'hiringManagerName' is provided, address it to them (e.g., "Dear Mr./Ms. [Last Name]," or "Dear [Full Name]," if appropriate for the tone).
    *   Otherwise, use a general professional salutation (e.g., "Dear Hiring Manager," or "Dear [Company Name] Team,").
*   **Introduction (First Paragraph):**
    *   Clearly state the position being applied for (as mentioned in the job description).
    *   Briefly mention where the candidate saw the advertisement (if inferable, or a generic placeholder).
    *   Express strong interest in the role and the company.
*   **Body Paragraphs (2-3 paragraphs):**
    *   **Connect to JD:** For each key requirement or responsibility in the 'jobDescriptionText', identify relevant skills, experiences, or qualifications from the 'resumeText' and 'achievementsText'.
    *   **Showcase Achievements:** Weave in the 'achievementsText' effectively. If they are in STAR format, try to summarize the impact. Quantifiable results are powerful.
    *   **Highlight Fit:** Explain *how* the candidate's background makes them a strong fit for the role and the company.
    *   **Incorporate User Notes:** Address any specific points from 'userNotes'.
    *   **Maintain Tone:** Ensure the language aligns with the desired 'tone'.
*   **Company Alignment (Optional but good if inferable):**
    *   Briefly mention why the candidate is interested in '{{{companyName}}}' specifically (e.g., its mission, products, culture, if this can be subtly inferred or is hinted at in the JD or user notes).
*   **Closing Paragraph:**
    *   Reiterate enthusiasm for the opportunity.
    *   Briefly mention availability or eagerness to discuss further.
    *   Include a professional call to action (e.g., looking forward to hearing from them).
*   **Sign-off:**
    *   Use a professional closing (e.g., "Sincerely," "Regards,").
    *   Leave space for the candidate's name (you don't need to invent one).

**Important Considerations:**
*   **Conciseness:** Aim for a cover letter that is typically 3-4 paragraphs long (plus salutation and closing), not exceeding one page.
*   **Professionalism:** Even for a 'slightly-informal' tone, maintain overall professionalism.
*   **Originality:** Do not just copy phrases from the resume or JD. Synthesize and rephrase.
*   **Focus on Value:** Emphasize the value the candidate can bring to the company.

Generate the 'coverLetterDraft'.
`,
});

const generateCoverLetterFlow = ai.defineFlow(
  {
    name: 'generateCoverLetterFlow',
    inputSchema: GenerateCoverLetterInputSchema,
    outputSchema: GenerateCoverLetterOutputSchema,
  },
  async (input: GenerateCoverLetterInput) => {
    try {
      const { output } = await prompt(input);
      if (!output || !output.coverLetterDraft) {
        throw new Error('AI did not return a cover letter draft.');
      }
      return output;
    } catch (error) {
      console.error("Error in generateCoverLetterFlow:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      return {
        coverLetterDraft: `Error: Could not generate cover letter. ${errorMessage}\nPlease ensure all required fields are sufficiently detailed and try again.`,
      };
    }
  }
);

    