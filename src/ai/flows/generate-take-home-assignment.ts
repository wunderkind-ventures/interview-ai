'use server';
/**
 * @fileOverview Generates a detailed take-home assignment for various interview types.
 *
 * - generateTakeHomeAssignment - A function that creates a take-home assignment.
 * - GenerateTakeHomeAssignmentInput - The input type for the assignment generation.
 * - GenerateTakeHomeAssignmentOutput - The return type containing the assignment text.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI, getTechnologyBriefTool as globalGetTechnologyBriefTool, findRelevantAssessmentsTool as globalFindRelevantAssessmentsTool } from '@/ai/genkit';
import { z, type Genkit as GenkitInstanceType, type ModelReference } from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { defineGetTechnologyBriefTool } from '../tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool';
import { CustomizeInterviewQuestionsInputSchema, type CustomizeInterviewQuestionsInput } from '../schemas';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

export type GenerateTakeHomeAssignmentInput = CustomizeInterviewQuestionsInput;

const GenerateTakeHomeAssignmentOutputSchema = z.object({
  assignmentText: z
    .string()
    .describe('The full text of the generated take-home assignment, formatted with Markdown-like headings.'),
  idealSubmissionCharacteristics: z.array(z.string()).optional().describe("Key characteristics or elements a strong submission for this take-home assignment would demonstrate, considering the problem, deliverables, and FAANG level."),
});
export type GenerateTakeHomeAssignmentOutput = z.infer<
  typeof GenerateTakeHomeAssignmentOutputSchema
>;

const RAW_TAKE_HOME_PROMPT_TEMPLATE = loadPromptFile("generate-take-home-assignment.prompt");

export async function generateTakeHomeAssignment(
  input: GenerateTakeHomeAssignmentInput,
  options?: { aiInstance?: GenkitInstanceType, tools?: any[], apiKey?: string }
): Promise<GenerateTakeHomeAssignmentOutput> {
  let aiInstanceToUse: GenkitInstanceType = globalAI;
  let toolsToUse: any[];
  const flowNameForLogging = 'generateTakeHomeAssignment';

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

  const saneInput: GenerateTakeHomeAssignmentInput = {
    ...input,
    interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
  };
  
  const contextForPrompt = {
    ...saneInput,
    renderAmazonLPsSection: saneInput.targetCompany?.toLowerCase() === 'amazon',
    amazonLpsList: saneInput.targetCompany?.toLowerCase() === 'amazon' 
      ? AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n') 
      : '',
  };

  try {
    const renderedPrompt = renderPromptTemplate(RAW_TAKE_HOME_PROMPT_TEMPLATE, contextForPrompt);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt);

    console.log(`[BYOK] ${flowNameForLogging}: Calling aiInstanceToUse.generate()`);
    const generateResult = await aiInstanceToUse.generate<typeof GenerateTakeHomeAssignmentOutputSchema>({
      model: googleAI.model('gemini-1.5-flash-latest') as ModelReference<any>,
      prompt: renderedPrompt,
      tools: toolsToUse,
      output: { schema: GenerateTakeHomeAssignmentOutputSchema },
      config: { responseMimeType: "application/json" },
    });
    let outputFromAI = generateResult.output;

    if (!outputFromAI || !outputFromAI.assignmentText || !outputFromAI.idealSubmissionCharacteristics || outputFromAI.idealSubmissionCharacteristics.length === 0) {
        console.warn(`[BYOK] ${flowNameForLogging}: AI output was missing key fields or empty. Using fallback.`);
        const fallbackTitle = `Take-Home Assignment: ${saneInput.interviewFocus || saneInput.interviewType} Challenge (${saneInput.faangLevel})`;
        const fallbackJobContext = saneInput.jobTitle ? `for the role of ${saneInput.jobTitle}` : `for the specified role`;
        const fallbackCompanyContext = saneInput.targetCompany ? `at ${saneInput.targetCompany}` : `at a leading tech company`;
        const fallbackFocusContext = saneInput.interviewFocus || saneInput.interviewType;
        const fallbackLevelContext = saneInput.faangLevel || 'a relevant professional';

        const fallbackText = `## ${fallbackTitle}\n\n### Goal\nDemonstrate your ability to analyze a complex problem related to ${fallbackFocusContext} and propose a well-reasoned solution appropriate for a ${fallbackLevelContext} level ${fallbackJobContext} ${fallbackCompanyContext}.\n\n### Problem Scenario\nDevelop a detailed proposal for [a relevant problem based on: ${fallbackJobContext}, focusing on ${fallbackFocusContext}]. Consider aspects like [key challenge 1, key challenge 2, and key challenge 3 related to ${saneInput.faangLevel} expectations].\n\n### Key Aspects to Consider\n- What is your overall approach?\n- What are the key trade-offs you considered?\n- How would you measure success?\n- What are potential risks or challenges?\n- How does your solution scale or adapt to future needs?\n\n### Deliverable\nA document (max 5 pages, or a 10-slide deck) outlining your approach, analysis, proposed solution, and key considerations.\n\n### Tips for Success\n- Be clear and concise in your communication.\n- State any assumptions you've made.`;

        const fallbackCharacteristics = [
          "Clear problem understanding and scoping.",
          "Well-reasoned approach and justification of choices.",
          "Consideration of potential challenges and trade-offs.",
          `Depth of analysis appropriate for ${saneInput.faangLevel}.`,
          "Professional and clear presentation of the solution."
        ];
        outputFromAI = {
            assignmentText: fallbackText,
            idealSubmissionCharacteristics: fallbackCharacteristics,
        };
    }
    return outputFromAI;
  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const fallbackTitle = `Take-Home Assignment: ${saneInput.interviewFocus || saneInput.interviewType} Challenge (${saneInput.faangLevel})`;
    const fallbackJobContext = saneInput.jobTitle ? `for the role of ${saneInput.jobTitle}` : 'for the specified role';
    const fallbackText = `## ${fallbackTitle}\n\n### Goal\nProvide a detailed response to a challenge related to ${saneInput.interviewFocus || saneInput.interviewType} ${fallbackJobContext}.\n\n### Task\n[A generic problem statement will be inserted here by the system if generation fails. Please describe a complex problem relevant to ${saneInput.interviewType} at an ${saneInput.faangLevel} level and outline your solution approach, key considerations, and deliverables.]`;
    return {
        assignmentText: fallbackText,
        idealSubmissionCharacteristics: [
            "Clear problem definition.", 
            "Logical solution structure.", 
            "Consideration of edge cases or trade-offs."
        ]
    };
  }
}
