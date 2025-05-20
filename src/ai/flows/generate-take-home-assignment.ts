
'use server';
/**
 * @fileOverview Generates a detailed take-home assignment for various interview types.
 *
 * - generateTakeHomeAssignment - A function that creates a take-home assignment.
 * - GenerateTakeHomeAssignmentInput - The input type for the assignment generation.
 * - GenerateTakeHomeAssignmentOutput - The return type containing the assignment text.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';

export const GenerateTakeHomeAssignmentInputSchema = z.object({
  interviewType: z
    .enum(['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms'])
    .describe('The type of interview the take-home assignment is for.'),
  jobTitle: z
    .string()
    .optional()
    .describe('The job title, crucial for tailoring technical depth and context.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description, used to extract key responsibilities and technologies.'),
  faangLevel: z
    .string()
    .describe('The target FAANG level for difficulty and complexity calibration. This will influence the expected ambiguity, scope, and complexity of the assignment.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the assignment should aim to assess.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company, which can influence style and thematic focus (e.g., Amazon and LPs).'),
  interviewFocus: z
    .string()
    .optional()
    .describe('A specific focus area or sub-topic to be the central theme of the assignment.'),
});

export type GenerateTakeHomeAssignmentInput = z.infer<
  typeof GenerateTakeHomeAssignmentInputSchema
>;

export const GenerateTakeHomeAssignmentOutputSchema = z.object({
  assignmentText: z
    .string()
    .describe('The full text of the generated take-home assignment, formatted with Markdown-like headings.'),
  idealSubmissionCharacteristics: z.array(z.string()).optional().describe("Key characteristics or elements a strong submission for this take-home assignment would demonstrate, considering the problem, deliverables, and FAANG level."),
});

export type GenerateTakeHomeAssignmentOutput = z.infer<
  typeof GenerateTakeHomeAssignmentOutputSchema
>;

export async function generateTakeHomeAssignment(
  input: GenerateTakeHomeAssignmentInput
): Promise<GenerateTakeHomeAssignmentOutput> {
  return generateTakeHomeAssignmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTakeHomeAssignmentPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: GenerateTakeHomeAssignmentInputSchema,
  },
  output: {
    schema: GenerateTakeHomeAssignmentOutputSchema,
  },
  prompt: `You are an expert Interview Assignment Architect AI, specializing in crafting FAANG-level take-home exercises.
Your primary function is to generate a single, comprehensive, and self-contained take-home assignment based on the provided specifications.
You must adopt the persona of a hiring manager at the 'targetCompany' (or a similar top-tier tech company if none specified) creating a formal exercise.
The assignment must be detailed, well-structured, and directly reflect the 'interviewType', 'jobTitle', 'jobDescription', 'targetedSkills', 'interviewFocus', and crucially, the 'faangLevel'.

**Core Instructions & Persona:**
- Your persona is that of a seasoned hiring manager from a top-tier tech company.
- You are creating an assignment designed to help candidates prepare and for companies to assess practical skills.
- The output MUST be a single 'assignmentText' string containing the full assignment, formatted with Markdown-like headings (e.g., "## Title", "### Goal").
- You MUST also output 'idealSubmissionCharacteristics', a list of 3-5 key elements a strong submission would typically exhibit.

**FAANG Level Calibration:**
The 'faangLevel' is critical. Calibrate the assignment based on typical expectations for Ambiguity, Complexity, Scope, and Execution for that level.
The problem scenario, guiding questions, and expected depth of the deliverable MUST reflect these level-specific expectations.

**Output Requirement - Ideal Submission Characteristics:**
In addition to the 'assignmentText', you MUST provide a list (3-5 bullet points) of 'idealSubmissionCharacteristics'. These are key elements or qualities a strong submission for THIS SPECIFIC take-home assignment would typically exhibit, considering the problem, deliverables, 'interviewFocus', 'interviewType', and 'faangLevel'.
- Example for a Product Sense L6 assignment: "Strategic alignment with company goals", "Thorough market and user research", "Clear articulation of trade-offs", "Data-driven success metrics and GTM plan", "Impactful communication for executive audience".
- Example for a DSA L5 assignment: "Correct and efficient algorithmic solution", "Well-justified data structure choices", "Rigorous time/space complexity analysis", "Thorough handling of edge cases", "Clear and logical explanation of the solution".

**Input Context to Consider:**
Interview Type: {{{interviewType}}}
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
FAANG Level: {{{faangLevel}}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Internal Reflection on Ideal Answer Characteristics:**
Before finalizing the assignment, briefly consider the key characteristics or elements a strong submission would demonstrate (e.g., clear problem definition, strategic thinking for Product Sense; robustness, scalability for System Design; sound ML model choice for ML; correct algorithm and complexity analysis for DSA). This internal reflection will help ensure the assignment is well-posed and effectively tests the intended skills for the given 'faangLevel'. You do not need to output these characteristics for *this step*, focus on generating the assignment text and the overall 'idealSubmissionCharacteristics' array.

**Assignment Generation Logic:**
1.  **Structure Planning:** Mentally outline each section described below. The 'Problem Scenario' must be crafted with care, heavily influenced by 'interviewFocus' and calibrated for 'faangLevel'.
2.  **Assignment Structure (Strictly Adhere to this Format for 'assignmentText'):**

    *   **## Title of the Exercise**: Clear, descriptive title.

    *   **### Goal / Objective**:
        *   State the main purpose, reflecting 'faangLevel'.
        *   List 2-4 key characteristics/skills being assessed, aligned with inputs.

    *   **### The Exercise - Problem Scenario**:
        *   Provide a detailed and specific problem scenario. 'interviewFocus' MUST be central.
        *   Tailor technical depth based on 'interviewType', 'jobTitle'/'jobDescription', and 'faangLevel'.
            *   **For "product sense"**:
                *   Adapt based on PM role type and technical depth indicated by 'jobTitle'/'jobDescription'.
                *   Could be: a strategic proposal, a market entry analysis, a feature deep-dive, a user problem analysis (like a "Product Innovation Story" for less technical PMs), or a metrics definition task.
                *   If 'jobDescription' or 'jobTitle' suggest a highly technical PM role (e.g., "PM, Machine Learning Platforms"), the scenario should involve more technical considerations.
            *   **For "technical system design"**: A technical design challenge.
            *   **For "behavioral"**: A reflective exercise on a complex past project or strategic decision, or a hypothetical challenging scenario.
            *   **For "machine learning"**: A detailed ML system design challenge or a comprehensive proposal for an ML initiative.
            *   **For "data structures & algorithms"**: A comprehensive algorithmic problem requiring detailed textual design, analysis, and edge case consideration.

    *   **### Key Aspects to Consider / Guiding Questions**:
        *   List 5-8 bullet points or explicit questions tailored to the 'Problem Scenario', 'interviewFocus', 'interviewType', and 'faangLevel'. These should prompt for depth and cover various angles of the problem.

    *   **### Deliverable Requirements**:
        *   Specify format (e.g., "A written memo," "A slide deck (PDF format)," "A detailed design document").
        *   Provide constraints (e.g., "Maximum 6 pages," "10-12 slides," "Approximately 1000 words").
        *   Define target audience (e.g., "for a Product audience," "for technical peers," "for executive review").

    *   **### (Optional) Tips for Success**:
        *   Provide 1-2 brief, general tips if appropriate (e.g., "Focus on clear communication," "Be explicit about your assumptions").

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Subtly weave in opportunities to demonstrate Amazon's Leadership Principles, especially if the assignment type allows (e.g., behavioral reflection, or product strategy).
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output a JSON object with two keys:
- 'assignmentText': The full assignment text (string, Markdown-like headings).
- 'idealSubmissionCharacteristics': An array of 3-5 strings describing elements of a strong submission.
`,
  customize: (promptDef, callInput) => {
    if (promptDef.prompt && typeof promptDef.prompt === 'string') {
      const newPromptString = promptDef.prompt.replace(
        /\$\{AMAZON_LEADERSHIP_PRINCIPLES_JOINED\}/g, // Use a regex for global replace, just in case
        AMAZON_LEADERSHIP_PRINCIPLES.join('\n- ')
      );
      return {
        ...promptDef,
        prompt: newPromptString,
      };
    }
    return promptDef;
  },
});

const generateTakeHomeAssignmentFlow = ai.defineFlow(
  {
    name: 'generateTakeHomeAssignmentFlow',
    inputSchema: GenerateTakeHomeAssignmentInputSchema,
    outputSchema: GenerateTakeHomeAssignmentOutputSchema,
  },
  async (input: GenerateTakeHomeAssignmentInput): Promise<GenerateTakeHomeAssignmentOutput> => {
    const {output} = await prompt(input);
    if (!output || !output.assignmentText) {
      const fallbackText = `## Take-Home Assignment: ${input.interviewFocus || input.interviewType} Challenge (${input.faangLevel})

### Goal
Demonstrate your ability to analyze a complex problem related to ${input.interviewFocus || input.interviewType} and propose a well-reasoned solution appropriate for a ${input.faangLevel} role.

### Problem Scenario
Develop a detailed proposal for [a relevant problem based on: ${input.jobTitle || 'the role'}, focusing on ${input.interviewFocus || input.interviewType}]. Consider aspects like [key challenge 1, key challenge 2].

### Deliverable
A document (max 5 pages) outlining your approach, analysis, proposed solution, and key considerations.`;
      const fallbackCharacteristics = [
        "Clear problem understanding and scoping.",
        "Well-reasoned approach and justification of choices.",
        "Consideration of potential challenges and trade-offs.",
        `Depth of analysis appropriate for ${input.faangLevel}.`,
        "Clear and concise communication of ideas."
      ];
      
      console.warn(`AI Assignment Generation Fallback - A simplified assignment was generated for ${input.jobTitle || 'generic role'}. You might want to retry or refine inputs for more detail.`);

      return { 
        assignmentText: fallbackText,
        idealSubmissionCharacteristics: fallbackCharacteristics
      };
    }
    return output;
  }
);

    