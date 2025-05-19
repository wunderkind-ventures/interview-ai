
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
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';

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
    .enum(['simple-qa', 'case-study', 'take-home'])
    .describe('The style of the interview: simple Q&A, multi-turn case study, or take-home assignment.'),
  faangLevel: z
    .string()
    .optional()
    .describe('The target FAANG level for difficulty adjustment.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the user wants to focus on.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company the user is interviewing for (e.g., Amazon, Google).'),
});

export type CustomizeInterviewQuestionsInput = z.infer<
  typeof CustomizeInterviewQuestionsInputSchema
>;

const CustomizeInterviewQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(z.string())
    .describe('An array of customized interview questions. For "take-home" style, this will contain a single, comprehensive question.'),
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

Your goal is to generate interview questions tailored to the inputs provided.

Interview Details:
Job Description: {{{jobDescription}}}
{{#if resume}}Resume: {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: {{{interviewStyle}}}
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}

{{#if (eq interviewStyle "case-study")}}
For the 'case-study' style, structure the output to simulate a multi-turn conversation.
Start with 1 or 2 broad, open-ended scenario questions suitable for the interview type (e.g., a product design challenge for "product sense", a system scaling problem for "technical system design", or a complex past experience for "behavioral").
The subsequent questions should be probing follow-ups that delve deeper into different facets of the initial scenario(s). These follow-ups should encourage detailed, structured responses and allow for a conversational exploration of the candidate's thought process.
For example, an initial product sense question might be "Design a new product for X market." Follow-up questions could then explore user segments, monetization, MVP features, metrics, and trade-offs.
The total number of questions (initial scenarios + follow-ups) should be between 5 and 10.
The goal is to create a set of questions that naturally flow like a real case study interview, starting broad and then exploring specifics.
{{else if (eq interviewStyle "take-home")}}
For the 'take-home' style, generate ONLY ONE comprehensive question or scenario suitable for a take-home assignment. This question should be detailed enough to allow a candidate to produce a thorough written response, design document, or presentation.
Examples:
- For "product sense": "Outline a detailed product strategy for [specific product/market scenario], including target users, core features, go-to-market plan, and success metrics."
- For "technical system design": "Design a scalable system for [specific service, e.g., a ride-sharing app or a video streaming platform], covering architecture, data model, API design, and key trade-offs."
- For "behavioral" (less common for take-homes, but possible): "Describe a complex project you led, detailing your approach to challenges, team collaboration, and how you measured success. Structure this as a reflective document."
The output should be a single, well-defined task.
{{else}}
For the 'simple-qa' style, the questions should be direct and suitable for a simple question and answer format, tailored to the interview type. Generate 5-10 questions.
{{/if}}

{{#if targetedSkills.length}}
Prioritize questions that assess the following skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
Given the target company is Amazon, pay special attention to Amazon's Leadership Principles. If the interview type is 'behavioral', ensure many questions provide an opportunity to demonstrate these principles. For other interview types, frame questions that align with Amazon's culture of customer obsession, ownership, and invention.
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
Suggest situations or ask for examples where the candidate has demonstrated these.
{{/if}}

{{#if (eq interviewStyle "take-home")}}
Generate 1 comprehensive interview question.
{{else}}
Generate 5-10 interview questions.
{{/if}}
Ensure the questions are relevant and challenging for the specified FAANG level, interview type, interview style, targeted skills (if provided), and target company (if specified, especially Amazon).
Output the questions as a JSON array of strings.
`,
  customize: (prompt, input) => {
    return {
      ...prompt,
      prompt: prompt.prompt!.replace(
        '${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}',
        AMAZON_LEADERSHIP_PRINCIPLES.join('\n- ')
      ),
    };
  }
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
