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


const ClarifyInterviewQuestionInputSchema = z.object({
  interviewQuestionText: z.string().describe("The original interview question posed by the AI that the user wants clarification on."),
  userClarificationRequest: z.string().describe("The user's specific question asking for clarification about the AI's interview question."),
  interviewContext: z.custom<InterviewSetupData>().describe("The overall context of the interview (type, level, focus, persona, etc.)."),
});
export type ClarifyInterviewQuestionInput = z.infer<typeof ClarifyInterviewQuestionInputSchema>;

const ClarifyInterviewQuestionOutputSchema = z.object({
  clarificationText: z.string().describe('A concise and helpful clarification in response to the user\'s request, delivered in the AI\'s current interviewer persona.'),
});
export type ClarifyInterviewQuestionOutput = z.infer<typeof ClarifyInterviewQuestionOutputSchema>;

const CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE = `You are an AI Interviewer currently embodying the persona of: '{{{interviewContext.interviewerPersona}}}'.
Your current interview type is '{{{interviewContext.interviewType}}}' at '{{{interviewContext.faangLevel}}}' level.
{{#if interviewContext.interviewFocus}}The specific focus is '{{{interviewContext.interviewFocus}}}'.{{/if}}

{{#if interviewContext.previousConversation}}
Briefly review the conversation history if the candidate\'s request seems to reference earlier parts of the dialogue:
Previous Conversation Snippets:
{{{interviewContext.previousConversation}}} 
---
{{/if}}

The interview question you (as the AI Interviewer) asked was:
"{{{interviewQuestionText}}}"

The candidate is asking for clarification on THIS question. Their clarification request is:
"{{{userClarificationRequest}}}"

Your Task:
Provide a helpful and concise clarification.
- Directly address the candidate's specific point of confusion from their 'userClarificationRequest'.
- If the candidate is asking for factual context about the hypothetical scenario that was not previously provided (e.g., "What are the company's OKRs?", "What's the team size?"), and this information is not something they are expected to invent or assume, you MAY provide a brief, reasonable piece of information. Invent plausible details if necessary. Example: If asked for OKRs, you could say, "Assume a key OKR is to increase user engagement by 15% this quarter." State that you are providing this as assumed context.
- Maintain your '{{{interviewContext.interviewerPersona}}}' persona in your response. For example:
    - A 'friendly_peer' might say: "Good question! What I mean by that is..." or "Good clarifying question! For context, let's assume the company's main OKR is to grow active users by 20% this quarter."
    - A 'skeptical_hiring_manager' might say: "The question is straightforward. However, to clarify, consider..." or "While you should be comfortable making reasonable assumptions, for this discussion, assume the primary OKR is X."
    - A 'time_pressed_technical_lead' might give a very direct clarification.
    - An 'antagonistic_challenger' might rephrase slightly but still maintain a challenging tone, e.g., "If you're asking whether X is in scope, I expect you to make a reasonable assumption and state it. But to be clear, consider Y."
    - An 'apathetic_business_lead' might give a minimal clarification, e.g., "Focus on the core business problem."
- Do NOT give away the answer to the original 'interviewQuestionText'.
- Do NOT solve the problem for them.
- Your clarification should help them understand the question better so they can proceed.
- Aim for 1-3 sentences.

Begin your clarification directly.
`;

const clarifyInterviewQuestionPromptObj = globalAi.definePrompt({
  name: 'clarifyInterviewQuestionPrompt',
  input: {schema: ClarifyInterviewQuestionInputSchema},
  output: {schema: ClarifyInterviewQuestionOutputSchema},
  prompt: CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE,
});

export async function clarifyInterviewQuestion(
  input: ClarifyInterviewQuestionInput,
  options?: { apiKey?: string }
): Promise<ClarifyInterviewQuestionOutput> {
  let activeAI = globalAi;
  let isByokPath = false;

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        // No model here, it will be specified in generate/run call
      });
      isByokPath = true;
      console.log("[BYOK] clarifyInterviewQuestion: Using user-provided API key.");
    } catch (e) {
      console.warn(`[BYOK] clarifyInterviewQuestion: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
      // activeAI remains globalAI
    }
  } else {
    console.log("[BYOK] clarifyInterviewQuestion: No user API key provided; using default global AI instance.");
  }

  const saneInput = {
    ...input,
    interviewContext: {
      ...input.interviewContext,
      interviewerPersona: input.interviewContext.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    }
  };

  try {
    let output: ClarifyInterviewQuestionOutput | null | undefined;
    if (isByokPath) {
      console.log("[BYOK] clarifyInterviewQuestion: Using userKit.generate()");
      const result = await activeAI.generate<typeof ClarifyInterviewQuestionOutputSchema>({
        prompt: CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE,
        context: saneInput,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: ClarifyInterviewQuestionOutputSchema },
        config: { responseMimeType: "application/json" },
        // tools: [], // No tools for this prompt currently
      });
      output = result.output;
    } else {
      console.log("[BYOK] clarifyInterviewQuestion: Using globalAi.generate() for global path as well.");
      // const resultFromRun = await globalAi.run(clarifyInterviewQuestionPromptObj.name, async () => saneInput);
      // console.log("[BYOK] Raw output from globalAi.run in clarifyInterviewQuestion:", JSON.stringify(resultFromRun, null, 2)); // Log raw output
      // output = ClarifyInterviewQuestionOutputSchema.parse(resultFromRun); // Ensure parsing

      const result = await globalAi.generate<typeof ClarifyInterviewQuestionOutputSchema>({
        prompt: CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE,
        context: saneInput,
        model: googleAI.model('gemini-1.5-flash-latest'), // Specify model for global path too
        output: { schema: ClarifyInterviewQuestionOutputSchema },
        config: { responseMimeType: "application/json" },
        // tools: [], // No tools for this prompt currently
      });
      output = result.output;
    }

    if (!output || !output.clarificationText) {
        return { clarificationText: "Sorry, I couldn't generate a clarification for that at the moment. Please try rephrasing your request or proceed with your best understanding of the question." };
    }
    return output;
  } catch (error) {
    console.error("[BYOK] Error in clarifyInterviewQuestion:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error.";
    return { clarificationText: `Clarification Error: ${errorMsg}` };
  }
}
