'use server';
/**
 * @fileOverview Generates a dynamic follow-up question for a case study interview.
 * This flow takes the initial case context, the conversation history, and the last user answer
 * to generate a relevant and probing next question.
 *
 * - generateDynamicCaseFollowUp - Function to generate the next follow-up question.
 * - GenerateDynamicCaseFollowUpInput - Input type for this flow.
 * - GenerateDynamicCaseFollowUpOutput - Output type for this flow.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI } from '@/ai/genkit';
import {z} from 'genkit';
import type { InterviewSetupData } from '@/lib/types';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const GenerateDynamicCaseFollowUpInputSchema = z.object({
  internalNotesFromInitialScenario: z
    .string()
    .describe('Concise internal notes, keywords, or key aspects from the initial case setup. This helps the AI stay on topic.'),
  previousQuestionText: z
    .string()
    .describe("The text of the question the user just answered."),
  previousUserAnswerText: z
    .string()
    .describe("The user's answer to the previous question."),
  conversationHistory: z
    .array(z.object({ questionText: z.string(), answerText: z.string() }))
    .optional()
    .describe("The history of questions and answers in this case study so far, to provide context and avoid repetition."),
  previousConversation: z // Added to ensure the full string transcript can be passed
    .string()
    .optional()
    .describe("The full string transcript of the conversation so far, including any clarifications."),
  interviewContext: z.custom<InterviewSetupData>()
    .describe("The overall context of the interview (type, level, focus, job title, etc.)."),
  currentTurnNumber: z
    .number()
    .min(1)
    .describe("The current turn number for follow-up questions (e.g., 1 for the first follow-up, 2 for the second, etc.). Helps in pacing the case."),
});
export type GenerateDynamicCaseFollowUpInput = z.infer<typeof GenerateDynamicCaseFollowUpInputSchema>;

const GenerateDynamicCaseFollowUpOutputSchema = z.object({
  followUpQuestionText: z
    .string()
    .describe('The dynamically generated follow-up question.'),
  idealAnswerCharacteristicsForFollowUp: z
    .array(z.string())
    .optional()
    .describe("Brief key characteristics a strong answer to this *new specific follow-up question* would demonstrate."),
  isLikelyFinalFollowUp: z
    .boolean()
    .describe("The AI's assessment of whether this follow-up is likely a good point to conclude the case study (e.g., after 3-5 total follow-ups, or if a natural conclusion is reached)."),
});
export type GenerateDynamicCaseFollowUpOutput = z.infer<typeof GenerateDynamicCaseFollowUpOutputSchema>;

const MAX_CASE_FOLLOW_UPS = 4;

const RAW_DYNAMIC_CASE_FOLLOW_UP_PROMPT = loadPromptFile("generate-dynamic-case-follow-up.prompt");

export async function generateDynamicCaseFollowUp(
  input: GenerateDynamicCaseFollowUpInput,
  options?: { aiInstance?: any, apiKey?: string }
): Promise<GenerateDynamicCaseFollowUpOutput> {
  let activeAI = globalAI;
  const flowNameForLogging = 'generateDynamicCaseFollowUp';

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
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize with user API key: ${(e as Error).message}. Falling back.`);
      // activeAI remains globalAI
    }
  } else {
     console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  if (input.currentTurnNumber > MAX_CASE_FOLLOW_UPS + 2) { // Add a little buffer
      return {
          followUpQuestionText: "Thank you, that concludes this case study.",
          idealAnswerCharacteristicsForFollowUp: [],
          isLikelyFinalFollowUp: true,
      };
  }

  const saneInput = { 
    ...input,
    interviewContext: {
      ...input.interviewContext,
      interviewerPersona: input.interviewContext.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    }
  };

  const contextForPrompt = {
    ...saneInput,
    renderAmazonLPsSection: saneInput.interviewContext?.targetCompany?.toLowerCase() === 'amazon',
    amazonLpsList: saneInput.interviewContext?.targetCompany?.toLowerCase() === 'amazon' 
      ? AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n') 
      : '', 
    maxCaseFollowUps: MAX_CASE_FOLLOW_UPS,
  };

  try {
    const renderedPrompt = renderPromptTemplate(RAW_DYNAMIC_CASE_FOLLOW_UP_PROMPT, contextForPrompt);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);

    const result = await activeAI.generate<typeof GenerateDynamicCaseFollowUpOutputSchema>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: GenerateDynamicCaseFollowUpOutputSchema },
        config: { responseMimeType: "application/json" },
    });

    const output = result.output;

    if (!output || !output.followUpQuestionText) {
        let fallbackText = "Could you elaborate on the potential risks of your proposed approach?";
        if (input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS) { 
            fallbackText = "Thanks for walking me through your thoughts. What would be your key success metrics for this initiative?";
        }
         return {
            followUpQuestionText: fallbackText,
            idealAnswerCharacteristicsForFollowUp: ["Identification of 2-3 key risks", "Plausible mitigation strategies for each"],
            isLikelyFinalFollowUp: input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS,
        };
    }

    let finalOutput = { ...output };
    if (input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS && !output.isLikelyFinalFollowUp) {
        finalOutput.isLikelyFinalFollowUp = true;
    }

    return finalOutput;

  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging} (Input: ${JSON.stringify(saneInput, null, 2)}):`, error);
    // Provide a user-friendly fallback question in case of error
    return {
        followUpQuestionText: "There was an issue generating the next question. Let's try a different angle: Can you summarize the key trade-offs you've considered so far in this case?",
        idealAnswerCharacteristicsForFollowUp: ["Clear articulation of 2-3 trade-offs", "Justification for choices made or proposed"],
        isLikelyFinalFollowUp: input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS, 
    };
  }
}