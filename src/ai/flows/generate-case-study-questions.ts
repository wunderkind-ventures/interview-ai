
'use server';
/**
 * @fileOverview Generates the initial setup for a case study interview.
 * This flow provides the main scenario description, the first question to ask,
 * and internal notes to guide subsequent dynamic follow-up questions.
 *
 * - generateInitialCaseSetup - Function to generate the case study's starting point.
 * - GenerateInitialCaseSetupInput - Input type (likely same as CustomizeInterviewQuestionsInput).
 * - GenerateInitialCaseSetupOutput - Output type for the initial case setup.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
// Using CustomizeInterviewQuestionsInputSchema as the input for this specialized flow too,
// as it contains all necessary context (job title, desc, level, focus, etc.)
import { CustomizeInterviewQuestionsInputSchema } from './customize-interview-questions';
export type GenerateInitialCaseSetupInput = z.infer<typeof CustomizeInterviewQuestionsInputSchema>;

export const GenerateInitialCaseSetupOutputSchema = z.object({
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

// Exported function to be called by the orchestrator
export async function generateInitialCaseSetup(
  input: GenerateInitialCaseSetupInput
): Promise<GenerateInitialCaseSetupOutput> {
  return generateInitialCaseSetupFlow(input);
}

const initialCaseSetupPrompt = ai.definePrompt({
  name: 'generateInitialCaseSetupPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: GenerateInitialCaseSetupOutputSchema,
  },
  prompt: `You are an **Expert Case Study Architect AI**, from a top-tier tech company.
Your task is to design the **initial setup** for a compelling and realistic case study interview.
This setup includes:
1.  A 'caseTitle'.
2.  A 'fullScenarioDescription': A detailed narrative that sets the stage.
3.  The 'firstQuestionToAsk': The very first question for the candidate.
4.  'idealAnswerCharacteristicsForFirstQuestion': 2-3 key elements for a strong answer to that first question.
5.  'internalNotesForFollowUpGenerator': A concise summary of key themes, challenges, or areas to probe in the case. This will guide another AI in generating dynamic follow-up questions.

**Core Instructions:**
- The scenario must be challenging and allow for multiple valid approaches. It should NOT have an obvious single 'correct' answer.
- Calibrate the complexity, ambiguity, and scope of the scenario and first question to the 'faangLevel'.
- The 'interviewFocus', 'jobTitle', and 'jobDescription' should heavily influence the theme and specifics of the case.
- 'internalNotesForFollowUpGenerator' should be brief but informative (e.g., "Key challenges: scaling, data privacy, cross-team collaboration. Core trade-offs: cost vs. performance, speed vs. reliability. Potential areas to probe: user impact, metrics, technical debt.").

**Input Context to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context (for subtle angling, do not reference directly): {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: case-study (You are generating the initial setup)
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Scenario Generation Logic:**
- **Theme:**
    {{#if (eq interviewType "technical system design")}}The scenario will be a system to design or a major architectural challenge.{{/if}}
    {{#if (eq interviewType "product sense")}}A product strategy, market entry, feature design, or problem-solving challenge.{{/if}}
    {{#if (eq interviewType "behavioral")}}A complex hypothetical workplace situation requiring judgment and principle-based decision-making.{{/if}}
    {{#if (eq interviewType "machine learning")}}An ML System Design problem or a strategic ML initiative.{{/if}}
    {{#if (eq interviewType "data structures & algorithms")}}A complex algorithmic problem that requires significant decomposition and discussion before coding. The 'firstQuestionToAsk' might be about understanding requirements or initial approaches.{{/if}}
- **'fullScenarioDescription'**: Provide enough detail to be immersive but leave room for clarification and assumptions.
- **'firstQuestionToAsk'**: Should be open-ended, prompting the candidate to frame their approach or ask clarifying questions. Example: "Given this scenario, how would you begin to approach this problem?" or "What are your initial thoughts or clarifying questions about this situation?"
- **'internalNotesForFollowUpGenerator'**: Extract the core tensions, variables, or success factors of the case.

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations:**
If 'targetCompany' is Amazon, ensure the scenario and potential follow-ups (guided by your internal notes) provide opportunities to demonstrate Amazon's Leadership Principles.
LPs: {{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}- {{{this}}} {{/each}}
{{/if}}

**Final Output Format:**
Output a JSON object strictly matching the GenerateInitialCaseSetupOutputSchema.
`,
  customize: (prompt, input) => {
    return {
      ...prompt,
      prompt: prompt.prompt!.replace(
        '${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}',
        AMAZON_LEADERSHIP_PRINCIPLES.join('\n- ')
      ),
    };
  }
});

const generateInitialCaseSetupFlow = ai.defineFlow(
  {
    name: 'generateInitialCaseSetupFlow', // Renamed flow
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: GenerateInitialCaseSetupOutputSchema,
  },
  async (input: GenerateInitialCaseSetupInput): Promise<GenerateInitialCaseSetupOutput> => {
    const {output} = await initialCaseSetupPrompt(input);
    if (!output || !output.fullScenarioDescription || !output.firstQuestionToAsk) {
        // Basic fallback
        const scenarioType = input.interviewType === "technical system design" ? "system design challenge" :
                             input.interviewType === "machine learning" ? "ML problem" :
                             input.interviewType === "data structures & algorithms" ? "algorithmic design task" :
                             "product strategy scenario";
        const fallbackTitle = `${input.interviewFocus || scenarioType} Setup`;
        const fallbackDescription = `You are tasked with addressing a significant ${scenarioType} for a ${input.jobTitle || 'relevant role'} at ${input.targetCompany || 'a leading tech firm'}, focusing on "${input.interviewFocus || input.interviewType}". The complexity is aligned with a ${input.faangLevel || 'senior'} level.`;
        const fallbackFirstQuestion = "Given this situation, what are your initial thoughts, and what clarifying questions would you ask to better understand the problem space and constraints?";
        const fallbackIdealChars = ["Problem framing and clarification", "Identification of key ambiguities", "Structured approach to information gathering"];
        const fallbackInternalNotes = `Case focus: ${input.interviewFocus || scenarioType}. Level: ${input.faangLevel}. Key areas: problem definition, initial strategy, constraints.`;

        return {
            caseTitle: fallbackTitle,
            fullScenarioDescription: fallbackDescription,
            firstQuestionToAsk: fallbackFirstQuestion,
            idealAnswerCharacteristicsForFirstQuestion: fallbackIdealChars,
            internalNotesForFollowUpGenerator: fallbackInternalNotes,
        };
    }
    return output;
  }
);
