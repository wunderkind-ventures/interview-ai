// SummarizeResume flow
'use server';
/**
 * @fileOverview This file defines a Genkit flow to summarize a resume.
 *
 * - summarizeResume - A function that takes a resume as input and returns a summary.
 * - SummarizeResumeInput - The input type for the summarizeResume function, which is the resume content.
 * - SummarizeResumeOutput - The return type for the summarizeResume function, which is the resume summary.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeResumeInputSchema = z.object({
  resume: z.string().describe('The resume content to summarize.'),
});
export type SummarizeResumeInput = z.infer<typeof SummarizeResumeInputSchema>;

const SummarizeResumeOutputSchema = z.object({
  summary: z.string().describe('A summary of the resume.'),
});
export type SummarizeResumeOutput = z.infer<typeof SummarizeResumeOutputSchema>;

export async function summarizeResume(input: SummarizeResumeInput): Promise<SummarizeResumeOutput> {
  return summarizeResumeFlow(input);
}

const summarizeResumePrompt = ai.definePrompt({
  name: 'summarizeResumePrompt',
  input: {schema: SummarizeResumeInputSchema},
  output: {schema: SummarizeResumeOutputSchema},
  prompt: `Summarize the following resume. Focus on key accomplishments and skills.

Resume:
{{{resume}}}`,
});

const summarizeResumeFlow = ai.defineFlow(
  {
    name: 'summarizeResumeFlow',
    inputSchema: SummarizeResumeInputSchema,
    outputSchema: SummarizeResumeOutputSchema,
  },
  async input => {
    const {output} = await summarizeResumePrompt(input);
    return output!;
  }
);
