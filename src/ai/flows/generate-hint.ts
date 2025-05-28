
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

const generateHintPromptObj = globalAi.definePrompt({
  name: 'generateHintPrompt',
  input: {schema: GenerateHintInputSchemaInternal},
  output: {schema: GenerateHintOutputSchemaInternal},
  prompt: `You are an expert Interview Coach AI. A user is stuck on the following interview question and needs a hint.
Provide a subtle hint, a guiding question, or suggest an area to focus on.
The hint should help them think in the right direction without giving away the answer or being too obvious.
Tailor the hint based on the interview type, FAANG level, the question itself, and any partial answer they've provided.

Interview Type: {{{interviewType}}}
FAANG Level: {{{faangLevel}}}
{{#if interviewFocus}}Specific Interview Focus: {{{interviewFocus}}}{{/if}}
{{#if targetedSkills.length}}Targeted Skills: {{#each targetedSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}

Question:
"{{{questionText}}}"

{{#if userAnswerAttempt}}
User's current answer attempt (if any):
"{{{userAnswerAttempt}}}"
{{/if}}

Generate a concise hint (1-2 sentences).

Examples of good hints:
- For a system design question: "Consider how you would handle a large number of concurrent users." or "What are the primary components you'd need to consider for this system?"
- For a product sense question: "What user problem are you primarily trying to solve here?" or "How would you measure the success of this feature?"
- For a behavioral question: "Try to structure your answer using a common framework like STAR."
- For a DSA question: "Think about what data structure would be most efficient for lookups in this scenario." or "Have you considered edge cases like an empty input?"

Do not provide a direct answer or a solution. The goal is to nudge their thinking.
`,
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
    const {output} = await activeAI.run(generateHintPromptObj, input);
    if (!output || !output.hintText) {
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
    throw error;
  }
}

    