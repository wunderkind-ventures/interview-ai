
'use server';

/**
 * @fileOverview Customizes interview questions based on a provided job description, interview type, style, targeted skills, and other factors.
 *
 * - customizeInterviewQuestions - A function that customizes interview questions.
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
    .enum(['product sense', 'technical system design', 'behavioral'])
    .describe('The type of interview to generate questions for.'),
  interviewStyle: z
    .enum(['simple-qa', 'case-study'])
    .describe('The style of the interview: simple Q&A or multi-turn case study.'),
  faangLevel: z
    .string()
    .optional()
    .describe('The target FAANG level for difficulty adjustment.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the user wants to focus on.'),
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

You will generate customized interview questions based on the provided job description, resume, interview type, interview style, FAANG level, and targeted skills.

{{#if (eq interviewStyle "case-study")}}
The questions should be suitable for a multi-turn conversation. They should often start with a broad scenario related to the interview type (e.g., a product design challenge for "product sense", a system scaling problem for "technical system design"). The initial question should be open-ended, encouraging a detailed response. You can also suggest potential areas for deeper dives or follow-up questions that an interviewer might ask, if appropriate within the 5-10 question limit for the initial set. The goal is to simulate the beginning of a case study.
{{else}}
The questions should be direct and suitable for a simple question and answer format, tailored to the interview type.
{{/if}}

Job Description: {{{jobDescription}}}
{{~#if resume}}
Resume: {{{resume}}}
{{~/if}}
Interview Type: {{{interviewType}}}
Interview Style: {{{interviewStyle}}}
{{~#if faangLevel}}
FAANG Level: {{{faangLevel}}}
{{~/if}}
{{#if targetedSkills.length}}
Prioritize questions that assess the following skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}

Generate 5-10 interview questions tailored to the inputs. Ensure the questions are relevant and challenging for the specified FAANG level, interview type, and targeted skills if provided.
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
