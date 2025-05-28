
'use server';

/**
 * @fileOverview Orchestrates interview question generation.
 *               Delegates to specialized flows for 'take-home' and 'case-study' styles.
 *               Handles 'simple-qa' style directly.
 *
 * - customizeInterviewQuestions - Orchestrator function.
 * - CustomizeInterviewQuestionsInput - The input type for the orchestrator.
 * - CustomizeInterviewQuestionsOutput - The return type for the orchestrator.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI } from '@/ai/genkit'; 

import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
import { findRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool';

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
const CustomizeInterviewQuestionsOutputSchema = z.object({ // Not exported as per 'use server'
  customizedQuestions: z
    .array(OrchestratorQuestionOutputSchema)
    .describe('An array of customized interview questions/assignments. For case studies, this will contain only the first question along with context for dynamic follow-ups.'),
});
export type CustomizeInterviewQuestionsOutput = z.infer<typeof CustomizeInterviewQuestionsOutputSchema>;


// Main exported orchestrator function
export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput,
  options?: { apiKey?: string } // Added options for API key
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

  let currentAI = globalAI; // Default to global AI instance

  if (options?.apiKey) {
    try {
      console.log("[BYOK] Orchestrator: Using user-provided API key for AI operations.");
      currentAI = genkit({
        plugins: [googleAI({ apiKey: options.apiKey })],
        model: globalAI.getModel().name, // Use the same model as the global config
      });
    } catch (e) {
      console.warn(`[BYOK] Orchestrator: Failed to initialize Genkit with user-provided API key: ${(e as Error).message}. Falling back to default key.`);
      // currentAI remains globalAI
    }
  } else {
    console.log("[BYOK] Orchestrator: No user API key provided; using default global AI instance for customizeInterviewQuestions.");
  }

  if (saneInput.interviewStyle === 'take-home') {
    const takeHomeInput: GenerateTakeHomeAssignmentInput = saneInput;
    try {
      // Pass the potentially user-specific AI instance and API key to the specialized flow
      const takeHomeOutput = await generateTakeHomeAssignment(takeHomeInput, { aiInstance: currentAI, apiKey: options?.apiKey });
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
        // Pass the potentially user-specific AI instance and API key
        const initialCaseOutput: GenerateInitialCaseSetupOutput = await generateInitialCaseSetup(saneInput, { aiInstance: currentAI, apiKey: options?.apiKey });
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
        const fallbackScenario = `Considering your role as a ${saneInput.jobTitle || 'professional'} and the interview focus on ${saneInput.interviewFocus || saneInput.interviewType}, describe a complex project or challenge you've faced. This will serve as our initial case.`;
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
  // Default to simple Q&A, passing the currentAI instance
  return customizeSimpleQAInterviewQuestionsFlow(saneInput, currentAI);
}

// Extended input schema for the Simple Q&A prompt, including boolean flags
// This schema is internal to this file.
const SimpleQAPromptInputSchema = BaseCustomizeInterviewQuestionsInputSchema.extend({
    isBehavioral: z.boolean(),
    isProductSense: z.boolean(),
    isTechnicalSystemDesign: z.boolean(),
    isMachineLearning: z.boolean(),
    isDSA: z.boolean(),
    isAmazonTarget: z.boolean(),
    isGeneralInterviewType: z.boolean(),
});
type SimpleQAPromptInput = z.infer<typeof SimpleQAPromptInputSchema>;


// Schema for the output of the Simple Q&A specialist flow
const SimpleQAQuestionsOutputSchema = z.object({
  customizedQuestions: z.array(
    OrchestratorQuestionOutputSchema 
  ).describe('An array of 5-10 customized Q&A questions (or 2-3 for Amazon behavioral), each with text and ideal answer characteristics.'),
});


const customizeSimpleQAInterviewQuestionsPrompt = globalAI.definePrompt({ 
  name: 'customizeSimpleQAInterviewQuestionsPrompt',
  tools: [getTechnologyBriefTool, findRelevantAssessmentsTool],
  input: {
    schema: SimpleQAPromptInputSchema,
  },
  output: {
    schema: SimpleQAQuestionsOutputSchema
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager and curriculum designer from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
Adopt the '{{{interviewerPersona}}}' persona in the style and focus of the questions you generate.
For example:
- 'standard': Balanced and typical questions.
- 'friendly_peer': Collaborative tone, questions might explore thought process more gently.
- 'skeptical_hiring_manager': Questions might probe for weaknesses, edge cases, or justifications more directly.
- 'time_pressed_technical_lead': Questions might be more direct, focused on core technical competency, expecting concise answers.
- 'behavioral_specialist': Deep focus on STAR method and specific behavioral competencies.
- 'antagonistic_challenger': Questions will be challenging, probing, and designed to test resilience and conviction. Expect pushback on assumptions and demand strong justifications.
- 'apathetic_business_lead': Questions may seem broad, disengaged, or slightly vague. The candidate will need to drive the conversation and clearly articulate value to keep this persona engaged.


DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes called by an orchestrator. You are only responsible for 'simple-qa'.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager. Your goal is to craft questions that not only test skills but also make the candidate think critically and reveal their problem-solving process. You want them to leave the mock interview feeling challenged yet enlightened.
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.
- For L4+ roles, AVOID asking questions that can be answered with a simple 'yes' or 'no'. FOCUS on questions that elicit problem-solving approaches and trade-off discussions.
- **Output Requirement - Ideal Answer Characteristics:** For each question, you MUST provide a brief list (2-4 bullet points) of 'idealAnswerCharacteristics'. These are key elements a strong answer to THAT SPECIFIC question would exhibit.

**Input Utilization & Context:**
- **Job Title & Description:** Use 'jobTitle' and 'jobDescription' (if provided) to deeply tailor the questions. The technical depth required should be directly influenced by these.
- **FAANG Level:** All content must be precisely calibrated to the 'faangLevel'. Consider typical industry expectations for Ambiguity, Complexity, Scope, and Execution. (e.g., L3/L4: well-defined problems, clearer scope; L5/L6: more ambiguous, complex, strategic; L7: highly complex, strategic, or organization-wide problems with significant ambiguity).
- **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding to subtly angle questions. Do not generate questions *directly about* the resume content unless 'interviewType' is "behavioral".
- **Targeted Skills & Focus:** If 'targetedSkills' are provided, questions MUST actively assess these. 'interviewFocus' should be a primary theme.

**Tool Usage for RAG:**
- If you need inspiration for question types, scenarios, or common pitfalls (e.g., for '{{{interviewType}}}' at '{{{faangLevel}}}' focusing on '{{{interviewFocus}}}'), you MAY use the \`findRelevantAssessmentsTool\`.
- Formulate a query for the tool based on '{{{interviewType}}}', '{{{faangLevel}}}', and '{{{interviewFocus}}}'.
- Use the tool's output to help you generate *new, unique, and relevant* questions. **DO NOT simply copy the retrieved content.** Adapt and synthesize.

**General Principles for All Questions (for 'simple-qa'):**
1.  **Relevance & Specificity:** Questions must be directly pertinent to 'interviewType'.
2.  **Difficulty Calibration (FAANG Level):** Calibrate to 'faangLevel' considering Ambiguity, Complexity, Scope, Execution.
3.  **Clarity & Conciseness:** Questions must be unambiguous.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' or core competencies. 'interviewFocus' should be a primary theme.
5.  **Open-Ended (Crucial for L4+):** Questions should encourage detailed, reasoned responses.
6.  **Technology Context (Tool Usage):** If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights to make questions more specific.

**Input Context to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context: {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: {{{interviewStyle}}} (This prompt should only receive 'simple-qa')
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if interviewerPersona}}Interviewer Persona to Adopt: {{{interviewerPersona}}} (Adapt question style accordingly){{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Style-Specific Question Generation Logic (for 'simple-qa' ONLY):**

{{#if isBehavioral}}
  {{#if isAmazonTarget}}
    You are an **experienced Amazon Bar Raiser or Senior Hiring Manager**. Your primary goal is to craft 2-3 distinct behavioral questions for a simulated 1-hour interview block. Each question should be designed to give the candidate an opportunity to share specific experiences demonstrating one or more Amazon Leadership Principles (LPs) using the STAR method.
    1.  Generate 2-3 behavioral questions. Each question should target one or more LPs. Aim for a diverse set of LPs across these questions.
    2.  Phrase questions to naturally elicit STAR method responses (e.g., "Tell me about a time when...", "Describe a situation where...", "Give me an example of...").
    3.  Ensure questions prompt for details about the candidate's specific actions, the impact of those actions, and what they learned. Aim to include questions that allow the candidate to showcase instances where they excelled, and at least one question that specifically probes a situation involving a challenge, setback, or a time they learned from a mistake or failure.
    4.  For each question, the 'idealAnswerCharacteristics' MUST include:
        - "Clear use of STAR method (Situation, Task, Action, Result)."
        - "Specific examples and quantifiable data points where applicable."
        - "Clear demonstration of the targeted Amazon Leadership Principle(s) (e.g., [LP Name])."
        - "Focus on personal contributions ('I' statements)."
        - "Articulation of impact and learnings from the experience, especially from challenges or setbacks."
    The Amazon Leadership Principles for your reference:
{{{AMAZON_LPS_LIST}}}
  {{else}}
    You are an experienced interviewer. Generate 5-7 standard behavioral questions.
    1.  Questions should probe for past behaviors and experiences related to common workplace competencies (teamwork, problem-solving, leadership, conflict resolution, etc.), tailored by 'jobTitle', 'faangLevel', and 'targetedSkills'.
    2.  Use formats like "Tell me about a time...", "Describe a situation where...".
    3.  For each question, 'idealAnswerCharacteristics' should reflect general best practices for behavioral answers, such as:
        - "Provides a specific, relevant example."
        - "Clearly describes the situation and their role."
        - "Details actions taken and thought process."
        - "Explains the outcome and impact."
        - "Includes reflection or lessons learned."
  {{/if}}
{{else if isProductSense}}
  You are an experienced Product Management interviewer. Generate 5-7 product sense questions.
  1. Include questions on product strategy, execution, metrics, user understanding, and problem-solving.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics: "User-centric problem definition", "Data-driven approach", "Creative but feasible solutions", "Clear success metrics", "Considers trade-offs".
{{else if isTechnicalSystemDesign}}
  You are an experienced System Design interviewer. Generate 3-5 technical system design prompts.
  1. Ask about designing specific systems or components, focusing on architecture, trade-offs, scalability, reliability, etc.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics: "Clarifies requirements and constraints", "Proposes a high-level architecture", "Discusses key components and their interactions", "Addresses scalability and performance", "Considers trade-offs and justifies decisions".
{{else if isMachineLearning}}
  You are an experienced Machine Learning interviewer. Generate 5-7 machine learning questions.
  1. Include a mix of conceptual questions (e.g., "Explain...") and high-level ML system design prompts ("Design a system to...").
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics (conceptual): "Accurate definition of concept", "Explains pros and cons", "Provides relevant examples or use cases".
  4. Example idealAnswerCharacteristics (system design): "Problem understanding & scoping", "Data considerations (sources, features, biases)", "Model selection and justification", "Evaluation strategy", "Deployment and operational aspects".
{{else if isDSA}}
  You are an experienced Data Structures & Algorithms interviewer. Generate 5-7 DSA problem statements.
  1. Problems should prompt for clarification, approach description, algorithm design, data structure justification, complexity analysis, and edge case consideration.
  2. Tailor difficulty to 'faangLevel'. 'targetedSkills' might guide problem categories (e.g., "Trees & Graphs").
  3. Example idealAnswerCharacteristics: "Clarification of constraints and edge cases", "Efficient algorithmic approach", "Correct data structure choice and justification", "Accurate time/space complexity analysis", "Walkthrough of logic and edge cases".
{{else if isGeneralInterviewType}}
  You are an experienced interviewer. Generate 5-7 general questions relevant to the 'interviewType' ('{{{interviewType}}}'), 'jobTitle', 'faangLevel', and 'interviewFocus'.
  1. Focus on open-ended questions that encourage detailed responses.
  2. Ensure 'idealAnswerCharacteristics' reflect the core skills being tested for that 'interviewType'.
{{/if}}

Output a JSON object with a 'customizedQuestions' key. This key holds an array of objects, where each object has:
- 'questionText': The question itself (string).
- 'idealAnswerCharacteristics': An array of 2-5 strings describing elements of a strong answer.
`,
  customize: (promptDef, callInput: SimpleQAPromptInput) => {
    let promptText = promptDef.prompt!;
    if (callInput.isBehavioral && callInput.isAmazonTarget) {
      const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\\n');
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', lpList);
    } else {
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', 'Not applicable for this company or interview type.');
    }
    return {
      ...promptDef,
      prompt: promptText,
    };
  }
});

// This flow is now specialized for Simple Q&A
async function customizeSimpleQAInterviewQuestionsFlow(
  baseInput: BaseCustomizeInterviewQuestionsInput, 
  aiInstance: any 
): Promise<z.infer<typeof SimpleQAQuestionsOutputSchema>> {
     if (baseInput.interviewStyle !== 'simple-qa') {
        // This flow should only be called by the orchestrator for 'simple-qa'
        console.warn(`[BYOK] customizeSimpleQAInterviewQuestionsFlow called with incorrect style: ${baseInput.interviewStyle}. This indicates an orchestrator logic issue.`);
        return { customizedQuestions: [{ questionText: `Error: This flow is for 'simple-qa' only. Received '${baseInput.interviewStyle}'.`, idealAnswerCharacteristics: [] }] };
    }

    const promptInput: SimpleQAPromptInput = {
        ...baseInput, 
        interviewType: baseInput.interviewType, 
        interviewStyle: baseInput.interviewStyle, 
        faangLevel: baseInput.faangLevel, 
        interviewerPersona: baseInput.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        isBehavioral: baseInput.interviewType === 'behavioral',
        isProductSense: baseInput.interviewType === 'product sense',
        isTechnicalSystemDesign: baseInput.interviewType === 'technical system design',
        isMachineLearning: baseInput.interviewType === 'machine learning',
        isDSA: baseInput.interviewType === 'data structures & algorithms',
        isAmazonTarget: baseInput.targetCompany?.toLowerCase() === 'amazon',
        isGeneralInterviewType: !['behavioral', 'product sense', 'technical system design', 'machine learning', 'data structures & algorithms'].includes(baseInput.interviewType),
    };

    const {output} = await aiInstance.run(customizeSimpleQAInterviewQuestionsPrompt, promptInput);
    if (!output || !output.customizedQuestions || output.customizedQuestions.length === 0) {
        const fallbackQuestions = [
            { questionText: "Can you describe a challenging project you've worked on and your role in it?", idealAnswerCharacteristics: ["Clear context", "Specific personal contribution", "Quantifiable impact if possible"] },
            { questionText: "What are your biggest strengths and how do they apply to this type of role?", idealAnswerCharacteristics: ["Relevant strengths", "Concrete examples", "Connection to role requirements"] },
            { questionText: "How do you approach learning new technologies or concepts?", idealAnswerCharacteristics: ["Proactive learning strategies", "Examples of quick learning", "Adaptability"] },
            { questionText: `Tell me about a time you had to solve a difficult problem related to ${baseInput.interviewFocus || baseInput.interviewType}.`, idealAnswerCharacteristics: ["Problem definition", "Analytical approach", "Solution and outcome"] },
            { questionText: "Where do you see yourself in 5 years in terms of technical growth or career path?", idealAnswerCharacteristics: ["Realistic ambitions", "Alignment with potential career paths", "Desire for growth"] },
            { questionText: "How do you handle ambiguity in requirements or project goals?", idealAnswerCharacteristics: ["Strategies for clarification", "Proactive communication", "Decision making under uncertainty"] },
            { questionText: "Describe a situation where you had to make a difficult trade-off in a project.", idealAnswerCharacteristics: ["Context of trade-off", "Rationale for decision", "Impact of the decision"] }
        ];
        const numQuestions = (baseInput.interviewType === 'behavioral' && baseInput.targetCompany?.toLowerCase() === 'amazon') ? 3 : 5;
        const selectedFallback = fallbackQuestions.slice(0, Math.min(numQuestions, fallbackQuestions.length));

        return { customizedQuestions: selectedFallback.map(q => ({...q, isInitialCaseQuestion: undefined, fullScenarioDescription: undefined, internalNotesForFollowUpGenerator: undefined, isLikelyFinalFollowUp: undefined })) };
    }

    const compliantOutput = output.customizedQuestions.map(q => ({
        questionText: q.questionText,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics || [],
        isInitialCaseQuestion: undefined, 
        fullScenarioDescription: undefined, 
        internalNotesForFollowUpGenerator: undefined, 
        isLikelyFinalFollowUp: undefined, 
    }));
    return { customizedQuestions: compliantOutput };
  }

// Export the main orchestrator type for potential external use if needed, though it's primarily for internal routing now.
export type { CustomizeInterviewQuestionsInput as CustomizeInterviewQuestionsOrchestratorInput, CustomizeInterviewQuestionsOutput as CustomizeInterviewQuestionsOrchestratorOutput };
