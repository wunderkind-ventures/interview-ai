'use server';
/**
 * @fileOverview A Genkit flow to provide clarification on a specific piece of interview feedback.
 *
 * - clarifyFeedback - A function that provides clarification on feedback.
 * - ClarifyFeedbackInput - The input type for the clarifyFeedback function.
 * - ClarifyFeedbackOutput - The return type for the clarifyFeedback function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const InterviewContextSchema = z.object({ // Not exported
  interviewType: z.string(),
  faangLevel: z.string(),
  jobTitle: z.string().optional(),
  interviewFocus: z.string().optional(),
});

const ClarifyFeedbackInputSchema = z.object({ // Not exported
  originalQuestionText: z.string().describe("The original interview question text."),
  userAnswerText: z.string().describe("The user's answer to the original question."),
  feedbackItemText: z.string().describe("The specific piece of feedback (e.g., an area for improvement or a suggestion) that the user wants clarification on."),
  userClarificationRequest: z.string().describe("The user's question asking for clarification on the feedbackItemText."),
  interviewContext: InterviewContextSchema.describe("The overall context of the interview."),
});
export type ClarifyFeedbackInput = z.infer<typeof ClarifyFeedbackInputSchema>;

const ClarifyFeedbackOutputSchema = z.object({ // Not exported
  clarificationText: z.string().describe('A concise and helpful clarification in response to the user\'s request about the specific feedback item.'),
});
export type ClarifyFeedbackOutput = z.infer<typeof ClarifyFeedbackOutputSchema>;

export async function clarifyFeedback(
  input: ClarifyFeedbackInput,
  options?: { apiKey?: string }
): Promise<ClarifyFeedbackOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'clarifyFeedback';

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
    const RAW_CLARIFY_PROMPT = loadPromptFile("clarify-feedback.prompt");
    if (!RAW_CLARIFY_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load clarify-feedback.prompt. Falling back to error response.`);
      return { clarificationText: "Sorry, I couldn't load the clarification template at this moment. Please try rephrasing or contact support." };
    }
    const renderedPrompt = renderPromptTemplate(RAW_CLARIFY_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof ClarifyFeedbackOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: ClarifyFeedbackOutputSchema },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output;
    if (!output || !output.clarificationText) {
        console.warn(`[${flowNameForLogging}] AI returned no clarification or it was empty. Using fallback.`);
        return { clarificationText: "Sorry, I couldn't generate a clarification for that at the moment. Please try rephrasing your request or ensure all context is clear." };
    }
    return output;
  } catch (error) {
    console.error(`[${flowNameForLogging}] Error generating clarification:`, error);
    return { clarificationText: `Sorry, an error occurred while generating a clarification. Please try again.` };
  }
}
