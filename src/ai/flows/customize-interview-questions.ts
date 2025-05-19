
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
    .enum(['product sense', 'technical system design', 'behavioral'])
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
      faangLevel: input.faangLevel || 'L5',
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
        const caseStudyOutput = await generateCaseStudyQuestions(input);
        return { customizedQuestions: caseStudyOutput.customizedQuestions };
    } catch (error) {
        console.error("Error generating case study questions:", error);
        const fallbackScenario = `Considering your role as a ${input.jobTitle || 'professional'} and the interview focus on ${input.interviewFocus || input.interviewType}, describe a complex project or challenge you've faced. What was the situation, your approach, and the outcome?`;
        const fallbackFollowUp = "What were the key trade-offs you had to make, and how did you decide?";
        return { customizedQuestions: [fallbackScenario, fallbackFollowUp, "What would you do differently if you faced a similar situation again?"] };
    }
  }
  // Default to the main flow for 'simple-qa' or other styles not explicitly handled above
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
  prompt: `You are an expert Interview Architect AI, highly skilled in crafting FAANG-level interview questions.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes. If for some reason you are asked to generate those styles here, state that they are handled separately.

**Core Instructions & Persona:**
- Your persona is that of a seasoned hiring manager and curriculum designer from a top-tier tech company (like Google, Meta, or Amazon).
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.

**General Principles for All Questions (for 'simple-qa'):**
1.  **Relevance & Specificity:** Questions must be directly pertinent to the specified 'interviewType'. If 'jobTitle' and 'jobDescription' are provided, questions must be deeply tailored to the responsibilities, technologies, and domain mentioned.
2.  **Difficulty Calibration (FAANG Level):** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level, such as:
    *   **Ambiguity:** The degree to which the problem is defined (e.g., L3/L4 might get well-defined problems, L5/L6 more ambiguous ones).
    *   **Complexity:** The intricacy of the problem and the expected solution (e.g., L4 handles 'straightforward' problems, L6 handles 'complex' multi-faceted problems).
    *   **Scope & Impact:** The breadth of the problem and the expected scale of the solution's impact.
    *   **Execution:** The expected level of independence, strategic thinking vs. tactical execution. (e.g. L4 focuses on goals where strategy is defined, L6 defines strategy).
    Adjust the nature of the questions to reflect these expectations. For example, higher levels might require more strategic thinking, dealing with greater ambiguity, or considering larger scale.
3.  **Clarity & Conciseness:** Questions must be unambiguous, clear, and easy to understand.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' (if provided) or core competencies expected for the 'interviewType' and 'faangLevel'. If an 'interviewFocus' is provided, this should be a primary theme.
5.  **Open-Ended:** Questions should encourage detailed, reasoned responses, not simple yes/no answers.
6.  **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding. Do not generate questions *directly about* the resume content itself unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences.
7.  **Tool Usage for Clarity:** If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights, don't just repeat.

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
1.  For the 'simple-qa' style, questions should be direct, standalone, and suitable for a straightforward question-and-answer format.
2.  Ensure questions are tailored to the 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel' (calibrating for ambiguity, complexity, scope, execution), any 'targetedSkills', and particularly the 'interviewFocus' if provided. The 'interviewFocus' should guide the selection or framing of at least some questions.
3.  Generate 5-10 diverse questions that cover different facets of the 'interviewType'. For example, for "Product Sense," include questions on strategy, execution, metrics, and user understanding, all potentially colored by the 'interviewFocus'.

{{else}}
This interview style ({{{interviewStyle}}}) is not directly handled by this prompt. Case studies and Take-home assignments are generated by specialized processes.
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Pay special attention to Amazon's Leadership Principles.
1.  **Behavioral:** Many questions MUST provide an opportunity to demonstrate these principles. Frame questions using situations or ask for examples (e.g., "Tell me about a time you Insisted on the Highest Standards, even when it was difficult, especially concerning {{{interviewFocus}}}.")
2.  **Product Sense / Technical System Design:** Frame questions to subtly align with principles like Customer Obsession (e.g., "How would you design this system to ensure the best possible customer experience under failure conditions, particularly for {{{interviewFocus}}}?"), Ownership, or Invent and Simplify (e.g., "Propose a significantly simpler approach to solve X problem related to {{{interviewFocus}}}.").
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
        const genericFallback = ["Tell me about yourself.", "Why are you interested in this role?", "Describe a challenging project you worked on.", "What are your strengths?", "What are your weaknesses?"];
        const numQuestions = 7; 
        const selectedFallback = genericFallback.slice(0, Math.min(numQuestions, genericFallback.length));
        return { customizedQuestions: selectedFallback };
    }
    return output!;
  }
);

    