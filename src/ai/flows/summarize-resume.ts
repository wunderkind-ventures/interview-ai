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
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const SummarizeResumeInputSchemaInternal = z.object({
  resume: z.string().describe('The resume content to summarize.'),
});
export type SummarizeResumeInput = z.infer<typeof SummarizeResumeInputSchemaInternal>;

const SummarizeResumeOutputSchemaInternal = z.object({
  summary: z.string().describe('A summary of the resume.'),
});
export type SummarizeResumeOutput = z.infer<typeof SummarizeResumeOutputSchemaInternal>;

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
        // model: globalAi.getModel().name, // Model to be specified in generate call
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
      activeAI = globalAi; // Fallback to globalAI
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const RAW_SUMMARIZE_PROMPT = loadPromptFile("summarize-resume.prompt");
    if (!RAW_SUMMARIZE_PROMPT) {
      // Consider a more specific error or fallback for this critical failure
      throw new Error('Critical: Could not load summarize-resume.prompt'); 
    }
    const renderedPrompt = renderPromptTemplate(RAW_SUMMARIZE_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof SummarizeResumeOutputSchemaInternal>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'), // Specify model, or use activeAI.getModel() if available and configured for the instance
        output: { schema: SummarizeResumeOutputSchemaInternal },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output;
    if (!output) {
      // This path might indicate an issue with the AI service or the response structure not matching the schema
      console.error('[${flowNameForLogging}] AI did not return a valid summary or failed to parse.');
      throw new Error('AI did not return resume summary.');
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    throw error;
  }
}

    