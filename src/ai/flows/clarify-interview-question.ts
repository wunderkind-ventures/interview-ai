
'use server';
/**
 * @fileOverview A Genkit flow to provide clarification on the current interview question itself.
 *
 * - clarifyInterviewQuestion - A function that provides clarification on an interview question.
 * - ClarifyInterviewQuestionInput - The input type for the function.
 * - ClarifyInterviewQuestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { InterviewSetupData } from '@/lib/types'; // For interviewContext details

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

export async function clarifyInterviewQuestion(input: ClarifyInterviewQuestionInput): Promise<ClarifyInterviewQuestionOutput> {
  return clarifyInterviewQuestionFlow(input);
}

const clarifyInterviewQuestionPrompt = ai.definePrompt({
  name: 'clarifyInterviewQuestionPrompt',
  input: {schema: ClarifyInterviewQuestionInputSchema},
  output: {schema: ClarifyInterviewQuestionOutputSchema},
  prompt: `You are an AI Interviewer currently embodying the persona of: '{{interviewContext.interviewerPersona}}'.
Your current interview type is '{{interviewContext.interviewType}}' at '{{interviewContext.faangLevel}}' level.
{{#if interviewContext.interviewFocus}}The specific focus is '{{interviewContext.interviewFocus}}'.{{/if}}

The interview question you (as the AI Interviewer) asked was:
"{{interviewQuestionText}}"

The candidate is asking for clarification on THIS question. Their clarification request is:
"{{userClarificationRequest}}"

Your Task:
Provide a helpful and concise clarification.
- Directly address the candidate's specific point of confusion from their 'userClarificationRequest'.
- Maintain your '{{interviewContext.interviewerPersona}}' persona in your response. For example:
    - A 'friendly_peer' might say: "Good question! What I mean by that is..."
    - A 'skeptical_hiring_manager' might say: "The question is straightforward. However, to clarify, consider..."
    - A 'time_pressed_technical_lead' might give a very direct clarification.
- Do NOT give away the answer to the original 'interviewQuestionText'.
- Do NOT solve the problem for them.
- Your clarification should help them understand the question better so they can proceed.
- Aim for 1-3 sentences.

Begin your clarification directly.
`,
});

const clarifyInterviewQuestionFlow = ai.defineFlow(
  {
    name: 'clarifyInterviewQuestionFlow',
    inputSchema: ClarifyInterviewQuestionInputSchema,
    outputSchema: ClarifyInterviewQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await clarifyInterviewQuestionPrompt(input);
    if (!output || !output.clarificationText) {
        return { clarificationText: "Sorry, I couldn't generate a clarification for that at the moment. Please try rephrasing your request or proceed with your best understanding of the question." };
    }
    return output;
  }
);
