
'use server';
/**
 * @fileOverview Generates feedback for a completed interview session.
 *
 * - generateInterviewFeedback - A function that provides feedback on interview answers.
 * - GenerateInterviewFeedbackInput - The input type for the feedback generation.
 * - GenerateInterviewFeedbackOutput - The return type containing feedback items and an overall summary.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { InterviewQuestion, Answer } from '@/lib/types'; // Keep original Answer type for internal use.

// Input schema for the data needed by the prompt template
const PromptInputSchema = z.object({
  interviewType: z.string(),
  interviewStyle: z.string(),
  faangLevel: z.string(),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
  questionsAndAnswers: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string(),
      answerText: z.string(),
      timeTakenMs: z.number().optional().describe('Time taken for the answer in milliseconds.'),
      indexPlusOne: z.number(),
    })
  ),
});

// Schema for what the AI model is expected to return for each feedback item
const AIFeedbackItemSchema = z.object({
  questionId: z
    .string()
    .describe('The ID of the question this feedback pertains to.'),
  feedbackText: z
    .string()
    .describe(
      'Specific, constructive feedback for the answer to this question.'
    ),
});

// Schema for the overall AI model output
const AIOutputSchema = z.object({
  feedbackItems: z
    .array(AIFeedbackItemSchema)
    .describe('An array of feedback objects, one for each question.'),
  overallSummary: z
    .string()
    .describe(
      'A comprehensive overall summary of the candidate performance, including strengths, weaknesses, actionable advice, and comments on pacing if applicable.'
    ),
});

// Input schema for the exported flow function
export const GenerateInterviewFeedbackInputSchema = z.object({
  questions: z.array(
    z.object({id: z.string(), text: z.string()})
  ).describe("The list of questions asked during the interview."),
  answers: z.array( // This Answer now includes timeTakenMs
    z.object({questionId: z.string(), answerText: z.string(), timeTakenMs: z.number().optional() })
  ).describe("The list of answers provided by the user, including time taken for each."),
  interviewType: z.nativeEnum(
    ['product sense', 'technical system design', 'behavioral']
  ).describe("The type of the interview."),
   interviewStyle: z.nativeEnum(['simple-qa', 'case-study'])
    .describe('The style of the interview: simple Q&A or multi-turn case study.'),
  faangLevel: z
    .string()
    .describe('The target FAANG complexity level of the interview.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description, if provided.'),
  resume: z.string().optional().describe('The candidate resume, if provided.'),
});
export type GenerateInterviewFeedbackInput = z.infer<
  typeof GenerateInterviewFeedbackInputSchema
>;

// Output schema for the exported flow function (matches lib/types.ts)
export const FeedbackItemSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  answerText: z.string(),
  feedbackText: z.string(),
  timeTakenMs: z.number().optional(), // Added timeTakenMs to output
});

export const GenerateInterviewFeedbackOutputSchema = z.object({
  feedbackItems: z.array(FeedbackItemSchema),
  overallSummary: z.string(),
});
export type GenerateInterviewFeedbackOutput = z.infer<
  typeof GenerateInterviewFeedbackOutputSchema
>;


export async function generateInterviewFeedback(
  input: GenerateInterviewFeedbackInput
): Promise<GenerateInterviewFeedbackOutput> {
  return generateInterviewFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInterviewFeedbackPrompt',
  input: {schema: PromptInputSchema},
  output: {schema: AIOutputSchema},
  prompt: `You are an expert career coach and interviewer, providing detailed feedback for a mock interview session.
The user has just completed a mock interview of type "{{interviewType}}" (style: "{{interviewStyle}}") targeting a "{{faangLevel}}" level.
{{#if jobDescription}}
The interview was for a role with the following job description:
{{{jobDescription}}}
{{/if}}
{{#if resume}}
The candidate's resume is as follows:
{{{resume}}}
{{/if}}

Below are the questions asked and the answers provided by the user. For each answer, the time taken in milliseconds is also provided if available.
{{#each questionsAndAnswers}}
Question (ID: {{this.questionId}}): {{{this.questionText}}}
Answer: {{{this.answerText}}}
{{#if this.timeTakenMs}}
(Time taken: {{this.timeTakenMs}} ms)
{{/if}}

{{/each}}

Your task is to:
1.  For each question and answer pair (identified by questionId), provide specific, constructive feedback in the 'feedbackText' field. This feedback should be concise yet impactful, focusing on strengths and areas for improvement. Consider:
    *   Clarity and conciseness of the answer.
    *   Structure and organization of thoughts.
    *   Relevance to the question.
    *   Completeness of the answer.
    *   Demonstration of required skills or knowledge (based on interview type, JD, and resume).
    *   Use of examples (if applicable and appropriate for the interview style).
    *   Communication style.
    *   If time taken is provided, briefly consider if the length of the answer seems appropriate for the time spent.
2.  Provide an 'overallSummary' of the candidate's performance. This summary should synthesize the feedback from individual questions, identify recurring themes (both positive and negative), and offer actionable advice for improvement.
    *   Specifically comment on the candidate's pacing and time management based on the time taken for answers, if this information was generally available. For example, were answers generally well-paced, too brief, or too verbose for the time spent?

Output the feedback in the specified JSON format. Ensure 'feedbackText' for each item is a detailed critique of the corresponding answer. The 'overallSummary' should be a comprehensive paragraph.
Make sure each item in 'feedbackItems' includes the 'questionId' it refers to.
`,
});

const generateInterviewFeedbackFlow = ai.defineFlow(
  {
    name: 'generateInterviewFeedbackFlow',
    inputSchema: GenerateInterviewFeedbackInputSchema,
    outputSchema: GenerateInterviewFeedbackOutputSchema,
  },
  async (input: GenerateInterviewFeedbackInput) => {
    // Prepare data for the prompt template
    const questionsAndAnswers = input.questions.map((q, index) => {
      const answer = input.answers.find(a => a.questionId === q.id);
      return {
        questionId: q.id,
        questionText: q.text,
        answerText: answer ? answer.answerText : "No answer provided.",
        timeTakenMs: answer ? answer.timeTakenMs : undefined,
        indexPlusOne: index + 1,
      };
    });

    const promptInput: z.infer<typeof PromptInputSchema> = {
      interviewType: input.interviewType,
      interviewStyle: input.interviewStyle,
      faangLevel: input.faangLevel,
      jobDescription: input.jobDescription,
      resume: input.resume,
      questionsAndAnswers,
    };

    const {output: aiOutput} = await prompt(promptInput);

    if (!aiOutput) {
      throw new Error('AI did not return feedback.');
    }

    // Combine AI feedback with original question and answer text
    const populatedFeedbackItems = aiOutput.feedbackItems.map(aiItem => {
      const originalQuestion = input.questions.find(q => q.id === aiItem.questionId);
      const originalAnswer = input.answers.find(a => a.questionId === aiItem.questionId);
      return {
        questionId: aiItem.questionId,
        questionText: originalQuestion ? originalQuestion.text : "Question text not found.",
        answerText: originalAnswer ? originalAnswer.answerText : "Answer text not found.",
        feedbackText: aiItem.feedbackText,
        timeTakenMs: originalAnswer ? originalAnswer.timeTakenMs : undefined, // Include timeTakenMs in the final feedback item
      };
    });

    return {
      feedbackItems: populatedFeedbackItems,
      overallSummary: aiOutput.overallSummary,
    };
  }
);
