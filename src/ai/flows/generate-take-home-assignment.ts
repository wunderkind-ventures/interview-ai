
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
  prompt: `You are an **Expert Interview Assignment Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate a single, comprehensive, and self-contained take-home assignment based on the provided specifications.
The output MUST be a single 'assignmentText' string containing the full assignment, formatted with Markdown-like headings (e.g., "## Title", "### Goal").
You MUST also output 'idealSubmissionCharacteristics', a list of 3-5 key elements a strong submission would typically exhibit for this specific assignment.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager from a top-tier tech company. Your goal is to craft assignments that assess practical skills, problem-solving abilities, and communication clarity.
- Ensure every part of the assignment directly reflects the provided inputs.
- The assignment must be detailed, well-structured, and directly reflect 'interviewType', 'jobTitle', 'jobDescription', 'targetedSkills', 'interviewFocus', and crucially, the 'faangLevel'.

**FAANG Level Calibration:**
The 'faangLevel' is critical. Calibrate the assignment based on typical expectations for Ambiguity, Complexity, Scope, and Execution for that level.
The problem scenario, guiding questions, and expected depth of the deliverable MUST reflect these level-specific expectations.
- For example, an L3/L4 assignment might involve a well-defined problem with a clear expected output.
- An L5/L6 assignment might present a more ambiguous problem, requiring the candidate to define scope, make assumptions, and propose a more strategic solution with trade-offs.
- An L7 assignment would typically involve a highly complex, strategic, or organization-wide problem with significant ambiguity.

**Output Requirement - Ideal Submission Characteristics:**
For the assignment generated, you MUST also provide a brief list (3-5 bullet points) of 'idealSubmissionCharacteristics'. These are key elements or qualities a strong submission to THIS SPECIFIC assignment would typically exhibit, considering the 'interviewType', 'faangLevel', and 'interviewFocus'.
- Example for a Product Sense L6 assignment "Develop a GTM strategy for a new AI feature": Ideal characteristics might include "Deep understanding of target user segments", "Clear value proposition and differentiation", "Comprehensive GTM plan with phased rollout", "Data-driven success metrics and KPIs", "Executive-level communication clarity".
- Example for a DSA L5 assignment "Design an algorithm for a ride-sharing service's dispatch system": Ideal characteristics might include "Correct and efficient algorithmic solution for matching riders and drivers", "Well-justified data structure choices for real-time updates", "Rigorous time/space complexity analysis considering scale", "Thorough handling of edge cases and constraints (e.g., traffic, driver availability)", "Clear explanation of the solution's trade-offs".

**Input Context to Consider:**
Interview Type: {{{interviewType}}}
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description Context:
{{{jobDescription}}}
(Use the job description to understand the types of problems, technologies, and responsibilities relevant to the role.)
{{/if}}
FAANG Level: {{{faangLevel}}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills for this assignment:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus for this assignment: {{{interviewFocus}}}{{/if}}

**Internal Reflection on Ideal Answer Characteristics (Guiding your assignment generation):**
Before finalizing the assignment, briefly consider the key characteristics or elements a strong submission would demonstrate (e.g., clear problem definition for Product Sense; robustness, scalability for System Design; sound ML model choice for ML; correct algorithm and complexity analysis for DSA). This internal reflection will help ensure the assignment is well-posed and effectively tests the intended skills for the given 'faangLevel'. You do not need to output *these internal reflections*, focus on generating the assignment text and the overall 'idealSubmissionCharacteristics' array.

**Assignment Generation Logic:**
1.  **Structure Planning:** Mentally outline each section described below. The 'Problem Scenario' must be crafted with care, heavily influenced by 'interviewFocus' and calibrated for 'faangLevel'.
2.  **Assignment Structure (Strictly Adhere to this Format for 'assignmentText'):**

    *   **## Title of the Exercise**: Clear, descriptive title. Example: "Take-Home Exercise: [Specific Problem or Domain]"

    *   **### Goal / Objective**:
        *   State the main purpose of the exercise, reflecting the 'faangLevel' and 'interviewType'.
        *   List 2-4 key skills or characteristics being assessed, clearly aligned with inputs like 'targetedSkills' and 'jobTitle'.

    *   **### The Exercise - Problem Scenario**:
        *   Provide a detailed and specific problem scenario. 'interviewFocus' MUST be central.
        *   Calibrate technical depth based on 'interviewType', 'jobTitle', 'jobDescription', and 'faangLevel'.
            *   **For "product sense"**:
                *   If 'jobTitle' or 'jobDescription' suggest a highly technical PM role (e.g., "PM, Machine Learning Platforms", "Technical Product Manager - API Strategy"), the scenario should involve more technical considerations (e.g., API design choices, data model implications, ML feasibility).
                *   If the role seems less technically deep (e.g., "Product Manager, Growth & Engagement"), the scenario could be more focused on strategy, user experience, metrics, or a reflective "Product Innovation Story" (like the example: "Describe an innovative product you delivered, focusing on context, journey, impact, and lessons learned.").
                *   Other examples: a strategic proposal, a market entry analysis, a feature deep-dive, or a metrics definition task.
            *   **For "technical system design"**: A specific technical system design challenge (e.g., "Design a scalable notification system," "Architect a real-time analytics pipeline").
            *   **For "behavioral"**: A reflective exercise asking the candidate to describe a complex past project, a significant challenge overcome, or a strategic decision they drove. Focus on their role, actions, outcomes, and learnings (STAR method is implicitly encouraged). This is less common for take-homes but possible.
            *   **For "machine learning"**: A detailed ML system design challenge (e.g., "Design a fraud detection system for e-commerce") or a comprehensive proposal for an ML initiative (e.g., "Propose an ML-based solution to improve user retention").
            *   **For "data structures & algorithms"**: A comprehensive algorithmic problem requiring detailed textual design, pseudo-code, analysis of complexity, and discussion of edge cases. This should be more involved than a typical live coding problem.

    *   **### Key Aspects to Consider / Guiding Questions**:
        *   List 5-8 bullet points or explicit questions tailored to the 'Problem Scenario', 'interviewFocus', 'interviewType', and 'faangLevel'. These should prompt for depth and cover various angles of the problem.
        *   *Example for System Design:* "What are the key components?", "How will it scale?", "What are the potential bottlenecks?", "Discuss trade-offs for data storage."
        *   *Example for Product Sense:* "Who are the target users?", "What are the key success metrics?", "What are the major risks and how would you mitigate them?", "Outline a potential MVP."

    *   **### Deliverable Requirements**:
        *   Specify format (e.g., "A written memo," "A slide deck (PDF format)," "A detailed design document," "A structured textual explanation of your algorithm and analysis").
        *   Provide constraints (e.g., "Maximum 6 pages," "10-12 slides," "Approximately 1000-1500 words").
        *   Define target audience if relevant (e.g., "for a Product audience," "for technical peers," "for executive review").

    *   **### (Optional) Tips for Success**:
        *   Provide 1-2 brief, general tips if appropriate (e.g., "Focus on clear communication and structure," "Be explicit about your assumptions and trade-offs").

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
        /\$\{AMAZON_LEADERSHIP_PRINCIPLES_JOINED\}/g,
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
    if (!output || !output.assignmentText || !output.idealSubmissionCharacteristics || output.idealSubmissionCharacteristics.length === 0) {
      const fallbackText = `## Take-Home Assignment: ${input.interviewFocus || input.interviewType} Challenge (${input.faangLevel})

### Goal
Demonstrate your ability to analyze a complex problem related to ${input.interviewFocus || input.interviewType} and propose a well-reasoned solution appropriate for a ${input.faangLevel} role for ${input.jobTitle || 'the specified role'}.

### Problem Scenario
Develop a detailed proposal for [a relevant problem based on: ${input.jobTitle || 'the role'}, focusing on ${input.interviewFocus || input.interviewType} at ${input.targetCompany || 'a leading tech company'}]. Consider aspects like [key challenge 1, key challenge 2, and key challenge 3 related to ${input.faangLevel} expectations].

### Key Aspects to Consider
- What is your overall approach?
- What are the key trade-offs you considered?
- How would you measure success?
- What are potential risks or challenges?
- How does your solution scale or adapt to future needs?

### Deliverable
A document (max 5 pages, or a 10-slide deck) outlining your approach, analysis, proposed solution, and key considerations.

### Tips for Success
- Be clear and concise in your communication.
- State any assumptions you've made.`;

      const fallbackCharacteristics = [
        "Clear problem understanding and scoping.",
        "Well-reasoned approach and justification of choices.",
        "Consideration of potential challenges and trade-offs.",
        `Depth of analysis appropriate for ${input.faangLevel}.`,
        "Clear and concise communication of ideas."
      ];
      
      console.warn(`AI Take-Home Assignment Generation Fallback - A simplified assignment was generated for ${input.jobTitle || 'generic role'}. You might want to retry or refine inputs for more detail.`);

      return { 
        assignmentText: fallbackText,
        idealSubmissionCharacteristics: fallbackCharacteristics
      };
    }
    return output;
  }
);
