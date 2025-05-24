
'use server';
/**
 * @fileOverview Generates feedback for a completed interview session.
 * This flow now orchestrates initial feedback generation and then refines it.
 * For take-home assignments, it uses a specialized analysis flow.
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
import { FeedbackItemSchema, GenerateInterviewFeedbackOutputSchema, type GenerateInterviewFeedbackOutput } from '../schemas'; // Import from shared schemas
import { analyzeTakeHomeSubmission } from './analyze-take-home-submission'; // New import
import type { AnalyzeTakeHomeSubmissionInput, AnalyzeTakeHomeSubmissionOutput, AnalyzeTakeHomeSubmissionContext } from '@/lib/types'; // Import from lib/types

// Input schema for the data needed by the initial prompt template
const DraftPromptInputSchema = z.object({
  interviewType: z.string(),
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
      idealAnswerCharacteristics: z.array(z.string()).optional().describe("Pre-defined characteristics of a strong answer to this question."),
      confidenceScore: z.number().min(1).max(5).optional().describe("User's self-rated confidence (1-5 stars) for their answer."),
    })
  ),
  // Boolean flags for Handlebars
  isTakeHomeStyle: z.boolean(), // Will be true if interviewStyle === 'take-home'
  isSimpleQAOrCaseStudyStyle: z.boolean(), // Will be true if interviewStyle is 'simple-qa' or 'case-study'
  // For take-home, structuredAnalysis will contain the output from analyzeTakeHomeSubmission
  structuredTakeHomeAnalysis: z.custom<AnalyzeTakeHomeSubmissionOutput>().optional().describe("Detailed analysis if it's a take-home assignment."),
});

// Schema for what the AI model is expected to return for each feedback item (draft stage)
// This schema is now primarily for the "overallSummary" when isTakeHomeStyle is true,
// as individual feedback items for take-home are derived from structuredTakeHomeAnalysis.
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
    .describe('A concise overall critique of the answer to this specific question, considering its alignment with the faangLevel expectations for ambiguity, complexity, scope, and execution, and subtly acknowledging user confidence if provided.'),
  idealAnswerPointers: z
    .array(z.string())
    .optional()
    .describe('A list of key points or elements that would typically be found in a strong answer to this specific question, reflecting the faangLevel. Consider the provided Ideal Answer Characteristics if available.'),
  reflectionPrompts: z
    .array(z.string())
    .optional()
    .describe("1-2 thoughtful prompts to encourage user self-reflection, based on their answer, the critique, and their self-rated confidence score (if provided).")
});

// Schema for the overall AI model output (draft stage)
const AIDraftOutputSchema = z.object({
  feedbackItems: z // For non-take-home, this is an array. For take-home, it's an array with one item derived from analysis.
    .array(AIDraftFeedbackItemSchema)
    .describe('An array of feedback objects, one for each question (or one for a take-home).'),
  overallSummary: z
    .string()
    .describe(
      'A comprehensive overall summary of the candidate performance, including strengths, weaknesses, actionable advice, and comments on pacing if applicable. The summary should also reflect how well the candidate met the expectations for the specified faangLevel in terms of handling ambiguity, complexity, scope, and execution. For take-home, this summary should be based on the structuredTakeHomeAnalysis.'
    ),
});

// Input schema for the exported flow function
const GenerateInterviewFeedbackInputSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      idealAnswerCharacteristics: z.array(z.string()).optional(),
    })
  ).describe("The list of questions asked during the interview, including ideal answer characteristics."),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answerText: z.string(),
      timeTakenMs: z.number().optional(),
      confidenceScore: z.number().min(1).max(5).optional(),
    })
  ).describe("The list of answers provided by the user, including time taken and confidence for each."),
  interviewType: z.nativeEnum(
    ['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms']
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
// Type is exported from ../schemas
// export type GenerateInterviewFeedbackInput = z.infer<typeof GenerateInterviewFeedbackInputSchema>;


export async function generateInterviewFeedback(
  input: z.infer<typeof GenerateInterviewFeedbackInputSchema> // Use inferred type here for clarity
): Promise<GenerateInterviewFeedbackOutput> {
  return generateInterviewFeedbackOrchestrationFlow(input);
}

const draftPrompt = ai.definePrompt({
  name: 'generateDraftInterviewFeedbackPrompt',
  tools: [getTechnologyBriefTool],
  input: {schema: DraftPromptInputSchema},
  output: {schema: AIDraftOutputSchema},
  prompt: `You are an expert career coach and interviewer, providing detailed, structured DRAFT feedback for a mock interview session.
This is the first pass; the feedback will be polished by another specialized AI agent later.

The user has just completed a mock interview of type "{{interviewType}}" targeting a "{{faangLevel}}" level.
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
If the candidate's answer mentions specific technologies and you need a quick, factual summary to help you evaluate their understanding or suggest alternatives, you may use the \`getTechnologyBriefTool\`. Use the tool's output to enrich your feedback.

{{#if isTakeHomeStyle}}
This was a take-home assignment.
Assignment Description: {{{questionsAndAnswers.0.questionText}}}
{{#if questionsAndAnswers.0.idealAnswerCharacteristics.length}}
Ideal Submission Characteristics for this Assignment (from assignment design):
{{#each questionsAndAnswers.0.idealAnswerCharacteristics}}
- {{{this}}}
{{/each}}
{{/if}}
Candidate's Submission: {{{questionsAndAnswers.0.answerText}}}

**Structured Analysis of the Take-Home Submission (Provided by a specialized AI):**
- Overall Assessment: {{{structuredTakeHomeAnalysis.overallAssessment}}}
- Strengths of Submission:
{{#each structuredTakeHomeAnalysis.strengthsOfSubmission}}
  - {{{this}}}
{{/each}}
- Areas for Improvement in Submission:
{{#each structuredTakeHomeAnalysis.areasForImprovementInSubmission}}
  - {{{this}}}
{{/each}}
- Actionable Suggestions for Revision:
{{#each structuredTakeHomeAnalysis.actionableSuggestionsForRevision}}
  - {{{this}}}
{{/each}}

Your task is to provide a DRAFT of:
1.  An 'overallSummary' evaluating the candidate's submission *based on the provided Structured Analysis*. Briefly synthesize its key points and offer a concluding thought for the candidate, reflecting '{{faangLevel}}' expectations.
2.  The 'feedbackItems' array should contain a single item (for questionId '{{questionsAndAnswers.0.questionId}}') where you copy the structured analysis into the corresponding feedback fields.
    *   'critique': Copy 'structuredTakeHomeAnalysis.overallAssessment'.
    *   'strengths': Copy 'structuredTakeHomeAnalysis.strengthsOfSubmission'.
    *   'areasForImprovement': Copy 'structuredTakeHomeAnalysis.areasForImprovementInSubmission'.
    *   'specificSuggestions': Copy 'structuredTakeHomeAnalysis.actionableSuggestionsForRevision'.
    *   'idealAnswerPointers': Copy 'questionsAndAnswers.0.idealAnswerCharacteristics' (these are from the original assignment design).
    *   'reflectionPrompts': Based on the submission and the structured analysis, generate 1-2 thoughtful prompts for self-reflection.
{{/if}}

{{#if isSimpleQAOrCaseStudyStyle}}
Below are the questions asked, the answers provided, ideal answer characteristics, and user confidence for each question.
{{#each questionsAndAnswers}}
Question {{this.indexPlusOne}} (ID: {{this.questionId}}): {{{this.questionText}}}
{{#if this.idealAnswerCharacteristics.length}}
Ideal Answer Characteristics for this Question:
{{#each this.idealAnswerCharacteristics}}
- {{{this}}}
{{/each}}
{{/if}}
Answer: {{{this.answerText}}}
{{#if this.timeTakenMs}}
(Time taken: {{this.timeTakenMs}} ms)
{{/if}}
{{#if this.confidenceScore}}
User Confidence (1-5 stars): {{this.confidenceScore}}
{{/if}}
---
{{/each}}

Your task is to provide a DRAFT of:
1.  For each question and answer pair, provide structured feedback in 'feedbackItems'. Each item should include:
    *   'questionId'.
    *   'strengths', 'areasForImprovement', 'specificSuggestions' (optional arrays of 1-3 strings for each).
    *   'critique': (Optional concise summary). Your critique should be informed by the 'Ideal Answer Characteristics' provided for the question, and subtly acknowledge the user's 'confidenceScore' if available.
    *   'idealAnswerPointers': (Optional array of 2-4 strings) Key elements of a strong answer, potentially expanding on or reinforcing the provided 'Ideal Answer Characteristics'.
    *   'reflectionPrompts': Based on the answer, critique, strengths, areas for improvement, AND the user's 'confidenceScore' (if provided), generate 1-2 thoughtful reflection prompts.
        If confidence aligns with feedback (e.g., high confidence & strong feedback), ask what led to success.
        If confidence misaligns (e.g., high confidence & weak feedback, or low confidence & strong feedback), prompt user to explore the discrepancy.
        If no confidence score is available, you may omit reflection prompts or provide very general ones.
2.  Provide an 'overallSummary' of performance. Synthesize feedback, identify themes, offer advice. Comment on 'interviewFocus' and how performance aligns with '{{faangLevel}}' expectations (ambiguity, complexity, scope, execution), referencing 'Ideal Answer Characteristics' in general terms if they were commonly met or missed.
    *   Comment on pacing based on 'timeTakenMs' if available.
{{/if}}

Output the DRAFT feedback in the specified JSON format.
Make sure each item in 'feedbackItems' includes the 'questionId' it refers to.
`,
});

const generateInterviewFeedbackOrchestrationFlow = ai.defineFlow(
  {
    name: 'generateInterviewFeedbackOrchestrationFlow',
    inputSchema: GenerateInterviewFeedbackInputSchema,
    outputSchema: GenerateInterviewFeedbackOutputSchema,
  },
  async (input: z.infer<typeof GenerateInterviewFeedbackInputSchema>): Promise<GenerateInterviewFeedbackOutput> => {
    const isTakeHomeStyle = input.interviewStyle === 'take-home';
    const isSimpleQAOrCaseStudyStyle = input.interviewStyle === 'simple-qa' || input.interviewStyle === 'case-study';

    let structuredTakeHomeAnalysis: AnalyzeTakeHomeSubmissionOutput | undefined = undefined;
    let feedbackItemsForDraftPrompt: AIDraftFeedbackItemSchema[] = [];

    const questionsAndAnswersForPrompt = input.questions.map((q, index) => {
      const answer = input.answers.find(a => a.questionId === q.id);
      return {
        questionId: q.id,
        questionText: q.text,
        answerText: answer ? answer.answerText : "No answer provided.",
        timeTakenMs: answer ? answer.timeTakenMs : undefined,
        indexPlusOne: index + 1,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics,
        confidenceScore: answer ? answer.confidenceScore : undefined,
      };
    });

    if (isTakeHomeStyle && input.questions.length > 0 && input.answers.length > 0) {
      const assignment = input.questions[0];
      const submission = input.answers[0];

      const analysisInput: AnalyzeTakeHomeSubmissionInput = {
        assignmentText: assignment.text,
        idealSubmissionCharacteristics: assignment.idealAnswerCharacteristics || [],
        userSubmissionText: submission.answerText,
        interviewContext: {
          interviewType: input.interviewType,
          faangLevel: input.faangLevel,
          jobTitle: input.jobTitle,
          interviewFocus: input.interviewFocus,
        },
      };
      try {
        structuredTakeHomeAnalysis = await analyzeTakeHomeSubmission(analysisInput);
        // feedbackItemsForDraftPrompt is not directly built here for take-home;
        // The draftPrompt itself will be instructed to use structuredTakeHomeAnalysis
        // to populate the single feedbackItem's fields in its output.
        // However, we need to provide a shell so AIDraftOutputSchema is met.
         feedbackItemsForDraftPrompt = [{ // Placeholder structure for the prompt, actual values come from structuredTakeHomeAnalysis in prompt
            questionId: assignment.id,
            critique: structuredTakeHomeAnalysis.overallAssessment,
            strengths: structuredTakeHomeAnalysis.strengthsOfSubmission,
            areasForImprovement: structuredTakeHomeAnalysis.areasForImprovementInSubmission,
            specificSuggestions: structuredTakeHomeAnalysis.actionableSuggestionsForRevision,
            idealAnswerPointers: assignment.idealAnswerCharacteristics, // These are from original assignment design
            reflectionPrompts: [], // Reflection prompts will be generated by the main draft prompt
        }];

      } catch (analysisError) {
        console.error("Error during take-home submission analysis:", analysisError);
        // Populate with error messages or a generic error structure
        structuredTakeHomeAnalysis = {
          overallAssessment: "Error: Could not analyze take-home submission.",
          strengthsOfSubmission: [],
          areasForImprovementInSubmission: [],
          actionableSuggestionsForRevision: [],
        };
         feedbackItemsForDraftPrompt = [{
            questionId: assignment.id,
            critique: "Error analyzing submission.",
            strengths: [], areasForImprovement: [], specificSuggestions: [],
            idealAnswerPointers: assignment.idealAnswerCharacteristics,
            reflectionPrompts: ["Could not analyze submission fully. Reflect on how your submission aligns with the brief."]
        }];
      }
    }


    const draftPromptInput: z.infer<typeof DraftPromptInputSchema> = {
      interviewType: input.interviewType,
      faangLevel: input.faangLevel,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      resume: input.resume,
      interviewFocus: input.interviewFocus,
      questionsAndAnswers: questionsAndAnswersForPrompt,
      isTakeHomeStyle,
      isSimpleQAOrCaseStudyStyle,
      structuredTakeHomeAnalysis: isTakeHomeStyle ? structuredTakeHomeAnalysis : undefined,
    };

    const {output: draftAiOutput} = await draftPrompt(draftPromptInput);

    if (!draftAiOutput) {
      throw new Error('AI did not return draft feedback.');
    }

    // If it was take-home, the draftAiOutput.feedbackItems should ideally have one item
    // where fields were populated by the draftPrompt based on structuredTakeHomeAnalysis.
    // We ensure the reflectionPrompts are generated by the draftPrompt itself.
    let finalDraftFeedbackItems;
    if (isTakeHomeStyle && structuredTakeHomeAnalysis) {
        // The draftPrompt is now responsible for creating the reflectionPrompts.
        // We just need to ensure the draftAiOutput reflects what the prompt was asked to do.
        // The draftPrompt's output for feedbackItems should already be structured correctly
        // based on its instructions to copy from structuredTakeHomeAnalysis and add reflection prompts.
        finalDraftFeedbackItems = draftAiOutput.feedbackItems.map(aiItem => {
            const originalQuestion = input.questions.find(q => q.id === aiItem.questionId);
            const originalAnswer = input.answers.find(a => a.questionId === aiItem.questionId);
            return {
                questionId: aiItem.questionId,
                questionText: originalQuestion ? originalQuestion.text : "Assignment Text Not Found.",
                answerText: originalAnswer ? originalAnswer.answerText : "Submission Not Found.",
                critique: aiItem.critique || structuredTakeHomeAnalysis!.overallAssessment,
                strengths: aiItem.strengths && aiItem.strengths.length > 0 ? aiItem.strengths : structuredTakeHomeAnalysis!.strengthsOfSubmission,
                areasForImprovement: aiItem.areasForImprovement && aiItem.areasForImprovement.length > 0 ? aiItem.areasForImprovement : structuredTakeHomeAnalysis!.areasForImprovementInSubmission,
                specificSuggestions: aiItem.specificSuggestions && aiItem.specificSuggestions.length > 0 ? aiItem.specificSuggestions : structuredTakeHomeAnalysis!.actionableSuggestionsForRevision,
                idealAnswerPointers: originalQuestion?.idealAnswerCharacteristics || [],
                timeTakenMs: originalAnswer?.timeTakenMs,
                confidenceScore: originalAnswer?.confidenceScore,
                reflectionPrompts: aiItem.reflectionPrompts || [],
            };
        });
    } else {
         finalDraftFeedbackItems = draftAiOutput.feedbackItems.map(aiItem => {
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
                confidenceScore: originalAnswer ? originalAnswer.confidenceScore : undefined,
                reflectionPrompts: aiItem.reflectionPrompts || [],
            };
        });
    }


    const draftFeedbackForRefiner: GenerateInterviewFeedbackOutput = {
        feedbackItems: finalDraftFeedbackItems,
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
