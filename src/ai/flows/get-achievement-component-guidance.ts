
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

const getAchievementComponentGuidancePromptObj = globalAi.definePrompt({
  name: 'getAchievementComponentGuidancePrompt',
  input: { schema: GetAchievementComponentGuidanceInputSchemaInternal },
  output: { schema: GetAchievementComponentGuidanceOutputSchemaInternal },
  prompt: `You are an expert career coach AI, specializing in helping individuals articulate their accomplishments using the STAR method (Situation, Task, Action, Result) and identify Quantifiable Impact.

A user is trying to document an achievement titled: "{{existingComponents.title}}" (or "{{achievementTitle}}" if no title yet).
They need help articulating the "{{componentToElaborate}}" part of their achievement.

Current details provided by the user (if any):
{{#if existingComponents.title}}Title: {{existingComponents.title}}{{/if}}
{{#if existingComponents.situation}}Situation: {{existingComponents.situation}}{{/if}}
{{#if existingComponents.task}}Task: {{existingComponents.task}}{{/if}}
{{#if existingComponents.action}}Action: {{existingComponents.action}}{{/if}}
{{#if existingComponents.result}}Result: {{existingComponents.result}}{{/if}}
{{#if existingComponents.quantifiableImpact}}Quantifiable Impact: {{existingComponents.quantifiableImpact}}{{/if}}

Based on the component ("{{componentToElaborate}}") they need help with and the context provided:

1.  **Guiding Questions (2-3 questions):** Generate specific questions that will prompt the user to provide relevant details for the "{{componentToElaborate}}" section. These questions should be open-ended and encourage reflection.
    *   Example for 'Situation': "What was the primary problem or opportunity you were addressing?", "What was the context or background before your involvement?"
    *   Example for 'Action': "What specific steps did you personally take?", "What skills or tools did you utilize?"
    *   Example for 'Quantifiable Impact': "Were there any numbers, percentages, or specific metrics that changed due to your actions?", "How can you measure the success or impact of this achievement?"

2.  **Example Phrases (2-3 phrases):** Provide example sentence starters or common phrases that are typically used when describing the "{{componentToElaborate}}" section.
    *   Example for 'Result': "As a direct result of my actions...", "The outcome was...", "This led to..."
    *   Example for 'Task': "My primary responsibility was to...", "I was tasked with addressing...", "The goal was to achieve..."

3.  **Suggested Points to Consider (2-4 points):** Based on the achievement title and any existing components, suggest specific aspects or details the user might want to include or think about for the "{{componentToElaborate}}" to make it more compelling.
    *   Example for 'Action' if title is "Led successful product launch": "Consider mentioning how you coordinated with different teams.", "Did you overcome any specific obstacles during the execution phase?"
    *   Example for 'Quantifiable Impact' if result is "Improved user engagement": "Think about specific metrics like Daily Active Users, session duration, or click-through rates.", "Can you compare before-and-after figures?"

Be concise and highly focused on the "{{componentToElaborate}}".
Output a JSON object.
`,
});

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
        model: globalAi.getModel().name,
      });
      console.log(`[BYOK] ${flowNameForLogging}: Using user-provided API key.`);
    } catch (e) {
      console.warn(`[BYOK] ${flowNameForLogging}: Failed to initialize Genkit with API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log(`[BYOK] ${flowNameForLogging}: No specific API key or AI instance provided; using default global AI instance.`);
  }

  try {
    const {output} = await activeAI.run(getAchievementComponentGuidancePromptObj, input);
    if (!output) {
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

    