'use server';
/**
 * @fileOverview A Genkit flow to explain a given term or concept.
 *
 * - explainConcept - A function that provides an explanation for a term.
 * - ExplainConceptInput - The input type for the explainConcept function.
 * - ExplainConceptOutput - The return type for the explainConcept function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit'; // Renamed global import
import { z } from 'genkit'; // Use z from genkit
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils'; // Added import

const ExplainConceptInputSchema = z.object({
  term: z.string().describe('The term or concept to be explained.'),
  interviewContext: z.string().optional().describe('Optional context of the interview (e.g., "technical system design", "product sense") to tailor the explanation if relevant.'),
});
export type ExplainConceptInput = z.infer<typeof ExplainConceptInputSchema>;

const ExplainConceptOutputSchema = z.object({
  explanation: z.string().describe('A concise and clear explanation of the term or concept.'),
});
export type ExplainConceptOutput = z.infer<typeof ExplainConceptOutputSchema>;

// Define the prompt with the global AI instance so it's registered

export async function explainConcept(
  input: ExplainConceptInput,
  options?: { apiKey?: string }
): Promise<ExplainConceptOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'explainConcept'; // Added for logging

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        // model: globalAi.getModel().name, // Model to be specified in generate call
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with user-provided API key: ${(e as Error).message}. Falling back to default.`);
      activeAI = globalAi; // Fallback to globalAi
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No user API key provided; using default global AI instance.`);
  }

  try {
    const RAW_EXPLAIN_PROMPT = loadPromptFile("explain-concept.prompt");
    if (!RAW_EXPLAIN_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load explain-concept.prompt. Falling back to error response.`);
      return { explanation: `Sorry, I couldn't load the explanation template for "${input.term}" at this moment.` };
    }
    const renderedPrompt = renderPromptTemplate(RAW_EXPLAIN_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof ExplainConceptOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: ExplainConceptOutputSchema },
        config: { responseMimeType: "application/json" },
      });
    
    const output = result.output;
    if (!output || !output.explanation) {
        console.warn(`[${flowNameForLogging}] AI returned no explanation or it was empty for term "${input.term}". Using fallback.`);
        return { explanation: `Sorry, I couldn't generate an explanation for "${input.term}" at this moment.` };
    }
    return output;
  } catch (error) {
    console.error(`[${flowNameForLogging}] Error generating explanation for "${input.term}":`, error);
    return { explanation: `Sorry, an error occurred while generating an explanation for "${input.term}".` };
  }
}
