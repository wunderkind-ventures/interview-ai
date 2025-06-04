'use server';
/**
 * @fileOverview Generates "deep dive" feedback for a specific interview question and answer.
 *
 * - generateDeepDiveFeedback - A function that provides detailed analysis for a question.
 * - GenerateDeepDiveFeedbackInput - The input type for the deep dive generation.
 * - GenerateDeepDiveFeedbackOutput - The return type containing detailed feedback components.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import type { FeedbackItem } from '@/lib/types';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

// Input schema for the data needed by the prompt template (internal)
const DeepDivePromptInputSchemaInternal = z.object({
  questionText: z.string().describe('The original interview question.'),
  userAnswerText: z.string().describe("The user's answer to the question."),
  interviewType: z.string().describe('The overall type of the interview (e.g., "product sense", "machine learning", "data structures & algorithms").'),
  faangLevel: z.string().describe('The target FAANG complexity level of the interview. This should influence the depth and rigor of the ideal answer and alternative approaches.'),
  jobTitle: z.string().optional().describe('The job title, if provided.'),
  jobDescription: z.string().optional().describe('The job description, if provided.'),
  targetedSkills: z.array(z.string()).optional().describe('Specific skills the user focused on.'),
  interviewFocus: z.string().optional().describe('The specific focus of the interview, if provided.'),
  originalCritique: z.string().optional().describe('The initial critique provided for this answer, if any.'),
  originalStrengths: z.array(z.string()).optional().describe('Initial strengths identified, if any.'),
  originalAreasForImprovement: z.array(z.string()).optional().describe('Initial areas for improvement, if any.'),
  idealAnswerCharacteristics: z.array(z.string()).optional().describe("Pre-defined characteristics of a strong answer to this specific question, to be used as a benchmark."),
});

// Schema for what the AI model is expected to return
const DeepDiveOutputSchemaInternal = z.object({
  detailedIdealAnswerBreakdown: z
    .array(z.string())
    .describe('A step-by-step breakdown or key structural components of an ideal answer to this specific question, tailored to the faangLevel. This should be informed by any provided idealAnswerCharacteristics.'),
  alternativeApproaches: z
    .array(z.string())
    .describe('Different valid perspectives, frameworks, or methods the candidate could have used to approach this question, reflecting the sophistication expected at the faangLevel.'),
  followUpScenarios: z
    .array(z.string())
    .describe('A few hypothetical "what if" or probing follow-up questions an interviewer might ask based on the original question or typical answer patterns. These should push the candidate to think deeper, considering the faangLevel.'),
  suggestedStudyConcepts: z
    .array(z.string())
    .describe('Key concepts, technologies, or areas of knowledge relevant to the question that the candidate might benefit from studying further to meet faangLevel expectations.'),
});
export type GenerateDeepDiveFeedbackOutput = z.infer<typeof DeepDiveOutputSchemaInternal>;


// Input schema for the exported flow function
const GenerateDeepDiveFeedbackInputSchemaInternal = z.object({
  questionText: z.string(),
  userAnswerText: z.string(),
  interviewType: z.string(),
  faangLevel: z.string(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  targetedSkills: z.array(z.string()).optional(),
  interviewFocus: z.string().optional(),
  originalFeedback: z.custom<FeedbackItem>().optional().describe('The original feedback item for this question, if available.'),
  idealAnswerCharacteristics: z.array(z.string()).optional(),
});
export type GenerateDeepDiveFeedbackInput = z.infer<typeof GenerateDeepDiveFeedbackInputSchemaInternal>;

export async function generateDeepDiveFeedback(
  input: GenerateDeepDiveFeedbackInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<GenerateDeepDiveFeedbackOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'generateDeepDiveFeedback';

  if (options?.aiInstance) {
    activeAI = options.aiInstance;
    console.log(`[BYOK] ${flowNameForLogging}: Using provided aiInstance.`);
  } else if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with user-provided API key: ${(e as Error).message}. Falling back to default.`);
      activeAI = globalAi;
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  const promptInput: z.infer<typeof DeepDivePromptInputSchemaInternal> = {
    questionText: input.questionText,
    userAnswerText: input.userAnswerText,
    interviewType: input.interviewType,
    faangLevel: input.faangLevel,
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    targetedSkills: input.targetedSkills,
    interviewFocus: input.interviewFocus,
    originalCritique: input.originalFeedback?.critique,
    originalStrengths: input.originalFeedback?.strengths,
    originalAreasForImprovement: input.originalFeedback?.areasForImprovement,
    idealAnswerCharacteristics: input.idealAnswerCharacteristics,
  };

  try {
    const RAW_DEEP_DIVE_PROMPT = loadPromptFile("generate-deep-dive-feedback.prompt");
    if (!RAW_DEEP_DIVE_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load generate-deep-dive-feedback.prompt.`);
      throw new Error('Critical: Could not load generate-deep-dive-feedback.prompt. Prompt file is essential for this flow.');
    }
    const renderedPrompt = renderPromptTemplate(RAW_DEEP_DIVE_PROMPT, promptInput);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof DeepDiveOutputSchemaInternal>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: DeepDiveOutputSchemaInternal },
        config: { responseMimeType: "application/json" },
      });
    
    const output = result.output;
    if (!output) {
      console.error(`[${flowNameForLogging}] AI did not return deep dive feedback or failed to parse.`);
      throw new Error('AI did not return deep dive feedback.');
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    // Consider returning a structured error that matches GenerateDeepDiveFeedbackOutput
    // For now, rethrowing to be handled by the caller or a generic error handler.
    throw error;
  }
}

    