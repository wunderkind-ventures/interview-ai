
'use server';
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
import { ai as globalAI } from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
import { findRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool'; 
import { CustomizeInterviewQuestionsInputSchema } from '../schemas'; 
export type GenerateInitialCaseSetupInput = z.infer<typeof CustomizeInterviewQuestionsInputSchema>;

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

const initialCaseSetupPromptObj = globalAI.definePrompt({ 
  name: 'generateInitialCaseSetupPrompt',
  tools: [getTechnologyBriefTool, findRelevantAssessmentsTool], 
  input: {
    schema: CustomizeInterviewQuestionsInputSchema, 
  },
  output: {
    schema: GenerateInitialCaseSetupOutputSchema,
  },
  prompt: `You are an **Expert Case Study Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)**. You excel at designing compelling, realistic, and thought-provoking case study interviews.
Your task is to design the **initial setup** for a case study.
If an 'interviewerPersona' is provided (current: '{{{interviewerPersona}}}'), ensure the 'fullScenarioDescription' and 'firstQuestionToAsk' reflect this persona's style.
For example:
- 'standard': A balanced and typical setup.
- 'friendly_peer': Scenario might be framed more collaboratively.
- 'skeptical_hiring_manager': Scenario might subtly include more red herrings or challenges to test critical thinking. The first question might directly challenge initial assumptions.
- 'time_pressed_technical_lead': Scenario and first question are direct and to the point.
- 'behavioral_specialist': Scenario might be more focused on complex interpersonal or ethical dilemmas if relevant to the job.
- 'antagonistic_challenger': The scenario itself might present a controversial or difficult situation, and the first question could be a direct challenge to the candidate's initial assumptions or approach, designed to test resilience.
- 'apathetic_business_lead': The scenario might be presented with minimal enthusiasm, and the first question might be overly broad or vague, requiring the candidate to proactively structure the problem and demonstrate value.

This setup includes:
1.  A 'caseTitle'.
2.  A 'fullScenarioDescription': A detailed narrative that sets the stage. This should be rich and multi-layered, especially for higher FAANG levels, providing enough detail to be immersive but leaving room for clarification and candidate assumptions. The scenario must be realistic and challenging.
3.  The 'firstQuestionToAsk': The very first question for the candidate. This should be open-ended, prompting the candidate to frame their approach, ask clarifying questions, or outline their initial strategy. Example: "Given this scenario, how would you begin to approach this problem, and what are your immediate clarifying questions?" or "What are your initial thoughts on the core challenges and opportunities presented here? What additional information would you seek first?"
4.  'idealAnswerCharacteristicsForFirstQuestion': 2-3 key elements for a strong answer to that first question.
5.  'internalNotesForFollowUpGenerator': A concise summary of key themes, challenges, potential probing areas (e.g., "user impact, metrics, technical debt, stakeholder alignment"), or key trade-offs (e.g., "cost vs. performance, speed vs. reliability"). This will guide another AI in generating dynamic follow-up questions.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager. Your goal is to craft case studies that are not just tests but learning experiences, making candidates think critically and reveal their problem-solving process.
- The scenario must be challenging and allow for multiple valid approaches. It should NOT have an obvious single 'correct' answer.
- Calibrate the complexity, ambiguity, and scope of the scenario and first question to the 'faangLevel'. For the given 'faangLevel', consider typical industry expectations regarding: Ambiguity, Complexity, Scope, and Execution.
  - Example: L3/L4 cases: more defined problems, clearer scope, task-oriented.
  - Example: L5/L6 cases: more ambiguous scenarios, candidate needs to define scope and assumptions, solution might involve strategic trade-offs and influencing stakeholders.
  - Example: L7 cases: highly complex, strategic, or organization-wide problems with significant ambiguity and high impact, requiring vision and leadership.
- The 'interviewFocus', 'jobTitle', and 'jobDescription' should heavily influence the theme and specifics of the case. The problem presented must be relevant to the candidate's target role and level.

**Tool Usage for RAG:**
- To ensure your generated case study scenario and first question are high-quality and relevant, you MAY use the \`findRelevantAssessmentsTool\`.
- Formulate a query for the tool based on '{{{interviewType}}}', '{{{faangLevel}}}', and '{{{interviewFocus}}}'.
- Use the retrieved assessment snippets as inspiration for the scenario, common challenges, or the type of initial question.
- **DO NOT simply copy the retrieved content.** Adapt, synthesize, and use it as inspiration to create a *new, unique* initial case setup.

**Input Context to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context (for subtle angling, do not reference directly): {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: case-study (You are generating the initial setup)
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if interviewerPersona}}Interviewer Persona to Adopt: {{{interviewerPersona}}} (Adapt scenario style accordingly){{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Scenario Generation Logic:**
Based on the 'interviewType' ('{{{interviewType}}}' for this request), generate the case study:

If the 'interviewType' is "technical system design": The scenario will be a system to design or a major architectural challenge. Design a realistic, multi-faceted problem with clear (or intentionally ambiguous for higher levels) requirements.
If the 'interviewType' is "product sense": A product strategy, market entry, feature design, or problem-solving challenge. Ensure it's engaging and requires strategic thinking, user empathy, and data-driven decision making.
If the 'interviewType' is "behavioral": A complex hypothetical workplace situation requiring judgment and principle-based decision-making. Frame it as a leadership challenge if appropriate for the level.
If the 'interviewType' is "machine learning": An ML System Design problem or a strategic ML initiative. The scenario should be detailed enough to allow for discussion of data, models, evaluation, and deployment.
If the 'interviewType' is "data structures & algorithms": A complex algorithmic problem that requires significant decomposition and discussion of approaches before diving into a solution. The 'firstQuestionToAsk' might be about understanding requirements, clarifying constraints, or outlining initial high-level strategies.

{{#if targetCompany}}
If the targetCompany field has a value like "Amazon" (perform a case-insensitive check in your reasoning and apply the following if true):
**Amazon-Specific Considerations:**
Ensure the scenario and potential follow-ups (guided by your internal notes) provide opportunities to demonstrate Amazon's Leadership Principles.
The Amazon Leadership Principles are:
{{{AMAZON_LPS_LIST}}}
End of Amazon-specific considerations.
{{/if}}

**Final Output Format:**
Output a JSON object strictly matching the GenerateInitialCaseSetupOutputSchema. Ensure 'caseTitle', 'fullScenarioDescription', 'firstQuestionToAsk', 'idealAnswerCharacteristicsForFirstQuestion', and 'internalNotesForFollowUpGenerator' are all populated with relevant, detailed content.
`,
  customize: (promptDef, callInput: GenerateInitialCaseSetupInput) => {
    let promptText = promptDef.prompt!;
    if (callInput.targetCompany && callInput.targetCompany.toLowerCase() === 'amazon') {
      const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\\n');
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', lpList);
    } else {
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', 'Not applicable for this company.');
    }
    return {
      ...promptDef,
      prompt: promptText,
    };
  }
});

export async function generateInitialCaseSetup(
  input: GenerateInitialCaseSetupInput,
  options?: { aiInstance?: any, apiKey?: string } 
): Promise<GenerateInitialCaseSetupOutput> {
  let activeAI = globalAI;
  if (options?.aiInstance) {
    activeAI = options.aiInstance;
    console.log("[BYOK] generateInitialCaseSetup: Using provided aiInstance.");
  } else if (options?.apiKey) {
    try {
      activeAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        model: globalAI.getModel().name,
      });
      console.log("[BYOK] generateInitialCaseSetup: Using user-provided API key.");
    } catch (e) {
      console.warn(`[BYOK] generateInitialCaseSetup: Failed to initialize with user API key: ${(e as Error).message}. Falling back.`);
      // activeAI remains globalAI
    }
  } else {
    console.log("[BYOK] generateInitialCaseSetup: No specific API key or AI instance provided; using default global AI instance.");
  }
  
  try {
      const saneInput: GenerateInitialCaseSetupInput = {
        ...input,
        interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
      };
      
      const {output} = await activeAI.run(initialCaseSetupPromptObj, saneInput);
      
      if (!output || !output.fullScenarioDescription || !output.firstQuestionToAsk || !output.caseTitle || !output.internalNotesForFollowUpGenerator) {
          console.warn(`AI Initial Case Setup Fallback Triggered. Input: ${JSON.stringify(saneInput)}`);
          const scenarioType = saneInput.interviewType === "technical system design" ? "system design challenge" :
                               saneInput.interviewType === "machine learning" ? "ML problem" :
                               saneInput.interviewType === "data structures & algorithms" ? "algorithmic design task" :
                               "product strategy scenario";
          const fallbackTitle = `${saneInput.interviewFocus || scenarioType} Setup (${saneInput.faangLevel})`;
          const fallbackDescription = `You are tasked with addressing a significant ${scenarioType} for a ${saneInput.jobTitle || 'relevant role'} at ${saneInput.targetCompany || 'a leading tech firm'}, focusing on "${saneInput.interviewFocus || saneInput.interviewType}". The complexity is aligned with a ${saneInput.faangLevel || 'senior'} level. Consider aspects like [key challenge 1, key challenge 2, and key challenge 3 related to ${saneInput.faangLevel} expectations for this domain].`;
          const fallbackFirstQuestion = "Given this situation, what are your initial thoughts, and what clarifying questions would you ask to better understand the problem space and constraints?";
          const fallbackIdealChars = ["Problem framing and clarification", "Identification of key ambiguities", "Structured approach to information gathering"];
          const fallbackInternalNotes = `Fallback Case. Focus: ${saneInput.interviewFocus || scenarioType}. Level: ${saneInput.faangLevel}. Key areas: problem definition, initial strategy, constraints. Persona: ${saneInput.interviewerPersona}`;

          return {
              caseTitle: fallbackTitle,
              fullScenarioDescription: fallbackDescription,
              firstQuestionToAsk: fallbackFirstQuestion,
              idealAnswerCharacteristicsForFirstQuestion: fallbackIdealChars,
              internalNotesForFollowUpGenerator: fallbackInternalNotes,
          };
      }
      return output;
  } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unknown error during initial case setup generation.';
      console.error(`Error in generateInitialCaseSetupFlow (input: ${JSON.stringify(input)}):`, error);
      const fallbackTitle = `Error: ${input.interviewFocus || input.interviewType} Setup (${input.faangLevel})`;
      const fallbackDescription = `Error generating initial case setup for ${input.jobTitle || 'role'} on ${input.interviewFocus || input.interviewType}. The AI model might be temporarily unavailable or the prompt requires adjustment. Error: ${errMessage}`;
      const fallbackFirstQuestion = "An error occurred generating the first question. Please try again later or reconfigure your interview.";
      const fallbackIdealChars = ["Report error."];
      const fallbackInternalNotes = `Error in generation. Input: ${JSON.stringify(input)}. Error: ${errMessage}`;
      return {
          caseTitle: fallbackTitle,
          fullScenarioDescription: fallbackDescription,
          firstQuestionToAsk: fallbackFirstQuestion,
          idealAnswerCharacteristicsForFirstQuestion: fallbackIdealChars,
          internalNotesForFollowUpGenerator: fallbackInternalNotes,
      };
  }
}
