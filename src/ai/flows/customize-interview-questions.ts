
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

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
import { findRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool'; // Import RAG tool

import { generateTakeHomeAssignment } from './generate-take-home-assignment';
import type { GenerateTakeHomeAssignmentInput, GenerateTakeHomeAssignmentOutput } from './generate-take-home-assignment';

import { generateInitialCaseSetup } from './generate-case-study-questions';
import type { GenerateInitialCaseSetupInput, GenerateInitialCaseSetupOutput } from './generate-case-study-questions';

import { CustomizeInterviewQuestionsInputSchema, type CustomizeInterviewQuestionsInput } from '../schemas';

const OrchestratorQuestionOutputSchema = z.object({
    questionText: z.string(),
    idealAnswerCharacteristics: z.array(z.string()).optional().describe("Brief key characteristics or elements a strong answer to this specific question/assignment would demonstrate."),
    isInitialCaseQuestion: z.boolean().optional(),
    fullScenarioDescription: z.string().optional().describe("The full descriptive text of the case scenario, provided for the first question of a case study."),
    internalNotesForFollowUpGenerator: z.string().optional().describe("Context for the AI to generate the next dynamic follow-up question in a case study."),
    isLikelyFinalFollowUp: z.boolean().optional().describe("Indicates if this question (in a case study) is likely the final one."),
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
  input: CustomizeInterviewQuestionsInput
): Promise<CustomizeInterviewQuestionsOutput> {

  // Ensure optional string fields are defaulted to empty strings, and arrays to empty arrays
  const saneInput: CustomizeInterviewQuestionsInput = {
    ...input,
    jobTitle: input.jobTitle || "",
    jobDescription: input.jobDescription || "",
    resume: input.resume || "",
    targetedSkills: input.targetedSkills || [],
    targetCompany: input.targetCompany || "",
    interviewFocus: input.interviewFocus || "",
    interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
    previousConversation: input.previousConversation || "",
    currentQuestion: input.currentQuestion || "",
    caseStudyNotes: input.caseStudyNotes || "",
  };


  if (saneInput.interviewStyle === 'take-home') {
    const takeHomeInput: GenerateTakeHomeAssignmentInput = {
      interviewType: saneInput.interviewType,
      jobTitle: saneInput.jobTitle,
      jobDescription: saneInput.jobDescription,
      faangLevel: saneInput.faangLevel,
      targetedSkills: saneInput.targetedSkills,
      targetCompany: saneInput.targetCompany,
      interviewFocus: saneInput.interviewFocus,
      interviewerPersona: saneInput.interviewerPersona,
    };
    try {
      const takeHomeOutput: GenerateTakeHomeAssignmentOutput = await generateTakeHomeAssignment(takeHomeInput);
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
        const initialCaseInput: GenerateInitialCaseSetupInput = { ...saneInput };
        const initialCaseOutput: GenerateInitialCaseSetupOutput = await generateInitialCaseSetup(initialCaseInput);
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
  // Default to simple Q&A
  return customizeSimpleQAInterviewQuestionsFlow(saneInput);
}

// Extended input schema for the Simple Q&A prompt, including boolean flags
const SimpleQAPromptInputSchema = CustomizeInterviewQuestionsInputSchema.extend({
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
  ).describe('An array of 5-10 customized Q&A questions, each with text and ideal answer characteristics.'),
});


const customizeSimpleQAInterviewQuestionsPrompt = ai.definePrompt({
  name: 'customizeSimpleQAInterviewQuestionsPrompt',
  tools: [getTechnologyBriefTool, findRelevantAssessmentsTool], // Added RAG tool
  input: {
    schema: SimpleQAPromptInputSchema,
  },
  output: {
    schema: SimpleQAQuestionsOutputSchema
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager and curriculum designer from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
If an 'interviewerPersona' is provided (current: '{{{interviewerPersona}}}'), adopt that persona in the style and focus of the questions you generate.
For example:
- 'standard': Balanced and typical questions.
- 'friendly_peer': Collaborative tone, questions might explore thought process more gently.
- 'skeptical_hiring_manager': Questions might probe for weaknesses, edge cases, or justifications more directly.
- 'time_pressed_technical_lead': Questions might be more direct, focused on core technical competency, expecting concise answers.
- 'behavioral_specialist': Deep focus on STAR method and specific behavioral competencies.
- 'antagonistic_challenger': Questions will be challenging, probing, and designed to test resilience and conviction. Expect pushback on assumptions and demand strong justifications.
- 'apathetic_business_lead': Questions may seem broad, disengaged, or slightly vague. The candidate will need to drive the conversation and clearly articulate value to keep this persona engaged.

DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes. If for some reason you are asked to generate those styles here, state that they are handled separately.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager. Your goal is to craft questions that not only test skills but also make the candidate think critically and reveal their problem-solving process. You want them to leave the mock interview feeling challenged yet enlightened.
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.
- AVOID asking questions that can be answered with a simple 'yes' or 'no', especially for L4+ roles. FOCUS on questions that elicit problem-solving approaches and trade-off discussions.

**Input Utilization & Context:**
- **Job Title & Description:** Use 'jobTitle' and 'jobDescription' (if provided) to deeply tailor the questions to the responsibilities, technologies, and domain mentioned. The technical depth required should be directly influenced by these. For the given 'faangLevel', consider typical industry expectations regarding: Ambiguity, Complexity, Scope, and Execution.
- **FAANG Level:** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level: Ambiguity, Complexity, Scope, and Execution.
    - Example: L3/L4: well-defined problems, clearer scope.
    - Example: L5/L6: more ambiguous, complex, strategic.
    - Example: L7: highly complex, strategic, or organization-wide problems with significant ambiguity.
- **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding to subtly angle questions or understand the candidate's likely exposure to certain topics. Do not generate questions *directly about* the resume content itself unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences.
- **Targeted Skills & Focus:** If 'targetedSkills' are provided, questions MUST actively assess or revolve around these. If 'interviewFocus' is provided, it should be a primary theme.

**Tool Usage for RAG:**
- If you need inspiration for question types, scenarios, or common pitfalls related to the user's request (e.g., for '{{{interviewType}}}' at '{{{faangLevel}}}' focusing on '{{{interviewFocus}}}'), you MAY use the \`findRelevantAssessmentsTool\`.
- Use the tool's output (retrieved assessment snippets) to help you generate *new, unique, and relevant* questions for this specific candidate.
- **DO NOT simply copy the retrieved content.** Adapt, synthesize, and use it as inspiration.

**General Principles for All Questions (for 'simple-qa'):**
1.  **Relevance & Specificity:** Questions must be directly pertinent to 'interviewType'.
2.  **Difficulty Calibration (FAANG Level):** Calibrate to 'faangLevel' considering Ambiguity, Complexity, Scope, Execution. (e.g., L3/L4: well-defined problems; L5/L6: more ambiguous, complex, strategic).
3.  **Clarity & Conciseness:** Questions must be unambiguous.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' or core competencies. 'interviewFocus' should be a primary theme.
5.  **Open-Ended (Crucial for L4+):** Questions should encourage detailed, reasoned responses.
6.  **Technology Context (Tool Usage):** If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights to make questions more specific.
7.  **Output Requirement - Ideal Answer Characteristics:** For each question generated, you MUST also provide a brief list (2-4 bullet points) of 'idealAnswerCharacteristics'. These are key elements or qualities a strong answer to THAT SPECIFIC question would typically exhibit, considering the 'interviewType', 'faangLevel', and 'interviewFocus'.
    - Example for a Product Sense L5 question "How would you improve discovery for podcasts?": Ideal characteristics might include "User-centric problem definition", "Data-driven approach for identifying opportunities", "Creative but feasible solutions", "Clear success metrics".
    - Example for a DSA L4 question "Find the median of two sorted arrays": Ideal characteristics might include "Clarification of constraints and edge cases", "Efficient algorithmic approach (e.g., binary search based)", "Correct time/space complexity analysis", "Verbal walkthrough of logic".
    These characteristics will help in later feedback stages.

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
    You are an **Amazon Bar Raiser / Senior Hiring Manager**. Your goal is to generate behavioral questions that specifically assess Amazon's Leadership Principles (LPs).
    1.  Generate 5-7 behavioral questions. Each question should be crafted to give the candidate an opportunity to share specific experiences that demonstrate one or more LPs.
    2.  Use question formats like "Tell me about a time when...", "Give me an example of a situation where...".
    3.  Vary the LPs targeted across the questions. If 'targetedSkills' are provided and they match LP names (e.g., "Deliver Results", "Customer Obsession"), prioritize questions for those LPs. Otherwise, aim for a diverse set.
    4.  For each question, the 'idealAnswerCharacteristics' MUST include:
        - "Clearly outlines the Situation and Task."
        - "Details specific Actions taken by the candidate."
        - "Quantifies Results and impact achieved."
        - "Effectively demonstrates [Specific LP(s) targeted by this question, e.g., Customer Obsession, Ownership] through the example."
        - "Structured response, easy to follow (e.g., using STAR method)."
    The Amazon Leadership Principles for your reference:
{{{AMAZON_LPS_LIST}}}
  {{else}}
    Generate 5-7 standard behavioral questions.
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
  Generate 5-7 product sense questions.
  1. Include questions on product strategy, execution, metrics, user understanding, and problem-solving.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics: "User-centric problem definition", "Data-driven approach", "Creative but feasible solutions", "Clear success metrics", "Considers trade-offs".
{{else if isTechnicalSystemDesign}}
  Generate 3-5 technical system design prompts.
  1. Ask about designing specific systems or components, focusing on architecture, trade-offs, scalability, reliability, etc.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics: "Clarifies requirements and constraints", "Proposes a high-level architecture", "Discusses key components and their interactions", "Addresses scalability and performance", "Considers trade-offs and justifies decisions".
{{else if isMachineLearning}}
  Generate 5-7 machine learning questions.
  1. Include a mix of conceptual questions (e.g., "Explain...") and high-level ML system design prompts ("Design a system to...").
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics (conceptual): "Accurate definition of concept", "Explains pros and cons", "Provides relevant examples or use cases".
  4. Example idealAnswerCharacteristics (system design): "Problem understanding & scoping", "Data considerations (sources, features, biases)", "Model selection and justification", "Evaluation strategy", "Deployment and operational aspects".
{{else if isDSA}}
  Generate 5-7 data structures & algorithms problem statements.
  1. Problems should prompt for clarification, approach description, algorithm design, data structure justification, complexity analysis, and edge case consideration.
  2. Tailor difficulty to 'faangLevel'. 'targetedSkills' might guide problem categories (e.g., "Trees & Graphs").
  3. Example idealAnswerCharacteristics: "Clarification of constraints and edge cases", "Efficient algorithmic approach", "Correct data structure choice and justification", "Accurate time/space complexity analysis", "Walkthrough of logic and edge cases".
{{else if isGeneralInterviewType}}
  Generate 5-7 general questions relevant to the 'interviewType' ('{{{interviewType}}}'), 'jobTitle', 'faangLevel', and 'interviewFocus'.
  1. Focus on open-ended questions that encourage detailed responses.
  2. Ensure 'idealAnswerCharacteristics' reflect the core skills being tested for that 'interviewType'.
{{/if}}

Output a JSON object with a 'customizedQuestions' key. This key holds an array of objects, where each object has:
- 'questionText': The question itself (string).
- 'idealAnswerCharacteristics': An array of 2-5 strings describing elements of a strong answer.
(Other fields like 'isInitialCaseQuestion', 'fullScenarioDescription', 'internalNotesForFollowUpGenerator' are not relevant for this simple-qa flow and can be omitted by you.)
`,
  customize: (promptDef, callInput: SimpleQAPromptInput) => {
    let promptText = promptDef.prompt!;
    if (callInput.isBehavioral && callInput.isAmazonTarget) {
      const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n');
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
const customizeSimpleQAInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'customizeSimpleQAInterviewQuestionsFlow',
    inputSchema: CustomizeInterviewQuestionsInputSchema, // Still takes the general input
    outputSchema: SimpleQAQuestionsOutputSchema,
  },
  async (input: CustomizeInterviewQuestionsInput): Promise<z.infer<typeof SimpleQAQuestionsOutputSchema>> => {
     if (input.interviewStyle !== 'simple-qa') {
        // This should ideally not be reached if the orchestrator is working correctly.
        return { customizedQuestions: [{ questionText: `This flow is for 'simple-qa' only. Style '${input.interviewStyle}' should be handled by a specialist.`, idealAnswerCharacteristics: [] }] };
    }

    // Prepare the extended input for the prompt, including boolean flags
    const promptInput: SimpleQAPromptInput = {
        ...input,
        interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        isBehavioral: input.interviewType === 'behavioral',
        isProductSense: input.interviewType === 'product sense',
        isTechnicalSystemDesign: input.interviewType === 'technical system design',
        isMachineLearning: input.interviewType === 'machine learning',
        isDSA: input.interviewType === 'data structures & algorithms',
        isAmazonTarget: input.targetCompany?.toLowerCase() === 'amazon',
        isGeneralInterviewType: !['behavioral', 'product sense', 'technical system design', 'machine learning', 'data structures & algorithms'].includes(input.interviewType),
    };

    const {output} = await customizeSimpleQAInterviewQuestionsPrompt(promptInput);
    if (!output || !output.customizedQuestions || output.customizedQuestions.length === 0) {
        const fallbackQuestions = [
            { questionText: "Can you describe a challenging project you've worked on and your role in it?", idealAnswerCharacteristics: ["Clear context", "Specific personal contribution", "Quantifiable impact if possible"] },
            { questionText: "What are your biggest strengths and how do they apply to this type of role?", idealAnswerCharacteristics: ["Relevant strengths", "Concrete examples", "Connection to role requirements"] },
            { questionText: "How do you approach learning new technologies or concepts?", idealAnswerCharacteristics: ["Proactive learning strategies", "Examples of quick learning", "Adaptability"] },
            { questionText: `Tell me about a time you had to solve a difficult problem related to ${input.interviewFocus || input.interviewType}.`, idealAnswerCharacteristics: ["Problem definition", "Analytical approach", "Solution and outcome"] },
            { questionText: "Where do you see yourself in 5 years in terms of technical growth or career path?", idealAnswerCharacteristics: ["Realistic ambitions", "Alignment with potential career paths", "Desire for growth"] },
            { questionText: "How do you handle ambiguity in requirements or project goals?", idealAnswerCharacteristics: ["Strategies for clarification", "Proactive communication", "Decision making under uncertainty"] },
            { questionText: "Describe a situation where you had to make a difficult trade-off in a project.", idealAnswerCharacteristics: ["Context of trade-off", "Rationale for decision", "Impact of the decision"] }
        ];
        const numQuestions = (input.interviewType === 'data structures & algorithms' || input.interviewType === 'technical system design') ? 5 : 7;
        const selectedFallback = fallbackQuestions.slice(0, Math.min(numQuestions, fallbackQuestions.length));

        return { customizedQuestions: selectedFallback.map(q => ({...q, isInitialCaseQuestion: undefined, fullScenarioDescription: undefined, internalNotesForFollowUpGenerator: undefined, isLikelyFinalFollowUp: undefined })) };
    }

    // Ensure the output conforms to OrchestratorQuestionOutputSchema fields by removing unused ones
    const compliantOutput = output.customizedQuestions.map(q => ({
        questionText: q.questionText,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics || [],
        // These fields are not expected from Simple Q&A, so ensure they are undefined
        isInitialCaseQuestion: undefined,
        fullScenarioDescription: undefined,
        internalNotesForFollowUpGenerator: undefined,
        isLikelyFinalFollowUp: undefined, // Ensure this is also undefined
    }));
    return { customizedQuestions: compliantOutput };
  }
);

export type { CustomizeInterviewQuestionsInput, CustomizeInterviewQuestionsOutput as CustomizeInterviewQuestionsOrchestratorOutput };
    

    
