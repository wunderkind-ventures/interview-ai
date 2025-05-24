
'use server';
/**
 * @fileOverview A Genkit flow to provide clarification on a specific piece of interview feedback.
 *
 * - clarifyFeedback - A function that provides clarification on feedback.
 * - ClarifyFeedbackInput - The input type for the clarifyFeedback function.
 * - ClarifyFeedbackOutput - The return type for the clarifyFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InterviewContextSchema = z.object({
  interviewType: z.string(),
  faangLevel: z.string(),
  jobTitle: z.string().optional(),
  interviewFocus: z.string().optional(),
});

const ClarifyFeedbackInputSchema = z.object({
  originalQuestionText: z.string().describe("The original interview question text."),
  userAnswerText: z.string().describe("The user's answer to the original question."),
  feedbackItemText: z.string().describe("The specific piece of feedback (e.g., an area for improvement or a suggestion) that the user wants clarification on."),
  userClarificationRequest: z.string().describe("The user's question asking for clarification on the feedbackItemText."),
  interviewContext: InterviewContextSchema.describe("The overall context of the interview."),
});
export type ClarifyFeedbackInput = z.infer<typeof ClarifyFeedbackInputSchema>;

const ClarifyFeedbackOutputSchema = z.object({
  clarificationText: z.string().describe('A concise and helpful clarification in response to the user\'s request about the specific feedback item.'),
});
export type ClarifyFeedbackOutput = z.infer<typeof ClarifyFeedbackOutputSchema>;

export async function clarifyFeedback(input: ClarifyFeedbackInput): Promise<ClarifyFeedbackOutput> {
  return clarifyFeedbackFlow(input);
}

const clarifyFeedbackPrompt = ai.definePrompt({
  name: 'clarifyFeedbackPrompt',
  input: {schema: ClarifyFeedbackInputSchema},
  output: {schema: ClarifyFeedbackOutputSchema},
  prompt: `You are an expert Interview Coach AI, providing helpful clarifications.
A user is seeking clarification on a specific piece of feedback they received for their answer to an interview question.

Interview Context:
- Type: {{interviewContext.interviewType}}
- Level: {{interviewContext.faangLevel}}
{{#if interviewContext.jobTitle}}- Job Title: {{interviewContext.jobTitle}}{{/if}}
{{#if interviewContext.interviewFocus}}- Specific Focus: {{interviewContext.interviewFocus}}{{/if}}

Original Interview Question:
"{{originalQuestionText}}"

User's Answer to this Question:
"{{userAnswerText}}"

Specific Feedback Item User Wants Clarified:
"{{feedbackItemText}}"

User's Clarification Request:
"{{userClarificationRequest}}"

Your Task:
Carefully review all the provided context. Provide a clear, concise, and actionable clarification that directly addresses the user's request about the specific feedback item.
Avoid generic advice. Focus on explaining the feedback point in more detail, giving an example if helpful, or suggesting how the user might apply that feedback.
Keep the clarification focused and to the point (2-4 sentences is ideal).
Begin your clarification directly.
`,
});

const clarifyFeedbackFlow = ai.defineFlow(
  {
    name: 'clarifyFeedbackFlow',
    inputSchema: ClarifyFeedbackInputSchema,
    outputSchema: ClarifyFeedbackOutputSchema,
  },
  async (input) => {
    const {output} = await clarifyFeedbackPrompt(input);
    if (!output || !output.clarificationText) {
        return { clarificationText: "Sorry, I couldn't generate a clarification for that at the moment. Please try rephrasing your request or ensure all context is clear." };
    }
    return output;
  }
);
