
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
    .enum(['product sense', 'technical system design', 'behavioral'])
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
    .describe('The target FAANG level for difficulty and complexity calibration.'),
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
The assignment must be detailed, well-structured, and directly reflect the 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and especially the 'interviewFocus' if provided.

**Core Instructions & Persona:**
- Your persona is that of a seasoned hiring manager and curriculum designer from a top-tier tech company (like Google, Meta, or Amazon).
- You are creating an assignment designed to help candidates prepare effectively and for companies to assess practical skills.
- The output MUST be a single string containing the full assignment, formatted with Markdown-like headings (e.g., "## Title", "### Goal").

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

**Assignment Generation Logic:**
1.  **Internal Deliberation (Structure Planning):** Before writing, mentally outline each section described below to ensure coherence and completeness. The 'Problem Scenario' is the heart of the assignment and must be crafted with care, heavily influenced by 'interviewFocus'. The assignment should be solvable within a reasonable timeframe for the given 'faangLevel' (e.g., 3-6 hours of work, resulting in a document of specified length).
2.  **Assignment Structure (Strictly Adhere to this Format):**
    The generated string for 'assignmentText' MUST include the following sections, clearly delineated using Markdown-like headings:

    *   **## Title of the Exercise**: Clear, descriptive title (e.g., "Product Strategy for New Market Entry with a focus on {{{interviewFocus}}}", or "Technical Design for a Scalable Notification Service with a focus on {{{interviewFocus}}}"). The title should immediately signal the core task and focus.

    *   **### Goal / Objective**:
        *   State the main purpose of the exercise.
        *   List 2-4 key characteristics/skills being assessed. These MUST align with the 'interviewType', 'jobTitle', 'jobDescription', 'targetedSkills', and 'interviewFocus'. For example, for a technical PM role with focus on ML: "Assessing ability to devise practical algorithmic solutions, communicate technical concepts clearly, and define evaluation metrics for ML-driven features."

    *   **### The Exercise - Problem Scenario**:
        *   Provide a **detailed and specific** problem scenario. The 'interviewFocus' (if provided) MUST be the central challenge or opportunity.
        *   The scenario needs to be rich enough to allow for a comprehensive response.
        *   **Crucially, tailor the technical depth and nature of the scenario based on 'interviewType' and 'jobTitle'/'jobDescription'.**
            *   If 'jobTitle' indicates a highly technical role (e.g., "Product Manager, Machine Learning Platform", "Senior Staff Engineer, Search Infrastructure"), the scenario MUST be technically deep, involving aspects of system architecture, algorithmic choices, data pipelines, etc., all relevant to the 'interviewFocus'.
            *   If 'jobTitle' indicates a less technically-deep PM role (e.g., "Product Manager, User Growth", "Product Manager, Mobile Experience"), the scenario should be more strategic, user-focused, or involve market analysis, GTM strategy, or feature prioritization, always guided by the 'interviewFocus'.
            *   If 'targetCompany' is provided (especially well-known tech companies), make the scenario plausible for that company's product space or challenges.
        *   **For "product sense" (adapt based on 'jobTitle'/'jobDescription' and 'interviewFocus'):**
            *   *Scenario for Strategic/Technical PM*: "Propose a new feature/product for [Relevant Product/Service for targetCompany or based on JD] to address [Specific User Problem/Market Opportunity related to {{{interviewFocus}}}]. You need to define the target audience, core functionality, MVP, key success metrics, high-level GTM strategy, and discuss potential technical challenges/dependencies, all while centering on {{{interviewFocus}}}."
            *   *Scenario for Reflective/Process PM (e.g., Product Innovation Story style)*: "Describe an innovative product or feature you were instrumental in delivering, particularly focusing on how you approached and addressed a challenge related to {{{interviewFocus}}}. Detail the context (product, audience, problem), your journey (ideation to launch, key decisions, stakeholder management), the impact achieved, and key lessons learned. Emphasize your product management process, how you drove alignment, and insights specifically regarding {{{interviewFocus}}}."
            *   *Scenario for Market/User Problem Deep Dive*: "Analyze [Specific Market Trend or User Problem relevant to {{{interviewFocus}}}] and propose a product solution. Your proposal should detail your understanding of the problem space, define target user segments, outline potential solutions, describe your validation approach, and explain how you would pitch this solution internally, with a strong emphasis on the {{{interviewFocus}}} aspects."
        *   **For "technical system design"**: This MUST be a technical design challenge. Example: "Design a [Specific System like 'personalized recommendation feed', 'real-time bidding platform', 'distributed caching layer'] for [Context related to targetCompany or JD, e.g., 'a global e-commerce platform with 100 million DAU'], with a specific emphasis on requirements related to {{{interviewFocus}}}. Your design should cover architecture, data models, APIs, key components, scalability, reliability, and cost trade-offs, all viewed through the lens of {{{interviewFocus}}}."
        *   **For "behavioral" (less common for take-homes, but possible as a reflective leadership/strategy piece):** Primarily a reflective exercise on a complex past project or a significant strategic decision, demonstrating skills like leadership, conflict resolution, large-scale project management, or strategic thinking, as indicated by 'targetedSkills' or typical for 'jobTitle'/'faangLevel', framed by the 'interviewFocus'. Example: "Describe a situation where you led a cross-functional team through a significant technical or product strategy shift focused on {{{interviewFocus}}}. Detail the challenge, your approach, how you managed stakeholders, the outcome, and what you learned about leading change in that context."

    *   **### Key Aspects to Consider / Guiding Questions**:
        *   List 5-8 bullet points or explicit questions tailored to the specific 'Problem Scenario' and 'interviewFocus' generated above. These are not to be answered one-by-one necessarily, but to guide the candidate's thinking and ensure their response covers critical dimensions.
        *   *Examples for Strategic/Product (tailor to specific scenario)*: "What data would you ideally use for analysis related to {{{interviewFocus}}}?", "How would you define and measure success specifically for the {{{interviewFocus}}} aspect of this initiative?", "What are the key GTM considerations for solutions involving {{{interviewFocus}}}?", "What are the major risks and challenges (technical, market, execution) associated with {{{interviewFocus}}} and how might you mitigate them?", "What are the most critical trade-offs you'd need to make when implementing {{{interviewFocus}}}?", "How would you prioritize features for an MVP, keeping {{{interviewFocus}}} central?"
        *   *Examples for Technical Design (tailor to specific system)*: "What are the main components of your proposed system and how do they interact, especially concerning {{{interviewFocus}}}?", "Describe the data models and APIs, considering the demands of {{{interviewFocus}}}?", "How will your design address scalability, reliability, and security, particularly for aspects related to {{{interviewFocus}}}?", "What are the key design trade-offs you made and why, especially those influenced by {{{interviewFocus}}}?", "What is your proposed testing, validation, and monitoring strategy for {{{interviewFocus}}} related components?"
        *   *Examples for Reflective/Behavioral (tailor to scenario)*: "What was the initial problem or opportunity related to {{{interviewFocus}}}?", "How did you define success and measure impact concerning {{{interviewFocus}}}?", "What was the most critical decision you made and what was your rationale, especially regarding {{{interviewFocus}}}?", "How did you manage stakeholder communication and navigate disagreements around {{{interviewFocus}}}?", "Knowing what you know now, what would you do differently regarding {{{interviewFocus}}}?"

    *   **### Deliverable Requirements**:
        *   Specify the expected format (e.g., "A written memo," "A slide deck (PDF format)").
        *   Provide constraints (e.g., "Maximum 6 pages, 12-point font, single-spaced," "10-12 slides, excluding appendix," "Approximately 1000-2000 words").
        *   Define the target audience for the deliverable (e.g., "Assume your memo will be read by a panel of Product Managers, Engineering Leads, and Data Scientists.").

    *   **### (Optional) Tips for Success**:
        *   Provide 1-2 brief, general tips to help the candidate.
        *   Examples: "Focus on clear, structured reasoning, especially how it relates to {{{interviewFocus}}}.", "Prioritize practical and achievable solutions for {{{interviewFocus}}} within the given context.", "Be explicit about any assumptions you make, particularly those concerning {{{interviewFocus}}}."

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
When crafting the assignment, particularly the "Goal / Objective" and "Problem Scenario", subtly weave in opportunities for the candidate to demonstrate understanding or application of Amazon's Leadership Principles, especially if relevant to the 'interviewFocus'. For example, if the focus is on a new product, Customer Obsession is key. If it's about scaling a system, Insist on the Highest Standards or Dive Deep might be relevant.
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output:**
The entire output for 'assignmentText' should be a single string, meticulously structured as described above.
`,
  customize: (prompt, input) => {
    // This is a simplified way to make AMAZON_LEADERSHIP_PRINCIPLES available
    // In a more complex setup, you might pass them as part of the input if they vary or come from a dynamic source.
    return {
      ...prompt,
      prompt: prompt.prompt!.replace(
        '${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}',
        AMAZON_LEADERSHIP_PRINCIPLES.join('\n- ')
      ),
    };
  },
});

const generateTakeHomeAssignmentFlow = ai.defineFlow(
  {
    name: 'generateTakeHomeAssignmentFlow',
    inputSchema: GenerateTakeHomeAssignmentInputSchema,
    outputSchema: GenerateTakeHomeAssignmentOutputSchema,
  },
  async (input: GenerateTakeHomeAssignmentInput) => {
    const {output} = await prompt(input);
    if (!output || !output.assignmentText) {
      // Fallback or error handling for failed generation
      // This is a critical generation, so throwing an error might be more appropriate
      // or returning a predefined "error assignment" text.
      throw new Error(
        'AI failed to generate the take-home assignment text. Please try again or refine your inputs.'
      );
    }
    return output;
  }
);
