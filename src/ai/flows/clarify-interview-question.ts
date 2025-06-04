'use server';
/**
 * @fileOverview A Genkit flow to provide clarification on the current interview question itself.
 *
 * - clarifyInterviewQuestion - A function that provides clarification on an interview question.
 * - ClarifyInterviewQuestionInput - The input type for the function.
 * - ClarifyInterviewQuestionOutput - The return type for the function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import type { InterviewSetupData } from '@/lib/types'; 
import { INTERVIEWER_PERSONAS } from '@/lib/constants';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

// Extended type for interview context that includes previousConversation
type InterviewContextWithConversation = InterviewSetupData & {
  previousConversation?: string;
};

const ClarifyInterviewQuestionInputSchema = z.object({
  interviewQuestionText: z.string().describe("The original interview question posed by the AI that the user wants clarification on."),
  userClarificationRequest: z.string().describe("The user's specific question asking for clarification about the AI's interview question."),
  interviewContext: z.custom<InterviewContextWithConversation>().describe("The overall context of the interview (type, level, focus, persona, etc.)."),
});
export type ClarifyInterviewQuestionInput = z.infer<typeof ClarifyInterviewQuestionInputSchema>;

const ClarifyInterviewQuestionOutputSchema = z.object({
  clarificationText: z.string().describe('A concise and helpful clarification in response to the user\'s request, delivered in the AI\'s current interviewer persona.'),
});
export type ClarifyInterviewQuestionOutput = z.infer<typeof ClarifyInterviewQuestionOutputSchema>;

const RAW_CLARIFY_INTERVIEW_QUESTION_PROMPT = loadPromptFile("clarify-interview-question.prompt");

export async function clarifyInterviewQuestion(
  input: ClarifyInterviewQuestionInput,
  options?: { apiKey?: string }
): Promise<ClarifyInterviewQuestionOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'clarifyInterviewQuestion';

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No user API key provided; using default global AI instance.`);
  }

  const saneInput = {
    ...input,
    interviewContext: {
      ...input.interviewContext,
      interviewerPersona: input.interviewContext.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    }
  };

  try {
    const renderedPrompt = renderPromptTemplate(RAW_CLARIFY_INTERVIEW_QUESTION_PROMPT, saneInput);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);
    
    const result = await activeAI.generate<typeof ClarifyInterviewQuestionOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: ClarifyInterviewQuestionOutputSchema },
        config: { responseMimeType: "application/json" },
    });
    const output = result.output;

    if (!output || !output.clarificationText) {
        console.warn(`[BYOK] ${flowNameForLogging}: AI output was null or clarificationText was missing.`);
        return { clarificationText: "Sorry, I couldn't generate a clarification for that at the moment. Please try rephrasing your request or proceed with your best understanding of the question." };
    }
    return output;
  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging}:`, error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error.";
    return { clarificationText: `Clarification Error: ${errorMsg}` };
  }
}
