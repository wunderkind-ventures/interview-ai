'use server';

/**
 * @fileOverview Orchestrates interview question generation.
 *               Delegates to specialized flows for 'take-home' and 'case-study' styles.
 *               Handles 'simple-qa' style directly, now with manual JSON parsing.
 *
 * - customizeInterviewQuestions - Orchestrator function.
 * - CustomizeInterviewQuestionsInput - The input type for the orchestrator.
 * - CustomizeInterviewQuestionsOutput - The return type for the orchestrator.
 */

import { genkit, z, type Genkit as GenkitInstanceType, type ModelReference } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI, getTechnologyBriefTool as globalGetTechnologyBriefTool, findRelevantAssessmentsTool as globalFindRelevantAssessmentsTool } from '@/ai/genkit';

import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { defineGetTechnologyBriefTool } from '../tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

import { generateTakeHomeAssignment, type GenerateTakeHomeAssignmentInput } from './generate-take-home-assignment';
import { generateInitialCaseSetup, type GenerateInitialCaseSetupInput, type GenerateInitialCaseSetupOutput } from './generate-case-study-questions';

import { CustomizeInterviewQuestionsInputSchema as BaseCustomizeInterviewQuestionsInputSchema } from '../schemas';

// This schema is for the client-side call to this orchestrator.
export type CustomizeInterviewQuestionsInput = z.infer<typeof BaseCustomizeInterviewQuestionsInputSchema>;


// Output schema for individual questions from ANY generation path
const OrchestratorQuestionOutputSchema = z.object({
    questionText: z.string(),
    idealAnswerCharacteristics: z.array(z.string()).optional().describe("Brief key characteristics or elements a strong answer to this specific question/assignment would demonstrate."),
    isInitialCaseQuestion: z.boolean().optional(),
    fullScenarioDescription: z.string().optional().describe("The full descriptive text of the case scenario, provided for the first question of a case study."),
    internalNotesForFollowUpGenerator: z.string().optional().describe("Context for the AI to generate the next dynamic follow-up question in a case study."),
    isLikelyFinalFollowUp: z.boolean().optional().describe("Indicates if this question (in a case study) is likely the final one for the initial setup. Note: dynamic follow-ups will manage their own finality."),
});

// This schema is for the final output of the orchestrator
const CustomizeInterviewQuestionsOutputSchema = z.object({ 
  customizedQuestions: z
    .array(OrchestratorQuestionOutputSchema)
    .describe('An array of customized interview questions/assignments. For case studies, this will contain only the first question along with context for dynamic follow-ups.'),
});
export type CustomizeInterviewQuestionsOutput = z.infer<typeof CustomizeInterviewQuestionsOutputSchema>;


// Main exported orchestrator function
export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput,
  options?: { apiKey?: string } 
): Promise<CustomizeInterviewQuestionsOutput> {

  const saneInput: CustomizeInterviewQuestionsInput = {
    ...input,
    jobTitle: input.jobTitle || "",
    jobDescription: input.jobDescription || "",
    resume: input.resume || "",
    targetedSkills: input.targetedSkills || [],
    targetCompany: input.targetCompany || "",
    interviewFocus: input.interviewFocus || "",
    interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
  };

  let aiInstanceToUse: GenkitInstanceType = globalAI;
  let toolsForInstance = [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];
  const flowNameForLogging = 'customizeInterviewQuestionsOrchestrator';
  
  if (options?.apiKey) {
    try {
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key for AI operations.`);
      const userGoogleAIPlugin = googleAI({ apiKey: options.apiKey });
      const userKit = genkit({
        plugins: [userGoogleAIPlugin],
      });
      // Define tools specifically for this userKit instance
      const userTechTool = await defineGetTechnologyBriefTool(userKit);
      const userAssessTool = await defineFindRelevantAssessmentsTool(userKit);
      
aiInstanceToUse = userKit;
      toolsForInstance = [userTechTool, userAssessTool];

    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit or define tools with user-provided API key: ${(e as Error).message}. Falling back to default key.`);
      // aiInstanceToUse remains globalAI, toolsForInstance remains global tools
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No user API key provided; using default global AI instance and tools.`);
  }

  if (saneInput.interviewStyle === 'take-home') {
    const takeHomeInput: GenerateTakeHomeAssignmentInput = saneInput;
    try {
      const takeHomeOutput = await generateTakeHomeAssignment(takeHomeInput, { aiInstance: aiInstanceToUse, tools: toolsForInstance, apiKey: options?.apiKey });
      return {
        customizedQuestions: [{
          questionText: takeHomeOutput.assignmentText,
          idealAnswerCharacteristics: takeHomeOutput.idealSubmissionCharacteristics,
        }]
      };
    } catch (error) {
      console.error("Error generating take-home assignment:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error.";
      return { customizedQuestions: [{ questionText: `Failed to generate take-home assignment. The detailed problem statement could not be created. Please ensure all relevant fields are filled. Error: ${errorMsg}` , idealAnswerCharacteristics: [] }] };
    }
  } else if (saneInput.interviewStyle === 'case-study') {
    try {
        const initialCaseOutput: GenerateInitialCaseSetupOutput = await generateInitialCaseSetup(saneInput, { aiInstance: aiInstanceToUse, tools: toolsForInstance, apiKey: options?.apiKey });
        return {
          customizedQuestions: [{
            questionText: initialCaseOutput.firstQuestionToAsk,
            idealAnswerCharacteristics: initialCaseOutput.idealAnswerCharacteristicsForFirstQuestion,
            isInitialCaseQuestion: true,
            fullScenarioDescription: initialCaseOutput.fullScenarioDescription,
            internalNotesForFollowUpGenerator: initialCaseOutput.internalNotesForFollowUpGenerator,
          }]
        };
    } catch (error) {
        console.error("Error generating initial case setup:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error generating case study.";
        const fallbackScenario = `Considering your role as a ${saneInput.jobTitle || 'professional'} and the interview focus on ${saneInput.interviewFocus || saneInput.interviewType}, describe a complex project or challenge you've faced. This will serve as our initial case. Error: ${errorMsg}`;
        return {
          customizedQuestions: [
            {
              questionText: fallbackScenario,
              idealAnswerCharacteristics: ["Clarity of situation", "Logical approach", "Measurable outcome"],
              isInitialCaseQuestion: true,
              fullScenarioDescription: fallbackScenario,
              internalNotesForFollowUpGenerator: "Fallback case: focus on project challenge, approach, outcome."
            },
          ]
        };
    }
  }
  // For 'simple-qa', call the dedicated flow
  return customizeSimpleQAInterviewQuestionsFlow(saneInput, aiInstanceToUse, toolsForInstance);
}

const SimpleQAPromptInputSchema = BaseCustomizeInterviewQuestionsInputSchema.extend({
    isBehavioral: z.boolean(),
    isProductSense: z.boolean(),
    isTechnicalSystemDesign: z.boolean(),
    isMachineLearning: z.boolean(),
    isDSA: z.boolean(),
    isAmazonTarget: z.boolean(),
    isGeneralInterviewType: z.boolean(),
    // amazonLpsList will be added dynamically to the context for rendering if needed
});
type SimpleQAPromptInput = z.infer<typeof SimpleQAPromptInputSchema>;


const SimpleQAQuestionsOutputSchema = z.object({
  customizedQuestions: z.array(
    OrchestratorQuestionOutputSchema 
  ).describe('An array of 5-10 customized Q&A questions (or 2-3 for Amazon behavioral), each with text and ideal answer characteristics.'),
});

// REMOVED: SIMPLE_QA_PROMPT_TEMPLATE_STRING
const RAW_SIMPLE_QA_PROMPT = loadPromptFile("customize-simple-qa-questions.prompt"); // ADDED

// REMOVED: customizeSimpleQAPromptText function

async function customizeSimpleQAInterviewQuestionsFlow(
  baseInput: CustomizeInterviewQuestionsInput, 
  aiInstance: GenkitInstanceType,
  toolsToUse: any[]
): Promise<z.infer<typeof SimpleQAQuestionsOutputSchema>> {
  const flowNameForLogging = 'customizeSimpleQAInterviewQuestionsFlow';
  console.log(`[BYOK] ${flowNameForLogging}: Starting for interviewType: ${baseInput.interviewType}`);

  const promptInputForSimpleQA: SimpleQAPromptInput = {
    ...baseInput,
    isBehavioral: baseInput.interviewType === 'behavioral',
    isProductSense: baseInput.interviewType === 'product sense',
    isTechnicalSystemDesign: baseInput.interviewType === 'technical system design',
    isMachineLearning: baseInput.interviewType === 'machine learning',
    isDSA: baseInput.interviewType === 'data structures & algorithms',
    isAmazonTarget: baseInput.targetCompany?.toLowerCase() === 'amazon' && baseInput.interviewType === 'behavioral',
    isGeneralInterviewType: !['behavioral', 'product sense', 'technical system design', 'machine learning', 'data structures & algorithms'].includes(baseInput.interviewType),
  };

  // Prepare context for Handlebars rendering
  const contextForSimpleQAPrompt = {
    ...promptInputForSimpleQA,
    amazonLpsList: promptInputForSimpleQA.isAmazonTarget
      ? AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n')
      : '', // Provide empty string if not Amazon behavioral, or template can handle absence
  };

  try {
    const renderedPrompt = renderPromptTemplate(RAW_SIMPLE_QA_PROMPT, contextForSimpleQAPrompt);
    console.log(`[BYOK] ${flowNameForLogging}: Rendered Prompt:\n`, renderedPrompt); // Log the rendered prompt

    const result = await aiInstance.generate<typeof SimpleQAQuestionsOutputSchema>({
      prompt: renderedPrompt, 
      model: googleAI.model('gemini-1.5-flash-latest') as ModelReference<any>,
      tools: toolsToUse,
      output: {
        format: 'json',
        schema: SimpleQAQuestionsOutputSchema,
      },
      config: { 
        responseMimeType: "application/json",
      },
    });

    const validatedOutput = result.output;

    if (!validatedOutput || !validatedOutput.customizedQuestions || validatedOutput.customizedQuestions.length === 0) {
      console.warn(`[BYOK] ${flowNameForLogging}: AI response was not in the expected SimpleQAQuestionsOutputSchema format or did not contain valid customizedQuestions. Response:`, validatedOutput);
      throw new Error('AI response was not in the expected SimpleQAQuestionsOutputSchema format or did not yield questions.');
    }

    console.log(`[BYOK] ${flowNameForLogging}: Successfully received and validated AI output against SimpleQAQuestionsOutputSchema.`);
    return validatedOutput;

  } catch (error) {
    console.error(`[BYOK] Error in ${flowNameForLogging} (Input: ${JSON.stringify(promptInputForSimpleQA, null, 2)}):`, error);
    const fallbackQs = getFallbackQuestions(baseInput.interviewType, baseInput.faangLevel);
    return { customizedQuestions: fallbackQs };
  }
}

// Fallback function in case of errors
function getFallbackQuestions(interviewType: string, faangLevel?: string): any[] {
  let questions: any[] = [];
  const characteristics = [
    "Clear articulation of thought process.",
    "Logical reasoning and problem decomposition.",
    "Effective communication of ideas.",
    "Ability to handle ambiguity or ask clarifying questions."
  ];

  switch (interviewType) {
    case 'behavioral':
      questions = [
        { questionText: "Tell me about a time you had to deal with a conflict within your team.", idealAnswerCharacteristics: [...characteristics, "Focus on resolution and positive outcome."] },
        { questionText: "Describe a situation where you took initiative to improve a process or project.", idealAnswerCharacteristics: [...characteristics, "Demonstrates proactiveness and impact."] },
        { questionText: "Give an example of a time you failed. What did you learn from it?", idealAnswerCharacteristics: [...characteristics, "Shows self-awareness and growth mindset."] },
      ];
      break;
    case 'product sense':
      questions = [
        { questionText: `How would you improve our product X (e.g., Google Search, Facebook News Feed)? (Assume X is ${faangLevel || 'a well-known product'})`, idealAnswerCharacteristics: [...characteristics, "User-centric approach, clear metrics for success."] },
        { questionText: "What is a product you admire and why? What would you have done differently?", idealAnswerCharacteristics: [...characteristics, "Critical thinking, understanding of product design principles."] },
      ];
      break;
    case 'technical system design':
      questions = [
        { questionText: `Design a simplified version of a service like Twitter or a URL shortener. Focus on the high-level components and data flow. (Targeting ${faangLevel || 'mid-level'} complexity)`, idealAnswerCharacteristics: [...characteristics, "Scalability considerations, identifies key components."] },
      ];
      break;
    default:
      questions = [
        { questionText: "Walk me through a challenging technical problem you solved recently.", idealAnswerCharacteristics: characteristics },
        { questionText: "How do you stay up-to-date with new technologies and industry trends?", idealAnswerCharacteristics: [...characteristics, "Demonstrates curiosity and continuous learning."] },
      ];
  }
  return questions.slice(0, 3); // Return a few fallback questions
}

// Export the main orchestrator type for potential external use if needed, though it's primarily for internal routing now.
export type { CustomizeInterviewQuestionsInput as CustomizeInterviewQuestionsOrchestratorInput, CustomizeInterviewQuestionsOutput as CustomizeInterviewQuestionsOrchestratorOutput };
