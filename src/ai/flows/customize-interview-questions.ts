
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
For the 'case-study' style, structure the output to simulate a multi-turn conversation.
Start with 1 or 2 broad, open-ended scenario questions suitable for the interview type (e.g., a product design challenge for "product sense", a system scaling problem for "technical system design", or a complex past experience for "behavioral").
The subsequent questions should be probing follow-ups that delve deeper into different facets of the initial scenario(s). These follow-ups should encourage detailed, structured responses and allow for a conversational exploration of the candidate's thought process.
For example, an initial product sense question might be "Design a new product for X market." Follow-up questions could then explore user segments, monetization, MVP features, metrics, and trade-offs.
The total number of questions (initial scenarios + follow-ups) should still be between 5 and 10.
The goal is to create a set of questions that naturally flow like a real case study interview, starting broad and then exploring specifics.
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
