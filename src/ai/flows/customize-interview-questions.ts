
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
import type { GenerateTakeHomeAssignmentInput } from './generate-take-home-assignment';
import { generateCaseStudyQuestions } from './generate-case-study-questions'; 
import type { CustomizeInterviewQuestionsInput as CaseStudyInputType } from './generate-case-study-questions'; // Renamed to avoid conflict

// Exporting the schema for use by specialized flows
export const CustomizeInterviewQuestionsInputSchema = z.object({
  jobTitle: z
    .string()
    .optional()
    .describe('The job title to customize the interview questions for. This is a key input for tailoring technical depth and focus.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description to customize the interview questions for. Use this to extract key responsibilities and technologies.'),
  resume: z
    .string()
    .optional()
    .describe('The user resume to provide context about the candidate\'s background. Use this to subtly angle questions, but do not ask questions directly *about* the resume unless it\'s a behavioral question about past experiences.'),
  interviewType: z
    .enum(['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms'])
    .describe('The type of interview to generate questions for.'),
  interviewStyle: z
    .enum(['simple-qa', 'case-study', 'take-home'])
    .describe('The style of the interview: simple Q&A, multi-turn case study, or take-home assignment.'),
  faangLevel: z
    .string()
    .optional()
    .describe('The target FAANG level for difficulty adjustment. This is critical for calibrating question complexity, considering dimensions like ambiguity, scope, impact, execution, and complexity associated with the level.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the user wants to focus on. Prioritize questions that assess these skills.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company the user is interviewing for (e.g., Amazon, Google). This can influence question style and thematic focus.'),
  interviewFocus: z
    .string()
    .optional()
    .describe('A specific focus area or sub-topic provided by the user to further narrow down the interview content. This should refine questions within the broader interview type and targeted skills.'),
});

export type CustomizeInterviewQuestionsInput = z.infer<
  typeof CustomizeInterviewQuestionsInputSchema
>;

// Output schema remains the same for the orchestrator
const CustomizeInterviewQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(z.string())
    .describe('An array of customized interview questions. For "take-home" this will be one item. For "case-study" 5-7 items. For "simple-qa" 5-10 items.'),
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
      faangLevel: input.faangLevel || 'L5', // Default if not provided
      targetedSkills: input.targetedSkills,
      targetCompany: input.targetCompany,
      interviewFocus: input.interviewFocus,
    };
    try {
      const takeHomeOutput = await generateTakeHomeAssignment(takeHomeInput);
      return { customizedQuestions: [takeHomeOutput.assignmentText] };
    } catch (error) {
      console.error("Error generating take-home assignment:", error);
      return { customizedQuestions: ["Failed to generate take-home assignment. The detailed problem statement could not be created. Please ensure all relevant fields like 'Job Title', 'Job Description', and 'Interview Focus' are as specific as possible. You can try configuring a simpler interview style or contact support."] };
    }
  } else if (input.interviewStyle === 'case-study') {
    try {
        // Ensure the input matches what generateCaseStudyQuestions expects
        const caseStudyInput: CaseStudyInputType = { ...input };
        const caseStudyOutput = await generateCaseStudyQuestions(caseStudyInput);
        return { customizedQuestions: caseStudyOutput.customizedQuestions };
    } catch (error) {
        console.error("Error generating case study questions:", error);
        const fallbackScenario = `Considering your role as a ${input.jobTitle || 'professional'} and the interview focus on ${input.interviewFocus || input.interviewType}, describe a complex project or challenge you've faced. What was the situation, your approach, and the outcome?`;
        const fallbackFollowUp = "What were the key trade-offs you had to make, and how did you decide?";
        return { customizedQuestions: [fallbackScenario, fallbackFollowUp, "What would you do differently if you faced a similar situation again?"] };
    }
  }
  // Default to the main flow for 'simple-qa'
  return customizeSimpleQAInterviewQuestionsFlow(input);
}

// This prompt is now specifically for 'simple-qa'
const customizeSimpleQAInterviewQuestionsPrompt = ai.definePrompt({
  name: 'customizeSimpleQAInterviewQuestionsPrompt', 
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: CustomizeInterviewQuestionsOutputSchema 
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager and curriculum designer from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes. If for some reason you are asked to generate those styles here, state that they are handled separately.

**Core Instructions & Persona Nuances:**
- Your goal is to craft questions that not only test skills but also make the candidate think critically and reveal their problem-solving process. You want them to leave the mock interview feeling challenged yet enlightened.
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.

**General Principles for All Questions (for 'simple-qa'):**
1.  **Relevance & Specificity:** Questions must be directly pertinent to the specified 'interviewType'. If 'jobTitle' and 'jobDescription' are provided, questions must be deeply tailored to the responsibilities, technologies, and domain mentioned.
2.  **Difficulty Calibration (FAANG Level):** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level, such as:
    *   **Ambiguity:** (e.g., L3/L4 get well-defined problems, L5/L6 more ambiguous. For L5+, avoid overly prescriptive questions; allow room for the candidate to define scope.)
    *   **Complexity:** (e.g., L4 handles 'straightforward' problems, L6 handles 'complex' multi-faceted problems. For L6+, questions should touch on interdependencies or require synthesis of multiple concepts.)
    *   **Scope & Impact:** (e.g., L4 might focus on a component, L6 on a system or feature with broader impact. Ensure the scale of the problem is appropriate.)
    *   **Execution:** (e.g., L4 tactical, L6 defines strategy. Questions should probe for strategic thinking in higher levels.)
3.  **Clarity & Conciseness:** Questions must be unambiguous, clear, and easy to understand.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' (if provided) or core competencies expected for the 'interviewType' and 'faangLevel'. If an 'interviewFocus' is provided, this should be a primary theme.
5.  **Open-Ended (Crucial for L4+):** AVOID asking questions that can be answered with a simple 'yes' or 'no', or that only require factual recall, especially for L4 and above. Questions should encourage detailed, reasoned responses and discussion.
6.  **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding to subtly angle questions or understand the candidate's likely exposure to certain topics. Do not generate questions *directly about* the resume content itself unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences.
7.  **Tool Usage for Clarity:** If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights to make questions more specific; don't just repeat tool output.

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
**Simple Q&A - Generate 5-10 questions:**
1.  For the 'simple-qa' style, questions should be direct, standalone, and suitable for a straightforward question-and-answer format, yet promote in-depth responses.
2.  Ensure questions are tailored to 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel' (calibrating for ambiguity, complexity, scope, execution), any 'targetedSkills', and particularly the 'interviewFocus' if provided. The 'interviewFocus' should guide the selection or framing of at least some questions.
3.  Generate 5-10 diverse questions that cover different facets of the 'interviewType'. 
    {{#if (eq interviewType "product sense")}}For "Product Sense," include questions on strategy, execution, metrics, and user understanding, all potentially colored by the 'interviewFocus'. Ensure questions require more than superficial answers, probing "why" and "how."{{/if}}
    {{#if (eq interviewType "technical system design")}}For "Technical System Design," ask about designing specific systems or components, focusing on architecture, trade-offs, scalability, etc., influenced by 'interviewFocus'. Avoid questions with a single, well-known "correct" design; focus on the candidate's reasoning for their choices.{{/if}}
    {{#if (eq interviewType "behavioral")}}For "Behavioral," generate situational questions or prompts for examples (e.g., STAR method), potentially aligned with 'targetedSkills' or company values if 'targetCompany' is 'Amazon'. Focus on situations requiring judgment and handling complexity.{{/if}}
    {{#if (eq interviewType "machine learning")}}
    For "Machine Learning," generate a mix of:
    *   Conceptual questions that require explanation and justification, not just definition (e.g., "Explain the bias-variance tradeoff and how it might influence model selection in a project focused on {{{interviewFocus}}}.").
    *   High-level ML system design prompts (e.g., "Outline the key components and design considerations for a model to predict {{{interviewFocus}}}. What are the primary challenges you anticipate?").
    If 'interviewFocus' is provided, lean towards questions related to that specific sub-domain. Ensure questions are calibrated to the 'faangLevel' in terms of expected depth and complexity. For L5+, expect discussion of trade-offs and alternative approaches.
    {{/if}}
    {{#if (eq interviewType "data structures & algorithms")}}
    For "Data Structures & Algorithms," generate 5-7 problem statements. These questions should prompt the candidate to:
    *   Clarify the problem and constraints (encourage them to ask questions).
    *   Describe their approach and algorithm in detail.
    *   Discuss the choice of data structures and justify them.
    *   Analyze time and space complexity thoroughly.
    *   Consider edge cases and how they would test their solution.
    Example: "You're given a stream of incoming stock prices. Design a data structure and algorithm to efficiently find the median price at any point in time. Explain your reasoning, data structures, and complexity."
    Focus on problems that assess 'targetedSkills' and are appropriate for 'faangLevel'. Avoid simple recall of textbook algorithms without application or analysis.
    {{/if}}
{{else}}
This interview style ({{{interviewStyle}}}) is not directly handled by this prompt. Case studies and Take-home assignments are generated by specialized processes.
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Pay special attention to Amazon's Leadership Principles. Your role-play as an Amazon interviewer should subtly reflect these.
1.  **Behavioral:** Many questions MUST provide an opportunity to demonstrate these principles. Frame questions using situations or ask for examples (e.g., "Tell me about a time you had to 'Dive Deep' to solve a complex problem related to {{{interviewFocus}}}, even when initial data was misleading. What was the outcome?").
2.  **Product Sense / Technical System Design / Machine Learning / Data Structures & Algorithms:** Frame questions to subtly align with principles like Customer Obsession (e.g., "How would you design this system with {{{interviewFocus}}} to ensure the best possible customer experience, even under failure conditions? What metrics would reflect this?"), Ownership, or Invent and Simplify (e.g., "Propose a significantly simpler approach to solve X problem related to {{{interviewFocus}}}, and discuss the trade-offs.").
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output the questions as a JSON object with a 'customizedQuestions' key, which is an array of strings.
- For 'simple-qa', this will be an array of 5-10 strings.
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

// This flow is now specifically for 'simple-qa'
const customizeSimpleQAInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'customizeSimpleQAInterviewQuestionsFlow', 
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: CustomizeInterviewQuestionsOutputSchema,
  },
  async input => {
    if (input.interviewStyle !== 'simple-qa') {
        return { customizedQuestions: [`This flow is for 'simple-qa' only. Style '${input.interviewStyle}' should be handled by a specialist.`] };
    }

    const {output} = await customizeSimpleQAInterviewQuestionsPrompt(input);
    if (!output || !output.customizedQuestions || output.customizedQuestions.length === 0) {
        // Fallback specific to simple-qa, ensuring a reasonable number of questions
        const fallbackQuestions = [
            "Can you describe a challenging project you've worked on and your role in it?",
            "What are your biggest strengths and how do they apply to this type of role?",
            "How do you approach learning new technologies or concepts?",
            `Tell me about a time you had to solve a difficult problem related to ${input.interviewFocus || input.interviewType}.`,
            "Where do you see yourself in 5 years in terms of technical growth or career path?",
            "How do you handle ambiguity in requirements or project goals?",
            "Describe a situation where you had to make a difficult trade-off in a project."
        ];
        const numQuestions = input.interviewType === 'data structures & algorithms' ? 5 : 7;
        const selectedFallback = fallbackQuestions.slice(0, Math.min(numQuestions, fallbackQuestions.length));
        return { customizedQuestions: selectedFallback };
    }
    return output!;
  }
);

