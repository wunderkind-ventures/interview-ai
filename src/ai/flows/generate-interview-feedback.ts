
'use server';
/**
 * @fileOverview Generates feedback for a completed interview session.
 * This flow now orchestrates initial feedback generation and then refines it.
 *
 * - generateInterviewFeedback - A function that provides feedback on interview answers.
 * - GenerateInterviewFeedbackInput - The input type for the feedback generation.
 * - GenerateInterviewFeedbackOutput - The return type containing feedback items and an overall summary.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getTechnologyBriefTool } from '../tools/technology-tools';
import { refineInterviewFeedback } from './refine-interview-feedback';
import type { RefineInterviewFeedbackInput } from './refine-interview-feedback';

// Input schema for the data needed by the initial prompt template
const DraftPromptInputSchema = z.object({
  interviewType: z.string(),
  interviewStyle: z.string(),
  faangLevel: z.string().describe("The target FAANG level, influencing expected depth and quality of answers."),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
  interviewFocus: z.string().optional(),
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

// Schema for what the AI model is expected to return for each feedback item (draft stage)
const AIDraftFeedbackItemSchema = z.object({
  questionId: z
    .string()
    .describe('The ID of the question this feedback pertains to.'),
  strengths: z
    .array(z.string())
    .optional()
    .describe('A list of specific strengths identified in the answer.'),
  areasForImprovement: z
    .array(z.string())
    .optional()
    .describe('A list of specific areas where the answer could be improved.'),
  specificSuggestions: z
    .array(z.string())
    .optional()
    .describe('A list of actionable suggestions for improving future answers to similar questions.'),
  critique: z
    .string()
    .optional()
    .describe('A concise overall critique of the answer to this specific question, considering its alignment with the faangLevel expectations for ambiguity, complexity, scope, and execution.'),
  idealAnswerPointers: z
    .array(z.string())
    .optional()
    .describe('A list of key points or elements that would typically be found in a strong answer to this specific question, reflecting the faangLevel. Focus on general best practices for this type of question rather than just rephrasing the candidate\'s answer.'),
});

// Schema for the overall AI model output (draft stage)
const AIDraftOutputSchema = z.object({
  feedbackItems: z
    .array(AIDraftFeedbackItemSchema)
    .describe('An array of feedback objects, one for each question.'),
  overallSummary: z
    .string()
    .describe(
      'A comprehensive overall summary of the candidate performance, including strengths, weaknesses, actionable advice, and comments on pacing if applicable. The summary should also reflect how well the candidate met the expectations for the specified faangLevel in terms of handling ambiguity, complexity, scope, and execution.'
    ),
});

// Input schema for the exported flow function
export const GenerateInterviewFeedbackInputSchema = z.object({
  questions: z.array(
    z.object({id: z.string(), text: z.string()})
  ).describe("The list of questions asked during the interview."),
  answers: z.array(
    z.object({questionId: z.string(), answerText: z.string(), timeTakenMs: z.number().optional() })
  ).describe("The list of answers provided by the user, including time taken for each."),
  interviewType: z.nativeEnum(
    ['product sense', 'technical system design', 'behavioral']
  ).describe("The type of the interview."),
   interviewStyle: z.nativeEnum(['simple-qa', 'case-study', 'take-home'])
    .describe('The style of the interview: simple Q&A or multi-turn case study or take home.'),
  faangLevel: z
    .string()
    .describe('The target FAANG complexity level of the interview.'),
  jobTitle: z.string().optional().describe('The job title, if provided.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description, if provided.'),
  resume: z.string().optional().describe('The candidate resume, if provided.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'),
});
export type GenerateInterviewFeedbackInput = z.infer<
  typeof GenerateInterviewFeedbackInputSchema
>;

// Output schema for the exported flow function (matches lib/types.ts)
// This remains the same, as the refinement flow also outputs this structure.
export const FeedbackItemSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  answerText: z.string(),
  strengths: z.array(z.string()).optional(),
  areasForImprovement: z.array(z.string()).optional(),
  specificSuggestions: z.array(z.string()).optional(),
  critique: z.string().optional(),
  idealAnswerPointers: z.array(z.string()).optional(),
  timeTakenMs: z.number().optional(),
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
  return generateInterviewFeedbackOrchestrationFlow(input);
}

const draftPrompt = ai.definePrompt({
  name: 'generateDraftInterviewFeedbackPrompt', 
  tools: [getTechnologyBriefTool],
  input: {schema: DraftPromptInputSchema},
  output: {schema: AIDraftOutputSchema}, 
  prompt: `You are an expert career coach and interviewer, providing detailed, structured DRAFT feedback for a mock interview session.
This is the first pass; the feedback will be polished by another specialized AI agent later. Focus on getting comprehensive content and analysis down.

The user has just completed a mock interview of type "{{interviewType}}" (style: "{{interviewStyle}}") targeting a "{{faangLevel}}" level.
For the given 'faangLevel', consider common industry expectations regarding:
*   **Ambiguity:** How well did the candidate handle unclear or incomplete information?
*   **Complexity:** Did their responses address the inherent complexity of the problems appropriately for the level?
*   **Scope:** Was their thinking appropriately broad or deep for the level?
*   **Execution:** Did they demonstrate tactical skill or strategic thinking as expected for the level?
Your feedback, especially the 'critique' for each question and the 'overallSummary', should subtly reflect these considerations.

{{#if jobTitle}}
The interview was for the role of: {{{jobTitle}}}
{{/if}}
{{#if jobDescription}}
The interview was for a role with the following job description:
{{{jobDescription}}}
{{/if}}
{{#if resume}}
The candidate's resume is as follows:
{{{resume}}}
{{/if}}
{{#if interviewFocus}}
The specific focus for this interview was: {{{interviewFocus}}}
{{/if}}

**Tool Usage Guidance:**
If the candidate's answer mentions specific technologies and you need a quick, factual summary to help you evaluate their understanding or suggest alternatives, you may use the \`getTechnologyBriefTool\`. Use the tool's output to enrich your feedback, for example, by validating the candidate's usage of the technology or by pointing out common considerations for that tech. Do not simply repeat the tool's output in your feedback. Ensure your critique remains focused on the candidate's response.

{{#if (eq interviewStyle "take-home")}}
This was a take-home assignment. The "question" is the assignment description, and the "answer" is the candidate's submission.
Question (Assignment Description): {{{questionsAndAnswers.0.questionText}}}
Candidate's Submission: {{{questionsAndAnswers.0.answerText}}}
{{#if questionsAndAnswers.0.timeTakenMs}}
(Time spent on submission (if tracked): {{questionsAndAnswers.0.timeTakenMs}} ms)
{{/if}}

Your task is to provide a DRAFT of:
1.  An 'overallSummary' evaluating the candidate's submission against the assignment's requirements and goals. Consider clarity, structure, completeness, adherence to instructions, the quality of the solution/analysis presented, and how well it met the expectations for '{{faangLevel}}' (ambiguity, complexity, scope, execution). Reference the job title/description and 'interviewFocus' if provided.
2.  The 'feedbackItems' array should contain a single item. For this item, related to questionId '{{questionsAndAnswers.0.questionId}}':
    *   Provide a 'critique': A comprehensive critique of the submission, focusing on how well it addressed the assignment, the 'interviewFocus', and the expectations for '{{faangLevel}}'.
    *   Optionally, list 'strengths': Specific positive aspects of the submission.
    *   Optionally, list 'areasForImprovement': Specific areas where the submission could be improved.
    *   Optionally, list 'specificSuggestions': Actionable advice related to the submission content or presentation.
    *   Optionally, list 'idealAnswerPointers': Key elements or considerations that would typically be part of a strong submission for this type of take-home assignment, considering the job title/description, interview type, 'interviewFocus', and '{{faangLevel}}'.

{{else}}
Below are the questions asked and the answers provided by the user. For each answer, the time taken in milliseconds is also provided if available.
{{#each questionsAndAnswers}}
Question {{this.indexPlusOne}} (ID: {{this.questionId}}): {{{this.questionText}}}
Answer: {{{this.answerText}}}
{{#if this.timeTakenMs}}
(Time taken: {{this.timeTakenMs}} ms)
{{/if}}

{{/each}}

Your task is to provide a DRAFT of:
1.  For each question and answer pair (identified by questionId), provide structured feedback in the 'feedbackItems' array. Each item should include:
    *   'questionId': The ID of the question.
    *   'strengths': (Optional) An array of 1-3 strings listing specific positive aspects of the answer, especially how it relates to the 'interviewFocus' if applicable.
    *   'areasForImprovement': (Optional) An array of 1-3 strings listing specific areas where the answer could be improved, considering the 'interviewFocus'.
    *   'specificSuggestions': (Optional) An array of 1-3 strings offering actionable suggestions to enhance future answers to similar questions, keeping the 'interviewFocus' in mind.
    *   'critique': (Optional) A concise (1-2 sentences) overall critique summarizing the quality of this specific answer, considering clarity, structure, relevance, completeness, demonstration of skills (including relation to 'interviewFocus'), use of examples, and alignment with '{{faangLevel}}' expectations (ambiguity, complexity, scope, execution). If time taken is provided, briefly comment if the answer seemed appropriate for the time.
    *   'idealAnswerPointers': (Optional) An array of 2-4 strings listing key elements, frameworks (like STAR for behavioral), or critical points that a strong answer to this specific question would typically include, taking into account the 'interviewFocus' and '{{faangLevel}}'.
    Focus on being constructive and specific.
2.  Provide an 'overallSummary' of the candidate's performance. This summary should synthesize the feedback from individual questions, identify recurring themes (both positive and negative), and offer actionable advice for improvement. If an 'interviewFocus' was set, comment on how well the candidate addressed this focus throughout the interview. Critically, evaluate how the overall performance aligns with the expectations for '{{faangLevel}}' regarding handling ambiguity, complexity of thought, and scope of solutions.
    *   Specifically comment on the candidate's pacing and time management based on the time taken for answers, if this information was generally available. For example, were answers generally well-paced, too brief, or too verbose for the time spent?
{{/if}}
Output the DRAFT feedback in the specified JSON format. Ensure all fields in 'feedbackItems' are correctly populated as described.
Make sure each item in 'feedbackItems' includes the 'questionId' it refers to.
`,
});

const generateInterviewFeedbackOrchestrationFlow = ai.defineFlow(
  {
    name: 'generateInterviewFeedbackOrchestrationFlow', 
    inputSchema: GenerateInterviewFeedbackInputSchema,
    outputSchema: GenerateInterviewFeedbackOutputSchema, 
  },
  async (input: GenerateInterviewFeedbackInput): Promise<GenerateInterviewFeedbackOutput> => {
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

    const draftPromptInput: z.infer<typeof DraftPromptInputSchema> = {
      interviewType: input.interviewType,
      interviewStyle: input.interviewStyle,
      faangLevel: input.faangLevel,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      resume: input.resume,
      interviewFocus: input.interviewFocus,
      questionsAndAnswers,
    };

    const {output: draftAiOutput} = await draftPrompt(draftPromptInput);

    if (!draftAiOutput) {
      throw new Error('AI did not return draft feedback.');
    }

     const fullyFormedDraftFeedbackItems = draftAiOutput.feedbackItems.map(aiItem => {
      const originalQuestion = input.questions.find(q => q.id === aiItem.questionId);
      const originalAnswer = input.answers.find(a => a.questionId === aiItem.questionId);
      return {
        questionId: aiItem.questionId,
        questionText: originalQuestion ? originalQuestion.text : "Question text not found.",
        answerText: originalAnswer ? originalAnswer.answerText : "Answer text not found.",
        strengths: aiItem.strengths || [],
        areasForImprovement: aiItem.areasForImprovement || [],
        specificSuggestions: aiItem.specificSuggestions || [],
        critique: aiItem.critique || "",
        idealAnswerPointers: aiItem.idealAnswerPointers || [],
        timeTakenMs: originalAnswer ? originalAnswer.timeTakenMs : undefined,
      };
    });

    const draftFeedbackForRefiner: GenerateInterviewFeedbackOutput = {
        feedbackItems: fullyFormedDraftFeedbackItems,
        overallSummary: draftAiOutput.overallSummary
    };

    const refineInput: RefineInterviewFeedbackInput = {
      draftFeedback: draftFeedbackForRefiner,
      interviewContext: {
        interviewType: input.interviewType,
        interviewStyle: input.interviewStyle,
        faangLevel: input.faangLevel,
        jobTitle: input.jobTitle,
        interviewFocus: input.interviewFocus,
        timeWasTracked: input.answers.some(a => a.timeTakenMs !== undefined)
      },
    };

    const refinedOutput = await refineInterviewFeedback(refineInput);

    if (!refinedOutput) {
        throw new Error('Feedback refinement process failed.');
    }
    
    return refinedOutput;
  }
);

    