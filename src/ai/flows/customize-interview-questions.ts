
// src/ai/flows/customize-interview-questions.ts

'use server';

/**
 * @fileOverview Customizes interview questions based on a provided job description.
 *
 * - customizeInterviewQuestions - A function that customizes interview questions based on a job description.
 * - CustomizeInterviewQuestionsInput - The input type for the customizeInterviewQuestions function.
 * - CustomizeInterviewQuestionsOutput - The return type for the customizeInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CustomizeInterviewQuestionsInputSchema = z.object({
  jobDescription: z
    .string()
    .describe('The job description to customize the interview questions for.'),
  resume: z
    .string()
    .optional()
    .describe('The user resume to further customize the interview questions for.'),
  interviewType: z
    .enum(['product sense', 'technical system design', 'behavioral', 'case study'])
    .describe('The type of interview to generate questions for.'),
  faangLevel: z
    .string()
    .optional()
    .describe('The target FAANG level for difficulty adjustment.'),
});

export type CustomizeInterviewQuestionsInput = z.infer<
  typeof CustomizeInterviewQuestionsInputSchema
>;

const CustomizeInterviewQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(z.string())
    .describe('An array of customized interview questions.'),
});

export type CustomizeInterviewQuestionsOutput = z.infer<
  typeof CustomizeInterviewQuestionsOutputSchema
>;

export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput
): Promise<CustomizeInterviewQuestionsOutput> {
  return customizeInterviewQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customizeInterviewQuestionsPrompt',
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: CustomizeInterviewQuestionsOutputSchema,
  },
  prompt: `You are an expert interviewer specializing in FAANG interviews.

You will generate customized interview questions based on the provided job description, resume, interview type, and FAANG level.
If the interview type is "case study", the questions should be suitable for a multi-turn conversation, often starting with a broad scenario and allowing for follow-up questions based on the candidate's responses.

Job Description: {{{jobDescription}}}
{{~#if resume}}
Resume: {{{resume}}}
{{~/if}}
Interview Type: {{{interviewType}}}
{{~#if faangLevel}}
FAANG Level: {{{faangLevel}}}
{{~/if}}

Generate 5-10 interview questions tailored to the job description, resume, interview type, and FAANG level. Ensure the questions are relevant and challenging.
For "case study" questions, the initial question might be more open-ended, and you can suggest potential areas for deeper dives or follow-ups if appropriate within the 5-10 question limit.

Output the questions as a JSON array of strings.
`,
});

const customizeInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'customizeInterviewQuestionsFlow',
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: CustomizeInterviewQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
