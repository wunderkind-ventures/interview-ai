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

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import { refineInterviewFeedback } from './refine-interview-feedback';
import type { RefineInterviewFeedbackInput } from './refine-interview-feedback';
import { FeedbackItemSchema, GenerateInterviewFeedbackOutputSchema } from '../schemas'; 
import type { GenerateInterviewFeedbackOutput } from '../schemas';
import { analyzeTakeHomeSubmission } from './analyze-take-home-submission'; 
import type { AnalyzeTakeHomeSubmissionInput, AnalyzeTakeHomeSubmissionOutput, AnalyzeTakeHomeSubmissionContext } from '@/lib/types'; 
import { INTERVIEW_TYPES, FAANG_LEVELS, INTERVIEW_STYLES, SKILLS_BY_ROLE, RoleType as RoleTypeFromConstants } from '@/lib/constants';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';
import { defineGetTechnologyBriefTool } from '../tools/technology-tools';

// Input schema for the data needed by the initial prompt template
const DraftPromptInputSchema = z.object({
  interviewType: z.string(),
  faangLevel: z.string().describe("The target FAANG level, influencing expected depth and quality of answers."),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
  interviewFocus: z.string().optional(),
  evaluatedSkills: z.array(z.string()).optional().describe("The specific skills that were evaluated or targeted during this interview session."),
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
  isTakeHomeStyle: z.boolean(), 
  isSimpleQAOrCaseStudyStyle: z.boolean(), 
  structuredTakeHomeAnalysis: z.custom<AnalyzeTakeHomeSubmissionOutput>().optional().describe("Detailed analysis if it's a take-home assignment."),
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
  feedbackItems: z 
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
  interviewType: z.enum(
    ['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms']
  ).describe("The type of the interview."),
   interviewStyle: z.enum(['simple-qa', 'case-study', 'take-home'])
    .describe('The style of the interview: simple Q&A or multi-turn case study or take home.'),
  faangLevel: z
    .string()
    .describe('The target FAANG complexity level of the interview.'),
  roleType: z.custom<RoleTypeFromConstants>().optional().describe("The selected role type for the interview."),
  targetedSkills: z.array(z.string()).optional().describe("Specific skills targeted during the interview generation phase."),
  jobTitle: z.string().optional().describe('The job title, if provided.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description, if provided.'),
  resume: z.string().optional().describe('The candidate resume, if provided.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'),
});
export type GenerateInterviewFeedbackInput = z.infer<typeof GenerateInterviewFeedbackInputSchema>;

const RAW_DRAFT_FEEDBACK_PROMPT_TEMPLATE = loadPromptFile("generate-interview-feedback-draft.prompt");

export async function generateInterviewFeedback(
  input: GenerateInterviewFeedbackInput,
  options?: { apiKey?: string }
): Promise<GenerateInterviewFeedbackOutput> {
  const flowNameForLogging = 'generateInterviewFeedback';
  let activeAI = globalAi;
  let getTechnologyBriefTool: any;

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      // Define the tool on the BYOK instance
      getTechnologyBriefTool = await defineGetTechnologyBriefTool(activeAI);
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back to global AI.`);
      activeAI = globalAi;
      // Import the global tool when falling back
      const { getTechnologyBriefTool: globalTool } = await import('@/ai/genkit');
      getTechnologyBriefTool = globalTool;
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key provided; using default global AI instance.`);
    // Import the global tool
    const { getTechnologyBriefTool: globalTool } = await import('@/ai/genkit');
    getTechnologyBriefTool = globalTool;
  }

  console.log(`[BYOK] ${flowNameForLogging}: Input received:`, JSON.stringify(input, null, 2));

  const isTakeHome = input.interviewStyle === 'take-home';
  let structuredTakeHomeAnalysisData: AnalyzeTakeHomeSubmissionOutput | undefined = undefined;

  if (isTakeHome) {
    if (!input.questions[0] || !input.answers[0]) {
      throw new Error("Take-home style interview requires at least one question and one answer.");
    }
    const takeHomeInput: AnalyzeTakeHomeSubmissionInput = {
      assignmentText: input.questions[0].text,
      userSubmissionText: input.answers[0].answerText,
      idealSubmissionCharacteristics: input.questions[0].idealAnswerCharacteristics || [],
      interviewContext: {
        interviewType: input.interviewType,
        faangLevel: input.faangLevel,
        jobTitle: input.jobTitle,
        interviewFocus: input.interviewFocus,
      }
    };
    console.log(`[BYOK] ${flowNameForLogging}: Calling analyzeTakeHomeSubmission with input:`, JSON.stringify(takeHomeInput, null, 2));
    structuredTakeHomeAnalysisData = await analyzeTakeHomeSubmission(takeHomeInput, options);
    console.log(`[BYOK] ${flowNameForLogging}: Received structured analysis for take-home:`, JSON.stringify(structuredTakeHomeAnalysisData, null, 2));
  }

  const questionsAndAnswersPromptData = input.questions.map((q, index) => {
    const answer = input.answers.find(a => a.questionId === q.id);
    if (!answer) {
      console.warn(`${flowNameForLogging}: No answer found for questionId ${q.id}. This might affect feedback quality.`);
      return {
        questionId: q.id,
        questionText: q.text,
        answerText: '[No answer provided]',
        timeTakenMs: undefined,
        indexPlusOne: index + 1,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics || [],
        confidenceScore: undefined,
      };
    }
    return {
      questionId: q.id,
      questionText: q.text,
      answerText: answer.answerText,
      timeTakenMs: answer.timeTakenMs,
      indexPlusOne: index + 1,
      idealAnswerCharacteristics: q.idealAnswerCharacteristics || [],
      confidenceScore: answer.confidenceScore,
    };
  });

  const draftPromptInputData: z.infer<typeof DraftPromptInputSchema> = {
    interviewType: input.interviewType,
    faangLevel: input.faangLevel,
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    resume: input.resume,
    interviewFocus: input.interviewFocus,
    evaluatedSkills: input.targetedSkills, 
    questionsAndAnswers: questionsAndAnswersPromptData,
    isTakeHomeStyle: isTakeHome,
    isSimpleQAOrCaseStudyStyle: !isTakeHome,
    structuredTakeHomeAnalysis: structuredTakeHomeAnalysisData,
  };
  
  console.log(`[BYOK] ${flowNameForLogging}: Data prepared for draft prompt:`, JSON.stringify(draftPromptInputData, null, 2));

  const renderedDraftPrompt = renderPromptTemplate(RAW_DRAFT_FEEDBACK_PROMPT_TEMPLATE, draftPromptInputData);
  console.log(`[BYOK] ${flowNameForLogging}: Rendered Draft Prompt:\n`, renderedDraftPrompt);

  const toolsToUse = getTechnologyBriefTool ? [getTechnologyBriefTool] : [];

  console.log(`[BYOK] ${flowNameForLogging}: Calling AI.generate for draft feedback with model and tools...`);
  const draftFeedbackResult = await activeAI.generate<typeof AIDraftOutputSchema>({
    prompt: renderedDraftPrompt,
    model: googleAI.model('gemini-1.5-pro-latest'),
    output: { schema: AIDraftOutputSchema },
    tools: toolsToUse.length > 0 ? toolsToUse : undefined,
    config: { responseMimeType: "application/json" },
  });

  const draftAIOutput = draftFeedbackResult.output;

  if (!draftAIOutput) {
    console.error(`${flowNameForLogging}: Draft feedback generation failed - AI output was null.`);
    throw new Error('Draft feedback generation failed to produce an output.');
  }
  console.log(`[BYOK] ${flowNameForLogging}: Received draft AI output:`, JSON.stringify(draftAIOutput, null, 2));

  const feedbackItems: z.infer<typeof FeedbackItemSchema>[] = draftAIOutput.feedbackItems.map(item => {
    const question = input.questions.find(q => q.id === item.questionId);
    return {
      questionId: item.questionId,
      questionText: question ? question.text : 'Unknown Question',
      answerText: input.answers.find(a => a.questionId === item.questionId)?.answerText || 'N/A',
      critique: item.critique || '',
      strengths: item.strengths || [],
      areasForImprovement: item.areasForImprovement || [],
      specificSuggestions: item.specificSuggestions || [],
      idealAnswerPointers: item.idealAnswerPointers || [],
      reflectionPrompts: item.reflectionPrompts || [],
      timeTakenMs: input.answers.find(a => a.questionId === item.questionId)?.timeTakenMs,
      confidenceScore: input.answers.find(a => a.questionId === item.questionId)?.confidenceScore,
    };
  });

  const initialFeedbackOutput: GenerateInterviewFeedbackOutput = {
    overallSummary: draftAIOutput.overallSummary,
    feedbackItems: feedbackItems,
  };
  console.log(`[BYOK] ${flowNameForLogging}: Initial feedback output (pre-refinement):`, JSON.stringify(initialFeedbackOutput, null, 2));

  const refineInput: RefineInterviewFeedbackInput = {
    draftFeedback: initialFeedbackOutput,
    interviewContext: {
      interviewType: input.interviewType,
      interviewStyle: input.interviewStyle,
      faangLevel: input.faangLevel,
      jobTitle: input.jobTitle,
      interviewFocus: input.interviewFocus,
      timeWasTracked: input.answers.some(a => a.timeTakenMs !== undefined && a.timeTakenMs > 0),
    },
  };
  console.log(`[BYOK] ${flowNameForLogging}: Calling refineInterviewFeedback with input:`, JSON.stringify(refineInput, null, 2));
  
  const refinedOutput = await refineInterviewFeedback(refineInput, options);
  console.log(`[BYOK] ${flowNameForLogging}: Final refined output:`, JSON.stringify(refinedOutput, null, 2));
  return refinedOutput;
}
