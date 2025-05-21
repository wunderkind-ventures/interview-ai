
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
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';

import { generateTakeHomeAssignment } from './generate-take-home-assignment';
import type { GenerateTakeHomeAssignmentInput, GenerateTakeHomeAssignmentOutput } from './generate-take-home-assignment';

import { generateInitialCaseSetup } from './generate-case-study-questions'; // Renamed to generateInitialCaseSetup
import type { GenerateInitialCaseSetupInput, GenerateInitialCaseSetupOutput } from './generate-case-study-questions'; // Renamed type

import { CustomizeInterviewQuestionsInputSchema, CustomizeInterviewQuestionsInput } from '../schemas';


// This schema needs to accommodate the new fields for initial case study questions
const OrchestratorQuestionOutputSchema = z.object({
    questionText: z.string(),
    idealAnswerCharacteristics: z.array(z.string()).optional().describe("Brief key characteristics or elements a strong answer to this specific question/assignment would demonstrate."),
    // New fields for initial case study question
    isInitialCaseQuestion: z.boolean().optional(),
    fullScenarioDescription: z.string().optional().describe("The full descriptive text of the case scenario, provided for the first question of a case study."),
    internalNotesForFollowUpGenerator: z.string().optional().describe("Context for the AI to generate the next dynamic follow-up question in a case study."),
});

export const CustomizeInterviewQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(OrchestratorQuestionOutputSchema)
    .describe('An array of customized interview questions/assignments. For case studies, this will contain only the first question along with context for dynamic follow-ups.'),
});

export type CustomizeInterviewQuestionsOutput = z.infer<
  typeof CustomizeInterviewQuestionsOutputSchema
>;

// Main exported orchestrator function
export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput
): Promise<CustomizeInterviewQuestionsOutput> {
  if (input.interviewStyle === 'take-home') {
    const takeHomeInput: GenerateTakeHomeAssignmentInput = {
      interviewType: input.interviewType,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      faangLevel: input.faangLevel || 'L6', // Default if not provided
      targetedSkills: input.targetedSkills,
      targetCompany: input.targetCompany,
      interviewFocus: input.interviewFocus,
    };
    try {
      const takeHomeOutput: GenerateTakeHomeAssignmentOutput = await generateTakeHomeAssignment(takeHomeInput);
      return {
        customizedQuestions: [{
          questionText: takeHomeOutput.assignmentText, // The assignment itself is the "question"
          idealAnswerCharacteristics: takeHomeOutput.idealSubmissionCharacteristics,
        }]
      };
    } catch (error) {
      console.error("Error generating take-home assignment:", error);
      return { customizedQuestions: [{ questionText: "Failed to generate take-home assignment. The detailed problem statement could not be created. Please ensure all relevant fields like 'Job Title', 'Job Description', and 'Interview Focus' are as specific as possible. You can try configuring a simpler interview style or contact support." }] };
    }
  } else if (input.interviewStyle === 'case-study') {
    try {
        const initialCaseInput: GenerateInitialCaseSetupInput = { ...input };
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
        // Fallback for case study initial setup failure
        const fallbackScenario = `Considering your role as a ${input.jobTitle || 'professional'} and the interview focus on ${input.interviewFocus || input.interviewType}, describe a complex project or challenge you've faced. This will serve as our initial case.`;
        const fallbackFollowUp = "What was the situation, your approach, and the outcome?";
        return {
          customizedQuestions: [
            {
              questionText: fallbackScenario,
              idealAnswerCharacteristics: ["Clarity of situation", "Logical approach", "Measurable outcome"],
              isInitialCaseQuestion: true,
              fullScenarioDescription: fallbackScenario, // Use the question as description
              internalNotesForFollowUpGenerator: "Fallback case: focus on project challenge, approach, outcome."
            },
            // Note: The dynamic follow-up generator is responsible for subsequent questions.
            // This fallback only provides the *very first* prompt.
            // Alternatively, provide a simplified first actual question.
            // Let's use the firstQuestionToAsk as the questionText for the first item.
            // {
            //   questionText: fallbackFollowUp,
            //   idealAnswerCharacteristics: ["Identification of key trade-offs", "Sound decision-making rationale"]
            // }
          ]
        };
    }
  }
  // Default to the main flow for 'simple-qa'
  return customizeSimpleQAInterviewQuestionsFlow(input);
}


// Output schema for Simple Q&A - includes idealAnswerCharacteristics
const SimpleQAQuestionsOutputSchema = z.object({
  customizedQuestions: z.array(
    // Use OrchestratorQuestionOutputSchema here as well for consistency, even if some fields are not used by simple-qa
    OrchestratorQuestionOutputSchema
  ).describe('An array of 5-10 customized Q&A questions, each with text and ideal answer characteristics.'),
});


// This prompt is now specifically for 'simple-qa'
const customizeSimpleQAInterviewQuestionsPrompt = ai.definePrompt({
  name: 'customizeSimpleQAInterviewQuestionsPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    // The AI for simple Q&A will output an array of objects,
    // each fitting the OrchestratorQuestionOutputSchema structure.
    schema: SimpleQAQuestionsOutputSchema
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager and curriculum designer from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes. If for some reason you are asked to generate those styles here, state that they are handled separately.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager from a top-tier tech company. Your goal is to craft questions that not only test skills but also make the candidate think critically and reveal their problem-solving process. You want them to leave the mock interview feeling challenged yet enlightened.
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.
- AVOID asking questions that can be answered with a simple 'yes' or 'no', especially for L4+ roles.

**Input Utilization & Context:**
- **Job Title & Description:** Use 'jobTitle' and 'jobDescription' (if provided) to deeply tailor the questions to the responsibilities, technologies, and domain mentioned. The technical depth required should be directly influenced by these.
- **FAANG Level:** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level: Ambiguity, Complexity, Scope, and Execution.
- **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding to subtly angle questions or understand the candidate's likely exposure to certain topics. Do not generate questions *directly about* the resume content itself unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences.
- **Targeted Skills & Focus:** If 'targetedSkills' or 'interviewFocus' are provided, questions MUST actively assess or revolve around these.

**General Principles for All Questions (for 'simple-qa'):**
1.  **Relevance & Specificity:** Questions must be directly pertinent to 'interviewType'.
2.  **Difficulty Calibration (FAANG Level):** Calibrate to 'faangLevel' considering Ambiguity, Complexity, Scope, Execution. (e.g., L3/L4: well-defined problems; L5/L6: more ambiguous, complex, strategic).
3.  **Clarity & Conciseness:** Questions must be unambiguous.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' or core competencies. 'interviewFocus' should be a primary theme.
5.  **Open-Ended (Crucial for L4+):** Questions should encourage detailed, reasoned responses.
6.  **Tool Usage for Clarity:** If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights to make questions more specific.
7.  **Internal Reflection on Ideal Answer Characteristics:** Before finalizing the question(s), briefly consider the key characteristics or elements a strong answer would demonstrate. This internal reflection will help ensure the question is well-posed. You DO need to output these characteristics for each question.

**Output Requirement - Ideal Answer Characteristics:**
For each question generated, you MUST also provide a brief list (2-4 bullet points) of 'idealAnswerCharacteristics'. These are key elements or qualities a strong answer to THAT SPECIFIC question would typically exhibit, considering the 'interviewType', 'faangLevel', and 'interviewFocus'.
- Example for a Product Sense L5 question "How would you improve discovery for podcasts?": Ideal characteristics might include "User-centric problem definition", "Data-driven approach for identifying opportunities", "Creative but feasible solutions", "Clear success metrics".
- Example for a DSA L4 question "Find the median of two sorted arrays": Ideal characteristics might include "Clarification of constraints and edge cases", "Efficient algorithmic approach (e.g., binary search based)", "Correct time/space complexity analysis", "Verbal walkthrough of logic".
These characteristics will help in later feedback stages.

**Interview Context & Inputs to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context: {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: {{{interviewStyle}}} (This prompt should only receive 'simple-qa')
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Style-Specific Question Generation Logic (for 'simple-qa' ONLY):**

{{#if (eq interviewStyle "simple-qa")}}
**Simple Q&A - Generate 5-10 questions, each with 'questionText' and 'idealAnswerCharacteristics':**
1.  For the 'simple-qa' style, questions should be direct, standalone, and suitable for a straightforward question-and-answer format, yet promote in-depth responses.
2.  Ensure questions are tailored to 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel', any 'targetedSkills', and particularly the 'interviewFocus'.
3.  Generate 5-10 diverse questions.
    {{#if (eq interviewType "product sense")}}For "Product Sense," include questions on strategy, execution, metrics, and user understanding.{{/if}}
    {{#if (eq interviewType "technical system design")}}For "Technical System Design," ask about designing specific systems or components, focusing on architecture, trade-offs, scalability.{{/if}}
    {{#if (eq interviewType "behavioral")}}For "Behavioral," generate situational questions or prompts for examples (e.g., STAR method).{{/if}}
    {{#if (eq interviewType "machine learning")}}
    For "Machine Learning," generate a mix of conceptual questions and high-level ML system design prompts.
    {{/if}}
    {{#if (eq interviewType "data structures & algorithms")}}
    For "Data Structures & Algorithms," generate 5-7 problem statements. These questions should prompt the candidate to clarify, describe approach/algorithm, justify data structures, analyze complexity, and consider edge cases.
    {{/if}}
{{else}}
This interview style ({{{interviewStyle}}}) is not directly handled by this prompt. Case studies and Take-home assignments are generated by specialized processes.
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Pay special attention to Amazon's Leadership Principles.
1.  **Behavioral:** Many questions MUST provide an opportunity to demonstrate these principles.
2.  **Other Types:** Frame questions to subtly align with principles like Customer Obsession, Ownership, or Invent and Simplify.
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output a JSON object with a 'customizedQuestions' key. This key holds an array of objects, where each object has:
- 'questionText': The question itself (string).
- 'idealAnswerCharacteristics': An array of 2-4 strings describing elements of a strong answer.
(Other fields like 'isInitialCaseQuestion' are not relevant for this simple-qa flow and can be omitted by you.)
`,
  customize: (prompt, input) => {
    return {
      ...prompt,
      prompt: prompt.prompt!.replace(
        '${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}',
        JSON.stringify(AMAZON_LEADERSHIP_PRINCIPLES)
      ),
    };
  }
});

// This flow is now specifically for 'simple-qa'
const customizeSimpleQAInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'customizeSimpleQAInterviewQuestionsFlow',
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: SimpleQAQuestionsOutputSchema,
  },
  async (input): Promise<z.infer<typeof SimpleQAQuestionsOutputSchema>> => {
    if (input.interviewStyle !== 'simple-qa') {
        return { customizedQuestions: [{ questionText: `This flow is for 'simple-qa' only. Style '${input.interviewStyle}' should be handled by a specialist.`, idealAnswerCharacteristics: [] }] };
    }

    const {output} = await customizeSimpleQAInterviewQuestionsPrompt(input);
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
        const numQuestions = input.interviewType === 'data structures & algorithms' ? 5 : 7;
        const selectedFallback = fallbackQuestions.slice(0, Math.min(numQuestions, fallbackQuestions.length));
        return { customizedQuestions: selectedFallback.map(q => ({...q})) }; // Ensure it matches OrchestratorQuestionOutputSchema
    }
    // Ensure output items conform to OrchestratorQuestionOutputSchema, even if some fields are undefined
    const compliantOutput = output.customizedQuestions.map(q => ({
        questionText: q.questionText,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics,
        isInitialCaseQuestion: undefined,
        fullScenarioDescription: undefined,
        internalNotesForFollowUpGenerator: undefined,
    }));
    return { customizedQuestions: compliantOutput };
  }
);
