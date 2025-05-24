
'use server';
/**
 * @fileOverview Analyzes a user's submission for a take-home assignment.
 *
 * - analyzeTakeHomeSubmission - A function that provides detailed analysis.
 * - AnalyzeTakeHomeSubmissionInput - The input type for the analysis.
 * - AnalyzeTakeHomeSubmissionOutput - The return type containing structured feedback.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeTakeHomeSubmissionInput, AnalyzeTakeHomeSubmissionOutput, AnalyzeTakeHomeSubmissionContext } from '@/lib/types'; // Import from lib/types

const AnalyzeTakeHomeSubmissionContextSchema = z.object({
    interviewType: z.string(),
    faangLevel: z.string(),
    jobTitle: z.string().optional(),
    interviewFocus: z.string().optional(),
});

const AnalyzeTakeHomeSubmissionInputSchema = z.object({
  assignmentText: z.string().describe('The original text of the take-home assignment brief.'),
  idealSubmissionCharacteristics: z.array(z.string()).describe('Pre-defined key characteristics of a strong submission for this assignment.'),
  userSubmissionText: z.string().min(50, { message: "Submission text must be at least 50 characters."}).describe("The user's full submitted text for the assignment."),
  interviewContext: AnalyzeTakeHomeSubmissionContextSchema,
});

const AnalyzeTakeHomeSubmissionOutputSchema = z.object({
  overallAssessment: z.string().describe("A holistic review of the submission, covering adherence to the brief, clarity, structure, and quality of the solution/analysis. (2-4 sentences)"),
  strengthsOfSubmission: z.array(z.string()).describe("2-3 specific strengths identified in the user's submission."),
  areasForImprovementInSubmission: z.array(z.string()).describe("2-3 specific areas where the submission could be improved."),
  actionableSuggestionsForRevision: z.array(z.string()).describe("2-3 concrete, actionable suggestions for how the user could revise or improve their submission."),
});

export async function analyzeTakeHomeSubmission(
  input: AnalyzeTakeHomeSubmissionInput
): Promise<AnalyzeTakeHomeSubmissionOutput> {
  return analyzeTakeHomeSubmissionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTakeHomeSubmissionPrompt',
  input: { schema: AnalyzeTakeHomeSubmissionInputSchema },
  output: { schema: AnalyzeTakeHomeSubmissionOutputSchema },
  prompt: `You are an Expert Interview Reviewer AI, specializing in evaluating take-home assignments.
A candidate has submitted their response to a take-home assignment. Your task is to provide a structured and insightful analysis.

**Interview Context:**
- Type: {{interviewContext.interviewType}}
- Level: {{interviewContext.faangLevel}}
{{#if interviewContext.jobTitle}}- Job Title: {{interviewContext.jobTitle}}{{/if}}
{{#if interviewContext.interviewFocus}}- Focus: {{interviewContext.interviewFocus}}{{/if}}

**Original Assignment Brief:**
{{{assignmentText}}}

**Ideal Submission Characteristics (as defined when assignment was created):**
{{#if idealSubmissionCharacteristics.length}}
{{#each idealSubmissionCharacteristics}}
- {{{this}}}
{{/each}}
{{else}}
- No specific ideal characteristics were pre-defined for this assignment. Evaluate based on general best practices for the interview type and level.
{{/if}}

**Candidate's Submission:**
{{{userSubmissionText}}}

**Your Evaluation Task:**
Carefully review the candidate's submission in light of the original assignment brief, the ideal submission characteristics, and the overall interview context. Provide the following structured feedback:

1.  **overallAssessment (String):** A concise (2-4 sentences) holistic assessment. Consider:
    *   How well did the submission address the core requirements of the assignment brief?
    *   Was the submission clear, well-structured, and easy to understand?
    *   How was the quality of the solution, analysis, or insights provided, relative to the '{{interviewContext.faangLevel}}' expectations?
    *   Did it meet the spirit of the 'idealSubmissionCharacteristics'?

2.  **strengthsOfSubmission (Array of 2-3 strings):** Identify specific positive aspects of the submission. Be concrete.
    *   Example: "The proposed solution clearly outlines a scalable architecture."
    *   Example: "The market analysis was thorough and well-supported by data points mentioned."

3.  **areasForImprovementInSubmission (Array of 2-3 strings):** Pinpoint specific areas where the submission could be tangibly improved.
    *   Example: "The risk mitigation section could be expanded to cover potential data privacy concerns."
    *   Example: "While the algorithm is correct, a discussion of its time/space complexity is missing."

4.  **actionableSuggestionsForRevision (Array of 2-3 strings):** Offer concrete, actionable advice for how the candidate could improve this submission.
    *   Example: "Consider adding a section on how you would measure the success of your proposed feature using specific KPIs."
    *   Example: "Revisit the section on 'Trade-offs' to explicitly compare Approach A vs. Approach B in terms of cost and implementation time."

Ensure your feedback is constructive, professional, and directly relevant to the submitted work.
`,
});

const analyzeTakeHomeSubmissionFlow = ai.defineFlow(
  {
    name: 'analyzeTakeHomeSubmissionFlow',
    inputSchema: AnalyzeTakeHomeSubmissionInputSchema,
    outputSchema: AnalyzeTakeHomeSubmissionOutputSchema,
  },
  async (input: AnalyzeTakeHomeSubmissionInput): Promise<AnalyzeTakeHomeSubmissionOutput> => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('AI did not return a submission analysis.');
      }
      return output;
    } catch (error) {
      console.error("Error in analyzeTakeHomeSubmissionFlow:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during submission analysis.";
      // Provide a structured fallback error response
      return {
        overallAssessment: `Error: Could not complete submission analysis. ${errorMessage}`,
        strengthsOfSubmission: ["Error: Could not identify strengths."],
        areasForImprovementInSubmission: ["Error: Could not identify areas for improvement."],
        actionableSuggestionsForRevision: ["Error: Could not generate revision suggestions. Please ensure the submission is sufficiently detailed and try again."],
      };
    }
  }
);
