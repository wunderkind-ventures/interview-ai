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
import { ai as globalAi, getTechnologyBriefTool } from '@/ai/genkit';
import {z} from 'genkit';
import { refineInterviewFeedback } from './refine-interview-feedback';
import type { RefineInterviewFeedbackInput } from './refine-interview-feedback';
import { FeedbackItemSchema, GenerateInterviewFeedbackOutputSchema } from '../schemas'; 
import type { GenerateInterviewFeedbackOutput } from '../schemas';
import { analyzeTakeHomeSubmission } from './analyze-take-home-submission'; 
import type { AnalyzeTakeHomeSubmissionInput, AnalyzeTakeHomeSubmissionOutput, AnalyzeTakeHomeSubmissionContext } from '@/lib/types';
import { defineGetTechnologyBriefTool } from '@/ai/tools/technology-tools';
import { INTERVIEW_TYPES, FAANG_LEVELS, INTERVIEW_STYLES, SKILLS_BY_ROLE, RoleType as RoleTypeFromConstants } from '@/lib/constants';

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

// Extract the prompt template as a constant
const DRAFT_FEEDBACK_PROMPT_TEMPLATE = `You are an expert career coach and interviewer, providing detailed, structured DRAFT feedback for a mock interview session.
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
{{#if evaluatedSkills.length}}

The following skills were specifically targeted or evaluated in this session:
{{#each evaluatedSkills}}
- {{{this}}}
{{/each}}
Your feedback, particularly the overall summary and suggestions, should consider how the candidate demonstrated these skills.
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
`;

// Template customization function to replace placeholders with actual values
const customizeDraftFeedbackPromptText = (template: string, input: z.infer<typeof DraftPromptInputSchema>): string => {
  let promptText = template;
  
  // Replace basic placeholders
  promptText = promptText.replace(/{{interviewType}}/g, input.interviewType);
  promptText = promptText.replace(/{{faangLevel}}/g, input.faangLevel);
  
  // Handle optional fields with conditional blocks
  if (input.jobTitle) {
    promptText = promptText.replace(
      /{{#if jobTitle}}[\s\S]*?{{{jobTitle}}}[\s\S]*?{{\/if}}/,
      `The interview was for the role of: ${input.jobTitle}`
    );
  } else {
    promptText = promptText.replace(/{{#if jobTitle}}[\s\S]*?{{\/if}}/g, '');
  }
  
  if (input.jobDescription) {
    promptText = promptText.replace(
      /{{#if jobDescription}}[\s\S]*?{{{jobDescription}}}[\s\S]*?{{\/if}}/,
      `The interview was for a role with the following job description:\n${input.jobDescription}`
    );
  } else {
    promptText = promptText.replace(/{{#if jobDescription}}[\s\S]*?{{\/if}}/g, '');
  }
  
  if (input.resume) {
    promptText = promptText.replace(
      /{{#if resume}}[\s\S]*?{{{resume}}}[\s\S]*?{{\/if}}/,
      `The candidate's resume is as follows:\n${input.resume}`
    );
  } else {
    promptText = promptText.replace(/{{#if resume}}[\s\S]*?{{\/if}}/g, '');
  }
  
  if (input.interviewFocus) {
    promptText = promptText.replace(
      /{{#if interviewFocus}}[\s\S]*?{{{interviewFocus}}}[\s\S]*?{{\/if}}/,
      `The specific focus for this interview was: ${input.interviewFocus}`
    );
  } else {
    promptText = promptText.replace(/{{#if interviewFocus}}[\s\S]*?{{\/if}}/g, '');
  }
  
  // Handle conditional sections for interview styles
  if (input.isTakeHomeStyle) {
    // Extract and process only the take-home section
    const takeHomeMatch = promptText.match(/{{#if isTakeHomeStyle}}([\s\S]*?){{\/if}}/);
    const simpleQAMatch = promptText.match(/{{#if isSimpleQAOrCaseStudyStyle}}([\s\S]*?){{\/if}}/);
    
    if (takeHomeMatch && simpleQAMatch) {
      let takeHomeContent = takeHomeMatch[1];
      
      // Process take-home specific placeholders
      if (input.questionsAndAnswers && input.questionsAndAnswers.length > 0) {
        const firstQ = input.questionsAndAnswers[0];
        takeHomeContent = takeHomeContent.replace(/{{{questionsAndAnswers\.0\.questionText}}}/g, firstQ.questionText);
        takeHomeContent = takeHomeContent.replace(/{{{questionsAndAnswers\.0\.answerText}}}/g, firstQ.answerText);
        takeHomeContent = takeHomeContent.replace(/{{questionsAndAnswers\.0\.questionId}}/g, firstQ.questionId);
        
        // Handle ideal answer characteristics
        if (firstQ.idealAnswerCharacteristics && firstQ.idealAnswerCharacteristics.length > 0) {
          const charList = firstQ.idealAnswerCharacteristics.map(char => `- ${char}`).join('\n');
          takeHomeContent = takeHomeContent.replace(
            /{{#if questionsAndAnswers\.0\.idealAnswerCharacteristics\.length}}[\s\S]*?{{#each questionsAndAnswers\.0\.idealAnswerCharacteristics}}[\s\S]*?{{{this}}}[\s\S]*?{{\/each}}[\s\S]*?{{\/if}}/,
            `Ideal Submission Characteristics for this Assignment (from assignment design):\n${charList}`
          );
        } else {
          takeHomeContent = takeHomeContent.replace(
            /{{#if questionsAndAnswers\.0\.idealAnswerCharacteristics\.length}}[\s\S]*?{{\/if}}/g,
            ''
          );
        }
        
        // Handle structured analysis
        if (input.structuredTakeHomeAnalysis) {
          const analysis = input.structuredTakeHomeAnalysis;
          takeHomeContent = takeHomeContent.replace(/{{{structuredTakeHomeAnalysis\.overallAssessment}}}/g, analysis.overallAssessment);
          
          // Replace strengths
          const strengthsList = analysis.strengthsOfSubmission.map(s => `  - ${s}`).join('\n');
          takeHomeContent = takeHomeContent.replace(
            /{{#each structuredTakeHomeAnalysis\.strengthsOfSubmission}}[\s\S]*?{{{this}}}[\s\S]*?{{\/each}}/,
            strengthsList
          );
          
          // Replace areas for improvement
          const improvementsList = analysis.areasForImprovementInSubmission.map(a => `  - ${a}`).join('\n');
          takeHomeContent = takeHomeContent.replace(
            /{{#each structuredTakeHomeAnalysis\.areasForImprovementInSubmission}}[\s\S]*?{{{this}}}[\s\S]*?{{\/each}}/,
            improvementsList
          );
          
          // Replace suggestions
          const suggestionsList = analysis.actionableSuggestionsForRevision.map(s => `  - ${s}`).join('\n');
          takeHomeContent = takeHomeContent.replace(
            /{{#each structuredTakeHomeAnalysis\.actionableSuggestionsForRevision}}[\s\S]*?{{{this}}}[\s\S]*?{{\/each}}/,
            suggestionsList
          );
        }
      }
      
      // Replace both sections with only the processed take-home content
      promptText = promptText.replace(/{{#if isTakeHomeStyle}}[\s\S]*?{{\/if}}/, takeHomeContent);
      promptText = promptText.replace(/{{#if isSimpleQAOrCaseStudyStyle}}[\s\S]*?{{\/if}}/, '');
    }
  } else if (input.isSimpleQAOrCaseStudyStyle) {
    // Extract and process only the simple Q&A section
    const takeHomeMatch = promptText.match(/{{#if isTakeHomeStyle}}([\s\S]*?){{\/if}}/);
    const simpleQAMatch = promptText.match(/{{#if isSimpleQAOrCaseStudyStyle}}([\s\S]*?){{\/if}}/);
    
    if (takeHomeMatch && simpleQAMatch) {
      let simpleQAContent = simpleQAMatch[1];
      
      // Process questions and answers
      if (input.questionsAndAnswers && input.questionsAndAnswers.length > 0) {
        const qaList = input.questionsAndAnswers.map(qa => {
          let qaText = `Question ${qa.indexPlusOne} (ID: ${qa.questionId}): ${qa.questionText}`;
          
          if (qa.idealAnswerCharacteristics && qa.idealAnswerCharacteristics.length > 0) {
            qaText += '\nIdeal Answer Characteristics for this Question:\n';
            qaText += qa.idealAnswerCharacteristics.map(char => `- ${char}`).join('\n');
          }
          
          qaText += `\nAnswer: ${qa.answerText}`;
          
          if (qa.timeTakenMs !== undefined) {
            qaText += `\n(Time taken: ${qa.timeTakenMs} ms)`;
          }
          
          if (qa.confidenceScore !== undefined) {
            qaText += `\nUser Confidence (1-5 stars): ${qa.confidenceScore}`;
          }
          
          qaText += '\n---';
          return qaText;
        }).join('\n');
        
        simpleQAContent = simpleQAContent.replace(
          /{{#each questionsAndAnswers}}[\s\S]*?{{\/each}}/,
          qaList
        );
      }
      
      // Replace both sections with only the processed simple Q&A content
      promptText = promptText.replace(/{{#if isTakeHomeStyle}}[\s\S]*?{{\/if}}/, '');
      promptText = promptText.replace(/{{#if isSimpleQAOrCaseStudyStyle}}[\s\S]*?{{\/if}}/, simpleQAContent);
    }
  }
  
  return promptText;
};

// No longer need the definePrompt since we're using generate() with customized prompts
// const draftPromptObj = globalAi.definePrompt({
//   name: 'generateDraftInterviewFeedbackPrompt',
//   tools: [getTechnologyBriefTool],
//   input: {schema: DraftPromptInputSchema},
//   output: {schema: AIDraftOutputSchema},
//   prompt: DRAFT_FEEDBACK_PROMPT_TEMPLATE,
// });

export async function generateInterviewFeedback(
  input: GenerateInterviewFeedbackInput,
  options?: { apiKey?: string }
): Promise<GenerateInterviewFeedbackOutput> {
  let activeAI = globalAi;
  let isByokPath = false;
  const flowNameForLogging = 'generateInterviewFeedback';

  // Construct questionsAndAnswers separately to help with type inference
  let preparedQuestionsAndAnswers = input.questions.map((q, index) => {
    const answer = input.answers.find(a => a.questionId === q.id);
    return {
      questionId: q.id.toString(),
      questionText: q.text,
      answerText: answer?.answerText || "", // Default to empty string if no answer
      timeTakenMs: answer?.timeTakenMs,
      indexPlusOne: index + 1,
      idealAnswerCharacteristics: q.idealAnswerCharacteristics,
      confidenceScore: answer?.confidenceScore,
    };
  });

  if (input.interviewStyle === 'simple-qa') {
    preparedQuestionsAndAnswers = preparedQuestionsAndAnswers.filter(qa => qa.answerText.trim() !== "");
  }

  const draftPromptInput: z.infer<typeof DraftPromptInputSchema> = {
    interviewType: input.interviewType,
    faangLevel: input.faangLevel,
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    resume: input.resume,
    interviewFocus: input.interviewFocus,
    evaluatedSkills: input.targetedSkills, // Use targetedSkills from input for evaluatedSkills
    questionsAndAnswers: preparedQuestionsAndAnswers, // Assign the pre-constructed array
    isTakeHomeStyle: input.interviewStyle === 'take-home',
    isSimpleQAOrCaseStudyStyle: input.interviewStyle === 'simple-qa' || input.interviewStyle === 'case-study',
    structuredTakeHomeAnalysis: undefined, 
  };

  if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      isByokPath = true;
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
      // activeAI remains globalAi
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No user API key provided; using default global AI instance.`);
    // No specific tool handling here for global, as it's passed directly in generate
  }

  let structuredTakeHomeAnalysis: AnalyzeTakeHomeSubmissionOutput | undefined = undefined;
  
  if (input.interviewStyle === 'take-home' && input.questions.length > 0 && input.answers.length > 0) {
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
      // Call analyzeTakeHomeSubmission with the correct AI instance
      structuredTakeHomeAnalysis = await analyzeTakeHomeSubmission(analysisInput, { aiInstance: activeAI });
    } catch (analysisError) {
      console.error("Error during take-home submission analysis:", analysisError);
      structuredTakeHomeAnalysis = {
        overallAssessment: "Error: Could not analyze take-home submission.",
        strengthsOfSubmission: [],
        areasForImprovementInSubmission: [],
        actionableSuggestionsForRevision: [],
      };
    }
  }

  // Map to the input structure expected by the AI prompt template
  const draftPromptInputFinal: z.infer<typeof DraftPromptInputSchema> = {
    ...draftPromptInput,
    structuredTakeHomeAnalysis: input.interviewStyle === 'take-home' ? structuredTakeHomeAnalysis : undefined,
  };

  try {
    console.log(`[BYOK] ${flowNameForLogging}: Generating DRAFT feedback with AI.`);
    console.log(`[DEBUG] Interview style: ${input.interviewStyle}, Questions count: ${input.questions.length}`);
    
    let aiOutput: z.infer<typeof AIDraftOutputSchema> | null = null;

    if (isByokPath) {
      // BYOK path: use generate() with interpolated prompt
      const customizedPrompt = customizeDraftFeedbackPromptText(DRAFT_FEEDBACK_PROMPT_TEMPLATE, draftPromptInputFinal);
      
      const result = await activeAI.generate<typeof AIDraftOutputSchema>({
        prompt: customizedPrompt,
        context: draftPromptInputFinal,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: AIDraftOutputSchema },
        config: { responseMimeType: "application/json" },
        tools: [getTechnologyBriefTool], // Pass tool definition directly
      });
      aiOutput = result.output;
    } else {
      // Global path: use generate() with interpolated prompt and global AI tools
      const customizedPrompt = customizeDraftFeedbackPromptText(DRAFT_FEEDBACK_PROMPT_TEMPLATE, draftPromptInputFinal);
      
      const result = await globalAi.generate<typeof AIDraftOutputSchema>({
        prompt: customizedPrompt,
        context: draftPromptInputFinal,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: AIDraftOutputSchema },
        config: { responseMimeType: "application/json" },
        tools: [getTechnologyBriefTool], // Pass tool definition directly
      });
      aiOutput = result.output;
    }

    if (!aiOutput) {
        console.error('[BYOK] AI generation returned null output.');
        throw new Error("AI generation failed to produce an output.");
    }
    
    if (!aiOutput.feedbackItems || !aiOutput.overallSummary) {
      console.error('[BYOK] AI output is missing essential parts (feedbackItems or overallSummary).', aiOutput);
      throw new Error("AI draft feedback is missing essential parts.");
    }
    
    console.log(`[DEBUG] Draft feedback generated with ${aiOutput.feedbackItems.length} feedback items`);
    
    // More detailed debug logging
    if (aiOutput.feedbackItems.length === 0) {
      console.error('[DEBUG] WARNING: No feedback items generated!');
      console.log('[DEBUG] Questions provided:', input.questions.length);
      console.log('[DEBUG] Answers provided:', input.answers.length);
    } else {
      console.log('[DEBUG] Feedback items question IDs:', aiOutput.feedbackItems.map(item => item.questionId));
    }

    // Prepare input for refinement step
    const refinementInput: RefineInterviewFeedbackInput = {
      draftFeedback: {
        feedbackItems: aiOutput.feedbackItems.map((aiItem: z.infer<typeof AIDraftFeedbackItemSchema>) => ({
          questionId: aiItem.questionId.toString(),
          questionText: input.questions.find(q => q.id === aiItem.questionId)?.text || "Unknown Question",
          answerText: input.answers.find(a => a.questionId === aiItem.questionId)?.answerText || "No answer provided.",
          timeTakenMs: input.answers.find(a => a.questionId === aiItem.questionId)?.timeTakenMs,
          confidenceScore: input.answers.find(a => a.questionId === aiItem.questionId)?.confidenceScore,
          strengths: aiItem.strengths,
          areasForImprovement: aiItem.areasForImprovement,
          specificSuggestions: aiItem.specificSuggestions,
          critique: aiItem.critique,
          idealAnswerPointers: aiItem.idealAnswerPointers,
          reflectionPrompts: aiItem.reflectionPrompts,
          rating: 0,
          ratingJustification: "",
          suggestedScore: 0,
          tags: [],
          idealAnswerCharacteristics: input.questions.find(q => q.id === aiItem.questionId)?.idealAnswerCharacteristics || [],
        })),
        overallSummary: aiOutput.overallSummary,
      },
      interviewContext: {
        interviewType: input.interviewType,
        interviewStyle: input.interviewStyle,
        faangLevel: input.faangLevel,
        jobTitle: input.jobTitle,
        interviewFocus: input.interviewFocus,
        timeWasTracked: input.answers.some(a => a.timeTakenMs !== undefined),
      }
    };

    const finalFeedbackOutput = await refineInterviewFeedback(refinementInput, { apiKey: options?.apiKey });
    
    // Debug logging for final output
    console.log(`[DEBUG] Final feedback after refinement: ${finalFeedbackOutput.feedbackItems.length} items`);
    if (finalFeedbackOutput.feedbackItems.length === 0) {
      console.error('[DEBUG] WARNING: Refinement removed all feedback items!');
    }

    return {
      feedbackItems: finalFeedbackOutput.feedbackItems.map(item => ({
        ...item,
        questionId: item.questionId.toString(),
      })),
      overallSummary: finalFeedbackOutput.overallSummary,
    };
  } catch (error) {
    console.error("Error during feedback generation:", error);
    throw error;
  }
}
