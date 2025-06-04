'use strict';
/**
 * @fileOverview Generates the initial setup for a case study interview.
 * This flow provides the main scenario description, the first question to ask,
 * and internal notes to guide subsequent dynamic follow-up questions.
 *
 * - generateInitialCaseSetup - Function to generate the case study's starting point.
 * - GenerateInitialCaseSetupInput - Input type.
 * - GenerateInitialCaseSetupOutput - Output type for the initial case setup.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI, getTechnologyBriefTool as globalGetTechnologyBriefTool, findRelevantAssessmentsTool as globalFindRelevantAssessmentsTool } from '@/ai/genkit';
import {z, type Genkit as GenkitInstanceType, type ModelReference} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { defineGetTechnologyBriefTool } from '../tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool';
import { CustomizeInterviewQuestionsInputSchema, type CustomizeInterviewQuestionsInput } from '../schemas';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

export type GenerateInitialCaseSetupInput = CustomizeInterviewQuestionsInput;

const GenerateInitialCaseSetupOutputSchema = z.object({
  caseTitle: z.string().describe("A concise, engaging title for the case study (e.g., 'The Profile Gate Challenge', 'Revitalizing a Legacy System')."),
  fullScenarioDescription: z
    .string()
    .describe('The detailed narrative setup of the case study problem or situation. This is what the candidate reads to understand the context.'),
  firstQuestionToAsk: z
    .string()
    .describe('The very first question the interviewer should pose to the candidate based on the scenario description.'),
  idealAnswerCharacteristicsForFirstQuestion: z
    .array(z.string())
    .optional()
    .describe("Brief key characteristics a strong answer to this *first specific question* would demonstrate."),
  internalNotesForFollowUpGenerator: z
    .string()
    .describe('Concise internal notes, keywords, or key aspects of the case scenario. This will be passed to a subsequent AI flow that generates dynamic follow-up questions, helping it stay on topic and probe relevant areas.'),
});
export type GenerateInitialCaseSetupOutput = z.infer<
  typeof GenerateInitialCaseSetupOutputSchema
>;

const RAW_INITIAL_CASE_SETUP_PROMPT = loadPromptFile('generate-initial-case-setup.prompt');

export async function generateInitialCaseSetup(
  input: GenerateInitialCaseSetupInput,
  options?: { aiInstance?: GenkitInstanceType, tools?: any[], apiKey?: string, userGoogleAIPlugin?: any }
): Promise<GenerateInitialCaseSetupOutput> {
  let aiInstanceToUse: GenkitInstanceType = globalAI;
  let toolsToUse: any[];
  const flowNameForLogging = 'generateInitialCaseSetup';

  if (options?.aiInstance && options.aiInstance !== globalAI) {
    aiInstanceToUse = options.aiInstance;
    toolsToUse = options.tools || [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];
    console.log(`[BYOK] ${flowNameForLogging}: Using provided aiInstance and its tools.`);
  } else if (options?.apiKey) {
    try {
      const userGoogleAIPlugin = googleAI({ apiKey: options.apiKey });
      const userKitInstance = genkit({ plugins: [userGoogleAIPlugin] });
      aiInstanceToUse = userKitInstance;
      const techTool = await defineGetTechnologyBriefTool(userKitInstance);
      const assessTool = await defineFindRelevantAssessmentsTool(userKitInstance);
      toolsToUse = [techTool, assessTool];
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key and new tools for this instance.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize with user API key: ${(e as Error).message}. Falling back to global AI and tools.`);
      aiInstanceToUse = globalAI;
      toolsToUse = [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];
    }
  } else {
    aiInstanceToUse = globalAI;
    toolsToUse = [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];
    console.log(`[BYOK] ${flowNameForLogging}: Using default global AI instance and tools.`);
  }

  const saneInput: GenerateInitialCaseSetupInput = { 
    ...input, 
    interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value 
  };

  const contextForPrompt = {
    ...saneInput,
    renderAmazonLPsSection: saneInput.targetCompany?.toLowerCase() === 'amazon',
    amazonLpsList: saneInput.targetCompany?.toLowerCase() === 'amazon' 
      ? AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n') 
      : '',
  };

  try {
    const renderedPrompt = renderPromptTemplate(RAW_INITIAL_CASE_SETUP_PROMPT, contextForPrompt);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);

    console.log(`[BYOK] ${flowNameForLogging}: Calling aiInstanceToUse.generate()`);
    const generateResult = await aiInstanceToUse.generate<typeof GenerateInitialCaseSetupOutputSchema>({ 
      model: googleAI.model('gemini-1.5-flash-latest') as ModelReference<any>,
      prompt: renderedPrompt,
      tools: toolsToUse,
      output: { schema: GenerateInitialCaseSetupOutputSchema }, 
      config: { responseMimeType: 'application/json' },
    });
    
    let outputFromAI = generateResult.output;

    if (!outputFromAI) {
      console.warn(`[BYOK] ${flowNameForLogging}: AI response was null or undefined. Triggering fallback.`);
      outputFromAI = null;
    }
          
    if (!outputFromAI || !outputFromAI.fullScenarioDescription || !outputFromAI.firstQuestionToAsk) {
      console.warn(`${flowNameForLogging}: AI Case Study Generation Fallback - Essential fields missing or AI response issue. Input:`, saneInput);
      return {
        caseTitle: 'Fallback Case Study: Error Occurred',
        fullScenarioDescription: 'An unexpected error occurred while generating the case study scenario. Please try again or contact support if the issue persists.',
        firstQuestionToAsk: 'Please describe a past project or challenge you encountered.',
        idealAnswerCharacteristicsForFirstQuestion: ['Problem identification', 'Solution approach', 'Outcome/Learning'],
        internalNotesForFollowUpGenerator: 'Error during generation. Focus on general problem-solving.'
      };
    }
    return outputFromAI;

  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging} (input: ${JSON.stringify(input)}):`, error);
    return {
      caseTitle: 'Error Case Study: Generation Failed',
      fullScenarioDescription: `An error occurred while generating the case study: ${error instanceof Error ? error.message : 'Unknown error'}. Please review the inputs and try again.`,
      firstQuestionToAsk: 'Could you describe a significant challenge you faced in a previous role and how you addressed it?',
      idealAnswerCharacteristicsForFirstQuestion: ['Clear description of the challenge', 'Explanation of actions taken', 'Reflection on the outcome and learnings'],
      internalNotesForFollowUpGenerator: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Focus on general behavioral questions.`
    };
  }
}
