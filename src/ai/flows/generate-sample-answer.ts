'use server';
/**
 * @fileOverview A Genkit flow to generate a sample answer for a given interview question.
 *
 * - generateSampleAnswer - A function that provides a sample answer.
 * - GenerateSampleAnswerInput - The input type for the generateSampleAnswer function.
 * - GenerateSampleAnswerOutput - The return type for the generateSampleAnswer function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const GenerateSampleAnswerInputSchemaInternal = z.object({
  questionText: z.string().describe('The text of the interview question.'),
  interviewType: z.string().describe('The overall type of the interview (e.g., "product sense", "behavioral").'),
  faangLevel: z.string().describe('The target FAANG complexity level for the answer.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills the question may be targeting.'),
  idealAnswerCharacteristics: z.array(z.string()).optional().describe("Pre-defined ideal characteristics of a strong answer to this question, to guide the sample answer generation."),
});
export type GenerateSampleAnswerInput = z.infer<typeof GenerateSampleAnswerInputSchemaInternal>;

const GenerateSampleAnswerOutputSchemaInternal = z.object({
  sampleAnswerText: z.string().describe('A well-structured, ideal sample answer to the question.'),
});
export type GenerateSampleAnswerOutput = z.infer<typeof GenerateSampleAnswerOutputSchemaInternal>;

const RAW_SAMPLE_ANSWER_PROMPT = loadPromptFile("generate-sample-answer.prompt");

export async function generateSampleAnswer(
  input: GenerateSampleAnswerInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<GenerateSampleAnswerOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'generateSampleAnswer';

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
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }
  
  try {
    const renderedPrompt = renderPromptTemplate(RAW_SAMPLE_ANSWER_PROMPT, input);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);
    
    const result = await activeAI.generate<typeof GenerateSampleAnswerOutputSchemaInternal>({
      prompt: renderedPrompt,
      model: googleAI.model('gemini-1.5-flash-latest'),
      output: { schema: GenerateSampleAnswerOutputSchemaInternal },
      config: { responseMimeType: "application/json" },
    });
    
    const output = result.output;
    
    if (!output || !output.sampleAnswerText) {
        console.warn(`[BYOK] ${flowNameForLogging}: AI output was null or sampleAnswerText was missing. Question: "${input.questionText}"`);
        return { sampleAnswerText: `Sorry, I couldn't generate a sample answer for the question: "${input.questionText}" at this moment. Consider the key concepts and try to structure your response logically.` };
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { 
      sampleAnswerText: `Unable to generate sample answer due to an error: ${errorMsg}. Please try again later.` 
    };
  }
}

    