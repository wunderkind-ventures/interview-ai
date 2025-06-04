'use server';
/**
 * @fileOverview Provides AI-driven guidance for structuring achievement components (STAR method & Quantifiable Impact).
 *
 * - getAchievementComponentGuidance - Fetches guiding questions, example phrases, and points to consider.
 * - GetAchievementComponentGuidanceInput - Input type for the flow.
 * - GetAchievementComponentGuidanceOutput - Output type for the flow.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi } from '@/ai/genkit';
import {z} from 'genkit';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

const GetAchievementComponentGuidanceInputSchemaInternal = z.object({
  achievementTitle: z.string().optional().describe("The overall title or brief summary of the achievement for context."),
  componentToElaborate: z
    .enum(['situation', 'task', 'action', 'result', 'quantifiableImpact'])
    .describe('The specific STAR component or impact area the user needs help with.'),
  existingComponents: z
    .object({
      title: z.string().optional(),
      situation: z.string().optional(),
      task: z.string().optional(),
      action: z.string().optional(),
      result: z.string().optional(),
      quantifiableImpact: z.string().optional(),
    })
    .describe('Any STAR components or impact details already provided by the user, for better contextual guidance.'),
});
export type GetAchievementComponentGuidanceInput = z.infer<typeof GetAchievementComponentGuidanceInputSchemaInternal>;

const GetAchievementComponentGuidanceOutputSchemaInternal = z.object({
  guidingQuestions: z
    .array(z.string())
    .describe('Specific questions to help the user think through and articulate the selected component.'),
  examplePhrases: z
    .array(z.string())
    .describe('Example sentence starters or phrases relevant to the selected component.'),
  suggestedPointsToConsider: z
    .array(z.string())
    .describe('Key points or details the AI suggests the user might want to include or think about for this component, based on the overall achievement context.'),
});
export type GetAchievementComponentGuidanceOutput = z.infer<typeof GetAchievementComponentGuidanceOutputSchemaInternal>;

export async function getAchievementComponentGuidance(
  input: GetAchievementComponentGuidanceInput,
  options?: { aiInstance?: any; apiKey?: string }
): Promise<GetAchievementComponentGuidanceOutput> {
  let activeAI = globalAi;
  const flowNameForLogging = 'getAchievementComponentGuidance';

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
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
      activeAI = globalAi;
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const RAW_GUIDANCE_PROMPT = loadPromptFile("get-achievement-component-guidance.prompt");
    if (!RAW_GUIDANCE_PROMPT) {
      console.error(`[${flowNameForLogging}] Critical: Could not load get-achievement-component-guidance.prompt. Falling back to default.`);
      return {
        guidingQuestions: ["Could you describe the context for this part of your achievement in more detail?", "What were the key things you did or observed regarding this component?"],
        examplePhrases: ["Start by outlining...", "Consider mentioning..."],
        suggestedPointsToConsider: ["Think about the 'who, what, when, where, why' for this section.", "Try to be specific and provide concrete examples if possible."],
      };
    }
    const renderedPrompt = renderPromptTemplate(RAW_GUIDANCE_PROMPT, input);
    console.log(`[${flowNameForLogging}] Rendered Prompt:\n${renderedPrompt}`);

    const result = await activeAI.generate<typeof GetAchievementComponentGuidanceOutputSchemaInternal>({
        prompt: renderedPrompt,
        model: googleAI.model('gemini-1.5-flash-latest'),
        output: { schema: GetAchievementComponentGuidanceOutputSchemaInternal },
        config: { responseMimeType: "application/json" },
      });

    const output = result.output;

    if (!output) {
      console.warn(`[${flowNameForLogging}] AI returned no output. Using fallback.`);
      return {
        guidingQuestions: ["Could you describe the context for this part of your achievement in more detail?", "What were the key things you did or observed regarding this component?"],
        examplePhrases: ["Start by outlining...", "Consider mentioning..."],
        suggestedPointsToConsider: ["Think about the 'who, what, when, where, why' for this section.", "Try to be specific and provide concrete examples if possible."],
      };
    }
    return output;
  } catch (error) {
    console.error(`Error in ${flowNameForLogging}:`, error);
    throw error;
  }
}

    