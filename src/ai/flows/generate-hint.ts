'use server';
/**
 * @fileOverview A Genkit flow to generate a hint for the current interview question.
 *
 * - generateHint - A function that provides a hint for a given question and context.
 * - GenerateHintInput - The input type for the generateHint function.
 * - GenerateHintOutput - The return type for the generateHint function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const GenerateHintInputSchemaInternal = z.object({
  questionText: z.string().describe('The text of the current interview question for which a hint is requested.'),
  interviewType: z.string().describe('The type of the interview (e.g., "product sense", "technical system design").'),
  faangLevel: z.string().describe('The target FAANG level for the interview, to calibrate the hint difficulty.'),
  userAnswerAttempt: z.string().optional().describe('Any partial answer the user has typed so far. This can help tailor the hint.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if any.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills being targeted, if any.'),
});
export type GenerateHintInput = z.infer<typeof GenerateHintInputSchemaInternal>;

const GenerateHintOutputSchemaInternal = z.object({
  hintText: z.string().describe('A subtle hint or guiding question to help the user proceed with their answer.'),
});
export type GenerateHintOutput = z.infer<typeof GenerateHintOutputSchemaInternal>;

const RAW_GENERATE_HINT_PROMPT_TEMPLATE = loadPromptFile("generate-hint.prompt");

// definePrompt can still be useful for organizing/validating schemas, even if not using run() by name directly in this flow
// Note: The 'prompt' field here now holds the raw template string. 
// The actual rendering will happen dynamically within the generateHint function.
const generateHintPromptObj = globalAi.definePrompt({
  name: 'generateHintPrompt',
  input: {schema: GenerateHintInputSchemaInternal},
  output: {schema: GenerateHintOutputSchemaInternal},
  prompt: RAW_GENERATE_HINT_PROMPT_TEMPLATE, 
});

export async function generateHint(
  input: GenerateHintInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<GenerateHintOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'generateHint';

  if (options?.aiInstance) {
    activeAI = options.aiInstance;
    console.log(`[BYOK] ${flowNameForLogging}: Using provided aiInstance.`);
  } else if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back to global AI.`);
      activeAI = globalAi;
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const renderedPrompt = renderPromptTemplate(RAW_GENERATE_HINT_PROMPT_TEMPLATE, input);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);
    console.log('[BYOK] generateHint input:', JSON.stringify(input, null, 2));
    
    const generateResult = await activeAI.generate<typeof GenerateHintOutputSchemaInternal>({
      prompt: renderedPrompt,
      model: googleAI.model('gemini-1.5-flash-latest'),
      output: { schema: GenerateHintOutputSchemaInternal },
      config: { responseMimeType: "application/json" },
    });
    
    const output = generateResult.output;

    if (!output || !output.hintText) {
        console.log('[BYOK] generateHint: Output was null or hintText missing, using fallback.');
        let fallback = "Consider breaking the problem down into smaller pieces. What's the core challenge?";
        if (input.interviewType === "behavioral") {
            fallback = "Think about a specific past experience that illustrates this. How can you structure your story clearly?";
        } else if (input.interviewType === "data structures & algorithms") {
            fallback = "What are the inputs and expected outputs? Are there any constraints or edge cases to consider first?";
        }
        return { hintText: fallback };
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    if (error instanceof Error) {
        throw new Error(`Hint generation failed: ${error.message}`);
    }
    throw new Error('Hint generation failed due to an unknown error.');
  }
}

    