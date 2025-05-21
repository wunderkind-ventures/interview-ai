
'use server';
/**
 * @fileOverview A Genkit flow to explain a given term or concept.
 *
 * - explainConcept - A function that provides an explanation for a term.
 * - ExplainConceptInput - The input type for the explainConcept function.
 * - ExplainConceptOutput - The return type for the explainConcept function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainConceptInputSchema = z.object({
  term: z.string().describe('The term or concept to be explained.'),
  interviewContext: z.string().optional().describe('Optional context of the interview (e.g., "technical system design", "product sense") to tailor the explanation if relevant.'),
});
export type ExplainConceptInput = z.infer<typeof ExplainConceptInputSchema>;

const ExplainConceptOutputSchema = z.object({
  explanation: z.string().describe('A concise and clear explanation of the term or concept.'),
});
export type ExplainConceptOutput = z.infer<typeof ExplainConceptOutputSchema>;

export async function explainConcept(input: ExplainConceptInput): Promise<ExplainConceptOutput> {
  return explainConceptFlow(input);
}

const explainConceptPrompt = ai.definePrompt({
  name: 'explainConceptPrompt',
  input: {schema: ExplainConceptInputSchema},
  output: {schema: ExplainConceptOutputSchema},
  prompt: `Please provide a clear and concise explanation for the following term: "{{term}}".

{{#if interviewContext}}
The term is being asked in the context of a "{{interviewContext}}" interview. Tailor the explanation to be understandable and relevant for someone in such an interview.
{{else}}
Tailor the explanation to be understandable for someone in a professional job interview.
{{/if}}

Focus on the core meaning and its common application. Avoid overly deep technical jargon unless necessary, and if used, briefly clarify it.
The explanation should be helpful for someone who needs a quick understanding during an interview.
Aim for an explanation that is 2-5 sentences long.
`,
});

const explainConceptFlow = ai.defineFlow(
  {
    name: 'explainConceptFlow',
    inputSchema: ExplainConceptInputSchema,
    outputSchema: ExplainConceptOutputSchema,
  },
  async (input) => {
    const {output} = await explainConceptPrompt(input);
    if (!output || !output.explanation) {
        return { explanation: `Sorry, I couldn't generate an explanation for "${input.term}" at this moment.` };
    }
    return output;
  }
);

