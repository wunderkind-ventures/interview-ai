
'use server';
/**
 * @fileOverview Generates a set of case study questions for an interview.
 *
 * - generateCaseStudyQuestions - A function that handles the case study question generation process.
 * - GenerateCaseStudyQuestionsInput - The input type for the generateCaseStudyQuestions function.
 * - GenerateCaseStudyQuestionsOutput - The return type for the generateCaseStudyQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
export type { CustomizeInterviewQuestionsInput } from './customize-interview-questions';
import { CustomizeInterviewQuestionsInputSchema } from './customize-interview-questions';


// Output schema should be an array of question objects, each with text and characteristics
const CaseStudyQuestionWithCharacteristicsSchema = z.object({
    questionText: z.string(),
    idealAnswerCharacteristics: z.array(z.string()).optional().describe("Brief key characteristics a strong answer to this specific case question/scenario would demonstrate."),
});

export const GenerateCaseStudyQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(CaseStudyQuestionWithCharacteristicsSchema)
    .describe('An array of 5-7 customized case study questions, starting with a broad scenario and followed by probing follow-ups, each with ideal answer characteristics.'),
});
export type GenerateCaseStudyQuestionsOutput = z.infer<
  typeof GenerateCaseStudyQuestionsOutputSchema
>;

// Exported function to be called by the orchestrator
export async function generateCaseStudyQuestions(
  input: z.infer<typeof CustomizeInterviewQuestionsInputSchema>
): Promise<GenerateCaseStudyQuestionsOutput> {
  return generateCaseStudyQuestionsFlow(input);
}

const caseStudyPrompt = ai.definePrompt({
  name: 'generateCaseStudyQuestionsPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: GenerateCaseStudyQuestionsOutputSchema,
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)** who excels at designing **compelling and realistic case study interviews**.
Your primary function is to generate a cohesive set of 5-7 questions that simulate a thought-provoking, multi-turn conversational deep-dive.
Your goal is to create a case that not only tests skills but makes the candidate think critically, reveal their problem-solving process, and explore trade-offs. The scenario should NOT have an obvious single 'correct' answer.

**Core Instructions & Persona Nuances:**
- You are creating questions for a mock interview, designed to help candidates prepare effectively for a case study style interaction.
- Your persona is that of a seasoned hiring manager from a top-tier tech company. You excel at designing engaging and realistic case studies that make candidates think.
- Ensure every question directly reflects the provided inputs.
- AVOID asking questions that can be answered with a simple 'yes' or 'no'.

**Input Utilization & Context:**
- **Job Title & Description:** Use 'jobTitle' and 'jobDescription' (if provided) to deeply tailor the case scenario and follow-up questions to the responsibilities, technologies, and domain mentioned.
- **FAANG Level:** All content must be precisely calibrated to the 'faangLevel' (Ambiguity, Complexity, Scope, Execution).
- **Resume Context:** Use 'resume' (if provided) for contextual understanding only. Do not ask direct questions about the resume.
- **Targeted Skills & Focus:** If 'targetedSkills' or 'interviewFocus' are provided, these MUST be central to the case study.

**General Principles for Case Study Design:**
1.  **Relevance & Specificity:** Case must be pertinent to 'interviewType'.
2.  **Difficulty Calibration (FAANG Level):** Calibrate for Ambiguity, Complexity, Scope, Execution. (e.g., L6 case: intentionally ambiguous initial scenario, complex problem with multiple variables, broader impact, probing for strategic vision).
3.  **Clarity & Conciseness (of your questions):** Questions must be unambiguous.
4.  **Skill Assessment:** Design to evaluate 'targetedSkills' and 'interviewFocus'.
5.  **Open-Ended & Probing:** Initial scenario should be open; follow-ups should probe deeply.
6.  **Tool Usage for Clarity:** Use \`getTechnologyBriefTool\` if needed to make the case realistic.

**Output Requirement - Ideal Answer Characteristics:**
For EACH question (both the initial scenario and each follow-up), you MUST provide a brief list (2-3 bullet points) of 'idealAnswerCharacteristics'. These are key elements or qualities a strong answer to THAT SPECIFIC part of the case study would exhibit.
- For the initial scenario: Characteristics might focus on problem framing, clarification, initial approach.
- For follow-ups: Characteristics might focus on depth of analysis, specific trade-offs, risk assessment, metric definition, etc.

**Interview Context & Inputs to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context: {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: case-study
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Case Study (Multi-turn) - Generate 5-7 total question objects, each with 'questionText' and 'idealAnswerCharacteristics':**
Your goal is to simulate a multi-turn conversational deep-dive.
1.  **Internal Deliberation (Chain-of-Thought):**
    *   Analyze inputs, brainstorm a compelling, realistic core scenario for the 'interviewType', 'jobTitle', 'faangLevel', and 'interviewFocus'.
    *   Devise 4-6 probing follow-up questions that logically extend from this core scenario, exploring different dimensions (clarification, assumptions, metrics, risks, trade-offs, prioritization, edge cases, stakeholder management).
2.  **Output Structure:**
    *   The 'customizedQuestions' array should contain objects. Each object has 'questionText' and 'idealAnswerCharacteristics'.
    *   The first object is the broad, initial scenario. Subsequent objects are the probing follow-ups.
    *   The entire set should flow naturally.
    *   Tailor the scenario type based on 'interviewType':
        {{#if (eq interviewType "technical system design")}}For 'technical system design', the scenario would be a system to design (problem, not system itself).{{/if}}
        {{#if (eq interviewType "product sense")}}For 'product sense', a product strategy, market entry, or feature design challenge.{{/if}}
        {{#if (eq interviewType "behavioral")}}For 'behavioral', a complex hypothetical workplace situation.{{/if}}
        {{#if (eq interviewType "machine learning")}}
        For 'machine learning', an ML System Design problem. Follow-ups probe problem framing, data, features, model selection, training, deployment, monitoring, ethics.
        {{/if}}
        {{#if (eq interviewType "data structures & algorithms")}}
        For "Data Structures & Algorithms," a complex algorithmic problem. Follow-ups probe understanding, approaches, detailed algorithm, data structures, complexity, edge cases, optimizations.
        {{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Ensure the case study provides opportunities to demonstrate Amazon's Leadership Principles, relevant to 'interviewFocus' and 'faangLevel'.
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output a JSON object with a 'customizedQuestions' key. This key holds an array of objects, where each object has:
- 'questionText': The question itself (string).
- 'idealAnswerCharacteristics': An array of 2-3 strings describing elements of a strong answer for that specific question part.
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

const generateCaseStudyQuestionsFlow = ai.defineFlow(
  {
    name: 'generateCaseStudyQuestionsFlow',
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: GenerateCaseStudyQuestionsOutputSchema,
  },
  async (input: z.infer<typeof CustomizeInterviewQuestionsInputSchema>): Promise<GenerateCaseStudyQuestionsOutput> => {
    const {output} = await caseStudyPrompt(input);
    if (!output || !output.customizedQuestions || output.customizedQuestions.length < 2) {
        const scenarioType = input.interviewType === "technical system design" ? "system design challenge" :
                             input.interviewType === "machine learning" ? "ML problem" :
                             input.interviewType === "data structures & algorithms" ? "algorithmic design task" :
                             "product strategy scenario";

        const fallbackScenario = {
            questionText: `Imagine you are a ${input.jobTitle || 'professional'} at a company like ${input.targetCompany || 'a leading tech firm'}. You are tasked with addressing a ${scenarioType} related to "${input.interviewFocus || input.interviewType}" at the ${input.faangLevel || 'expected'} level of complexity. Describe your initial approach to understanding and scoping this problem.`,
            idealAnswerCharacteristics: ["Clear problem definition", "Identification of key unknowns", "Initial plan for information gathering"]
        };
        const fallbackFollowUps = [
            { questionText: "What are the first 2-3 critical questions you would ask to clarify the requirements and constraints?", idealAnswerCharacteristics: ["Insightful clarification questions", "Focus on critical information gaps"] },
            { questionText: "What key metrics would you consider to measure success for this initiative?", idealAnswerCharacteristics: ["Relevant and measurable metrics", "Alignment with business goals"] },
            { questionText: "Outline potential challenges or risks you anticipate and how you might begin to address them.", idealAnswerCharacteristics: ["Identification of plausible risks", "Proactive mitigation strategies"] },
            { questionText: "How would you structure your thinking to present a solution or strategy for this problem?", idealAnswerCharacteristics: ["Logical communication structure", "Clear articulation of ideas"] }
        ];
        const numFollowUps = Math.max(0, 4 - (input.jobTitle ? 0:1) ); // Ensure 2-5 questions total
        return { customizedQuestions: [fallbackScenario, ...fallbackFollowUps.slice(0, numFollowUps) ] };
    }
    return output;
  }
);
