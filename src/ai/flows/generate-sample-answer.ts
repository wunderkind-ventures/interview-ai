
'use server';
/**
 * @fileOverview A Genkit flow to generate a sample answer for a given interview question.
 *
 * - generateSampleAnswer - A function that provides a sample answer.
 * - GenerateSampleAnswerInput - The input type for the generateSampleAnswer function.
 * - GenerateSampleAnswerOutput - The return type for the generateSampleAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSampleAnswerInputSchema = z.object({
  questionText: z.string().describe('The text of the interview question.'),
  interviewType: z.string().describe('The overall type of the interview (e.g., "product sense", "behavioral").'),
  faangLevel: z.string().describe('The target FAANG complexity level for the answer.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills the question may be targeting.'),
  idealAnswerCharacteristics: z.array(z.string()).optional().describe("Pre-defined ideal characteristics of a strong answer to this question, to guide the sample answer generation."),
});
export type GenerateSampleAnswerInput = z.infer<typeof GenerateSampleAnswerInputSchema>;

const GenerateSampleAnswerOutputSchema = z.object({
  sampleAnswerText: z.string().describe('A well-structured, ideal sample answer to the question.'),
});
export type GenerateSampleAnswerOutput = z.infer<typeof GenerateSampleAnswerOutputSchema>;

export async function generateSampleAnswer(input: GenerateSampleAnswerInput): Promise<GenerateSampleAnswerOutput> {
  return generateSampleAnswerFlow(input);
}

const generateSampleAnswerPrompt = ai.definePrompt({
  name: 'generateSampleAnswerPrompt',
  input: {schema: GenerateSampleAnswerInputSchema},
  output: {schema: GenerateSampleAnswerOutputSchema},
  prompt: `You are an expert Interview Coach AI. Your task is to generate a high-quality, well-structured sample answer for the following interview question.
The answer should be appropriate for the specified interview type, FAANG level, and any given focus or targeted skills.
It should embody the "ideal answer characteristics" if they are provided.

Interview Context:
- Type: {{{interviewType}}}
- Level: {{{faangLevel}}}
{{#if interviewFocus}}- Specific Focus: {{{interviewFocus}}}{{/if}}
{{#if targetedSkills.length}}
- Targeted Skills:
{{#each targetedSkills}}
  - {{{this}}}
{{/each}}
{{/if}}
{{#if idealAnswerCharacteristics.length}}
- Ideal Answer Characteristics for this question (use these as a guide for your sample answer):
{{#each idealAnswerCharacteristics}}
  - {{{this}}}
{{/each}}
{{/if}}

Original Question:
"{{{questionText}}}"

Generate a sample answer that effectively addresses the question, demonstrates strong reasoning, and is clearly communicated.
If the question is behavioral, structure the sample answer using the STAR method (Situation, Task, Action, Result).
If it's a technical or product question, ensure the answer is logical, covers key considerations, and explains trade-offs where appropriate.
The answer should be comprehensive yet concise.
Begin the answer directly, without introductory phrases like "Here's a sample answer:".
`,
});

const generateSampleAnswerFlow = ai.defineFlow(
  {
    name: 'generateSampleAnswerFlow',
    inputSchema: GenerateSampleAnswerInputSchema,
    outputSchema: GenerateSampleAnswerOutputSchema,
  },
  async (input) => {
    const {output} = await generateSampleAnswerPrompt(input);
    if (!output || !output.sampleAnswerText) {
        return { sampleAnswerText: `Sorry, I couldn't generate a sample answer for the question: "${input.questionText}" at this moment. Consider the key concepts and try to structure your response logically.` };
    }
    return output;
  }
);
