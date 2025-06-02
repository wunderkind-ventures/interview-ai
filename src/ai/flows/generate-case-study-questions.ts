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

const INITIAL_CASE_SETUP_PROMPT_TEMPLATE_STRING = `Generate an initial case study interview setup.
You are an **Expert Case Study Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)**. You excel at designing compelling, realistic, and thought-provoking case study interviews.
Your task is to design the **initial setup** for a case study. This means crafting a compelling problem scenario and an insightful first question that kickstarts a deep analytical discussion.
If an 'interviewerPersona' is provided (current: '{{{interviewerPersona}}}'), ensure the 'fullScenarioDescription' and 'firstQuestionToAsk' reflect this persona's style.
For example:
- 'standard': A balanced and typical setup.
- 'friendly_peer': Scenario might be framed more collaboratively.
- 'skeptical_hiring_manager': Scenario might subtly include more red herrings or challenges to test critical thinking. The first question might directly challenge initial assumptions.
- 'time_pressed_technical_lead': Scenario and first question are direct and to the point.
- 'behavioral_specialist': Scenario might be more focused on complex interpersonal or ethical dilemmas if relevant to the job.
- 'antagonistic_challenger': The scenario itself might present a controversial or difficult situation, and the first question could be a direct challenge to the candidate's initial assumptions or approach, designed to test resilience.
- 'apathetic_business_lead': The scenario might be presented with minimal enthusiasm, and the first question might be overly broad or vague, requiring the candidate to proactively structure the problem and demonstrate value.

The setup includes:
1.  A 'caseTitle'.
2.  A 'fullScenarioDescription': CRITICAL: Describe a multi-faceted business, product, or technical **challenge** (not a simple task or verification step). This scenario must present a situation requiring **analysis, strategic thinking, and problem-solving**. It should be immersive and provide enough context for a rich discussion. 'interviewFocus' MUST be central. Calibrate technical depth and scenario complexity based on 'interviewType', 'jobTitle', 'jobDescription', and 'faangLevel'. **ABSOLUTELY AVOID** generating scenarios that are mere test case descriptions, software verification steps, or simple task definitions. For example, DO NOT create scenarios like 'Test user login' or 'Verify API endpoint X'. The scenario must be a complex problem requiring strategic thought.
3.  The 'firstQuestionToAsk': The very first question for the candidate. This question MUST be specific to the 'fullScenarioDescription' you generate. It should prompt the candidate to analyze the *specific situation* you've described, frame their approach to *that problem*, ask clarifying questions about *that scenario*, or outline their initial strategy for *tackling the presented challenge*. Example for a complex scenario: "Given the complexities of the declining user engagement at StreamFlix, what are your initial hypotheses for the root causes, and what specific data would you prioritize analyzing first to validate them?". The 'firstQuestionToAsk' must be probing and directly tied to the complexities of the scenario. Avoid generic openings like 'What are your thoughts?' or 'Any clarifying questions?'. Instead, ask something that forces immediate analysis or strategic framing of the specific problem presented.
4.  'idealAnswerCharacteristicsForFirstQuestion': 2-3 key elements for a strong answer to that first question. Examples: 'Demonstrates structured problem decomposition', 'Asks insightful clarifying questions about the problem, not just logistics', 'Identifies key assumptions they are making', 'Outlines a logical high-level approach'.
5.  'internalNotesForFollowUpGenerator': A concise summary of key themes, challenges, potential probing areas (e.g., 'user impact, metrics, technical debt, stakeholder alignment, ethical considerations, competitive landscape'), key trade-offs (e.g., 'cost vs. performance, speed vs. reliability, short-term vs. long-term impact'), and potential twists or new information that could be introduced.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager. Your goal is to craft case studies that are not just tests but learning experiences, making candidates think critically and reveal their problem-solving process.
- **Understanding Case Studies:** A case study is NOT a simple task verification or a 'test case' (e.g., 'Test login functionality,' 'Verify button works'). Such descriptions are unacceptable. Instead, a case study presents a story, situation, or business/technical challenge that requires the candidate to:
    - Analyze complex information.
    - Identify core problems or opportunities.
    - Make and justify assumptions.
    - Propose strategies or solutions.
    - Discuss trade-offs.
    - Ask clarifying questions to navigate ambiguity.
  The scenario should be immersive, provide sufficient (but not necessarily complete) context, and set the stage for a rich, multi-turn discussion.
- CRITICAL: The scenario MUST NOT be a simple test case description. For instance, avoid scenarios like:
    - **BAD Example (Do NOT produce this):**
        - Case Title: User Login Test
        - Full Scenario Description: This test case verifies that a user can successfully log in to the system using valid username and password.
        - First Question: Based on this, what are your initial thoughts?
    - **GOOD Example (Aim for this style):**
        - Case Title: Declining User Engagement on Streaming Platform
        - Full Scenario Description: Our popular video streaming service, 'StreamFlix', has seen a 15% decline in daily active users (DAU) and a 20% drop in average watch time over the past quarter, despite no major technical outages or content library changes. The marketing team reports increased competitor activity. The data science team has provided preliminary data showing the drop is most significant among users aged 18-24.
        - First Question: As the Senior Product Manager for StreamFlix, how would you diagnose the root causes of this engagement drop, and what immediate steps would you propose to investigate further?
- Your generated 'fullScenarioDescription' and 'firstQuestionToAsk' MUST adhere to the principles outlined in the 'GOOD Example' and actively avoid the 'BAD Example' structure.
- The scenario must be challenging and allow for multiple valid approaches. It should NOT have an obvious single 'correct' answer.
- Calibrate the complexity, ambiguity, and scope of the scenario and first question to the 'faangLevel'. For the given 'faangLevel', consider typical industry expectations regarding: Ambiguity, Complexity, Scope, and Execution.

**FAANG Level Calibration Examples:**
  - L3/L4 cases: more defined, focused problems (e.g., optimizing a feature, investigating a specific issue) with clear, achievable deliverables. Still, avoid simplistic test case descriptions. The first question should guide them to break down the problem and identify key considerations.
  - L5/L6 cases: more ambiguous scenarios requiring the candidate to define scope, assumptions, and success metrics; solution might involve strategic trade-offs and influencing stakeholders. Present a complex problem with multiple potential paths. The first question should prompt for strategic framing or initial diagnostic approach.
  - L7 cases: highly complex, strategic, or organization-wide problems with significant ambiguity and high impact, requiring vision, leadership, and the ability to navigate conflicting priorities. The first question should assess their ability to set a vision or define a long-term strategy for the problem.

**Tool Usage for RAG:**
- To ensure your generated case study scenario and first question are high-quality and relevant, you MAY use the \`findRelevantAssessmentsTool\`.
- Formulate a query for the tool based on '{{{interviewType}}}', '{{{faangLevel}}}', and '{{{interviewFocus}}}'.
- Use the retrieved assessment snippets as inspiration for the scenario, common challenges, or the type of initial question.
- **DO NOT simply copy the retrieved content.** Adapt, synthesize, and use it as inspiration to create a *new, unique* initial case setup.

**Input Context to Consider:**
- Job Title: {{#if jobTitle}}{{{jobTitle}}}{{else}}Not specified. Generate a general case for the interview type.{{/if}}
- Job Description: {{#if jobDescription}}Provided (see details below if used for tailoring).{{else}}Not specified.{{/if}}
- Candidate Resume Context: {{#if resume}}Provided (use for subtle angling, do not reference directly).{{else}}Not specified.{{/if}}
- Interview Type: {{{interviewType}}}
- Interview Style: case-study (You are generating the initial setup)
- FAANG Level: {{#if faangLevel}}{{{faangLevel}}}{{else}}Not specified; assume mid-level.{{/if}}
- Target Company: {{#if targetCompany}}{{{targetCompany}}}{{else}}Not specified.{{/if}}
- Interviewer Persona: {{#if interviewerPersona}}{{{interviewerPersona}}}{{else}}Standard.{{/if}}
- Targeted Skills: {{#if targetedSkills.length}}{{#each targetedSkills}}- {{{this}}} {{/each}}{{else}}None specified; focus on core skills for the interview type and level.{{/if}}
- Specific Focus: {{#if interviewFocus}}{{{interviewFocus}}}{{else}}None specified; generate a general case for the interview type.{{/if}}

{{#if jobDescription}}
---
Job Description Details (if tailoring):
{{{jobDescription}}}
---
{{/if}}

{{#if resume}}
---
Resume Details (if used for context):
{{{resume}}}
---
{{/if}}

**Scenario Generation Logic:**
Based on the 'interviewType' ('{{{interviewType}}}' for this request), generate the case study:

If the 'interviewType' is "technical system design": The scenario will be a system to design or a major architectural challenge. Design a realistic, multi-faceted problem with clear (or intentionally ambiguous for higher levels) requirements. The 'firstQuestionToAsk' should prompt for requirement clarification, high-level design components, or initial trade-off considerations.
Else if the 'interviewType' is "product sense": A product strategy, market entry, feature design, or problem-solving challenge. Ensure it's engaging and requires strategic thinking, user empathy, and data-driven decision making. The 'firstQuestionToAsk' should probe their understanding of the problem space, target users, or how they'd define success.
Else if the 'interviewType' is "behavioral": A complex hypothetical workplace situation requiring judgment and principle-based decision-making. Frame it as a leadership challenge if appropriate for the level. The 'firstQuestionToAsk' should ask for their initial assessment of the situation and how they would approach it.
Else if the 'interviewType' is "machine learning": An ML System Design problem or a strategic ML initiative. The scenario should be detailed enough to allow for discussion of data, models, evaluation, and deployment. The 'firstQuestionToAsk' should focus on problem framing, data strategy, or initial model considerations.
Else if the 'interviewType' is "data structures & algorithms": A complex algorithmic problem that requires significant decomposition and discussion of approaches before diving into a solution. The 'firstQuestionToAsk' might be about understanding requirements, clarifying constraints, or outlining initial high-level strategies for solving *that specific problem*.
Else (Fallback): Generate a general professional problem-solving scenario suitable for the '{{{faangLevel}}}', related to '{{{interviewFocus}}}' if provided, otherwise make it broadly applicable. The first question should ask for an initial approach to *the specific problem presented*.
End of interviewType specific guidance.

{{#if targetCompany}}
If the targetCompany field has a value like "Amazon" (perform a case-insensitive check in your reasoning and apply the following if true):
**Amazon-Specific Considerations:**
Ensure the scenario and potential follow-ups (guided by your internal notes) provide opportunities to demonstrate Amazon's Leadership Principles.
The Amazon Leadership Principles are:
{{{AMAZON_LPS_LIST}}}
End of Amazon-specific considerations.
{{/if}}

**Final Output Format:**
Output a valid JSON object with the following fields:
- 'caseTitle': (string) A concise, engaging title.
- 'fullScenarioDescription': (string) The detailed narrative of the case study problem.
- 'firstQuestionToAsk': (string) The specific first question for the candidate.
- 'idealAnswerCharacteristicsForFirstQuestion': (array of strings, optional) Key elements for a strong answer to the first question.
- 'internalNotesForFollowUpGenerator': (string) Concise internal notes for guiding dynamic follow-ups.
Ensure the 'firstQuestionToAsk' is specific and prompts for analysis or strategy related to the 'fullScenarioDescription'.
Adhere to the GOOD Example structure and avoid the BAD Example structure for scenario generation.
`;

const initialCaseSetupCustomizeFn = (promptText: string, callInput: GenerateInitialCaseSetupInput): string => {
  let newPromptText = promptText;
  if (callInput.targetCompany && callInput.targetCompany.toLowerCase() === 'amazon') {
    const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n');
    newPromptText = newPromptText.replace('{{{AMAZON_LPS_LIST}}}', lpList);
  } else {
    newPromptText = newPromptText.replace('{{{AMAZON_LPS_LIST}}}', 'Not applicable for this company.');
  }
  return newPromptText;
};

const initialCaseSetupPromptGlobalConfig = {
  name: 'generateInitialCaseSetupPromptGlobal',
  tools: [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool],
  input: { schema: CustomizeInterviewQuestionsInputSchema },
  output: { schema: GenerateInitialCaseSetupOutputSchema }, // Expect direct object now
  prompt: INITIAL_CASE_SETUP_PROMPT_TEMPLATE_STRING,
  customize: (promptDef: { prompt?: string }, callInput: GenerateInitialCaseSetupInput) => {
    return { ...promptDef, prompt: initialCaseSetupCustomizeFn(promptDef.prompt!, callInput) };
  }
};
globalAI.definePrompt(initialCaseSetupPromptGlobalConfig as any);

export async function generateInitialCaseSetup(
  input: GenerateInitialCaseSetupInput,
  // Update options to include tools?: any[]
  options?: { aiInstance?: GenkitInstanceType, tools?: any[], apiKey?: string, userGoogleAIPlugin?: any }
): Promise<GenerateInitialCaseSetupOutput> {
  let aiInstanceToUse: GenkitInstanceType = globalAI;
  // Default to global tools if specific tools aren't passed via options
  let toolsForInstance = options?.tools || [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];
  let isByokPath = false;

  if (options?.aiInstance && options.aiInstance !== globalAI) {
    aiInstanceToUse = options.aiInstance;
    // If an instance is passed, assume tools are already defined on it or passed with it
    isByokPath = true;
    console.log("[BYOK] generateInitialCaseSetup: Using provided aiInstance and its tools.");
  } else if (options?.apiKey) {
    try {
      const userGoogleAIPlugin = googleAI({ apiKey: options.apiKey });
      const userKit = genkit({ plugins: [userGoogleAIPlugin] });
      toolsForInstance = [defineGetTechnologyBriefTool(userKit), defineFindRelevantAssessmentsTool(userKit)];
      aiInstanceToUse = userKit;
      isByokPath = true;
      console.log("[BYOK] generateInitialCaseSetup: Using user-provided API key and new tools.");
    } catch (e) {
      console.warn(`[BYOK] generateInitialCaseSetup: Failed to initialize with user API key: ${(e as Error).message}. Falling back.`);
    }
  } else {
    console.log("[BYOK] generateInitialCaseSetup: Using default global AI instance and tools.");
  }

  const saneInput: GenerateInitialCaseSetupInput = { ...input, interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value };

  try {
    let outputFromAI: GenerateInitialCaseSetupOutput | undefined | null;

    if (isByokPath) {
      console.log("[BYOK] generateInitialCaseSetup: Using .generate() for BYOK path.");
      const customizedPromptText = initialCaseSetupCustomizeFn(INITIAL_CASE_SETUP_PROMPT_TEMPLATE_STRING, saneInput);
      
      const generateResult = await aiInstanceToUse.generate<typeof GenerateInitialCaseSetupOutputSchema>({ 
        model: googleAI.model('gemini-1.5-flash-latest') as ModelReference<any>,
        prompt: customizedPromptText,
        context: saneInput,
        tools: toolsForInstance,
        output: { schema: GenerateInitialCaseSetupOutputSchema }, 
        config: { responseMimeType: "application/json" }, 
      });
      
      outputFromAI = generateResult.output;

      if (!outputFromAI) {
        console.warn("[BYOK] generateInitialCaseSetup: AI response was null or undefined even after requesting direct JSON.");
      }
      
    } else {
      console.log("[BYOK] generateInitialCaseSetup: Using .run() for globalAI path.");
      const result: unknown = await globalAI.run(initialCaseSetupPromptGlobalConfig.name, async () => saneInput);
      outputFromAI = GenerateInitialCaseSetupOutputSchema.parse(result);
    }
    
    // Fallback if output is not as expected (e.g., missing critical fields)
    if (!outputFromAI || !outputFromAI.fullScenarioDescription || !outputFromAI.firstQuestionToAsk) {
      console.warn("AI Case Study Generation Fallback - Essential fields missing or AI response issue. Input:", saneInput);
      // Simplified fallback object structure matching GenerateInitialCaseSetupOutputSchema
      return {
        caseTitle: "Fallback Case Study: Error Occurred",
        fullScenarioDescription: "An unexpected error occurred while generating the case study scenario. Please try again or contact support if the issue persists.",
        firstQuestionToAsk: "Please describe a past project or challenge you encountered.",
        idealAnswerCharacteristicsForFirstQuestion: ["Problem identification", "Solution approach", "Outcome/Learning"],
        internalNotesForFollowUpGenerator: "Error during generation. Focus on general problem-solving."
      };
    }
    return outputFromAI;

  } catch (error) {
    console.error(`Error in generateInitialCaseSetup (input: ${JSON.stringify(input)}):`, error);
    if (error instanceof z.ZodError) {
        console.error("Zod validation error in generateInitialCaseSetup (outside BYOK parsing):", error.errors);
    }
    // Fallback for any other errors, ensuring a valid structure is returned.
    console.error(`General error in generateInitialCaseSetup, returning fallback. Error details: ${error}`);
    return {
        caseTitle: "Fallback Case Study: Error Occurred",
        fullScenarioDescription: "An unexpected error occurred while generating the case study scenario. Please try again or contact support if the issue persists.",
        firstQuestionToAsk: "Please describe a past project or challenge you encountered.",
        idealAnswerCharacteristicsForFirstQuestion: ["Problem identification", "Solution approach", "Outcome/Learning"],
        internalNotesForFollowUpGenerator: "Error during generation. Focus on general problem-solving."
    };
  }
}
