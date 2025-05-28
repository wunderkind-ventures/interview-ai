
// SummarizeResume flow
'use server';
/**
 * @fileOverview This file defines a Genkit flow to summarize a resume.
 *
 * - summarizeResume - A function that takes a resume as input and returns a summary.
 * - SummarizeResumeInput - The input type for the summarizeResume function, which is the resume content.
 * - SummarizeResumeOutput - The return type for the summarizeResume function, which is the resume summary.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeResumeInputSchemaInternal = z.object({
  resume: z.string().describe('The resume content to summarize.'),
});
export type SummarizeResumeInput = z.infer<typeof SummarizeResumeInputSchemaInternal>;

const SummarizeResumeOutputSchemaInternal = z.object({
  summary: z.string().describe('A summary of the resume.'),
});
export type SummarizeResumeOutput = z.infer<typeof SummarizeResumeOutputSchemaInternal>;

const summarizeResumePromptObj = globalAi.definePrompt({
  name: 'summarizeResumePrompt',
  input: {schema: SummarizeResumeInputSchemaInternal},
  output: {schema: SummarizeResumeOutputSchemaInternal},
  prompt: `Summarize the following resume. Focus on key accomplishments and skills.

Resume:
{{{resume}}}`,
});

export async function summarizeResume(
  input: SummarizeResumeInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<SummarizeResumeOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'summarizeResume';

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
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const {output} = await activeAI.run(summarizeResumePromptObj, input);
    if (!output) {
      throw new Error('AI did not return resume summary.');
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    throw error;
  }
}

    