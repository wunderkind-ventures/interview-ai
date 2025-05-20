
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

// Input schema for the flow (NOT EXPORTED)
const GenerateTakeHomeAssignmentInputSchema = z.object({
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

export type GenerateTakeHomeAssignmentInput = z.infer< // EXPORTED (Type)
  typeof GenerateTakeHomeAssignmentInputSchema
>;

// Output schema for the flow (NOT EXPORTED)
const GenerateTakeHomeAssignmentOutputSchema = z.object({
  assignmentText: z
    .string()
    .describe('The full text of the generated take-home assignment, formatted with Markdown-like headings.'),
  idealSubmissionCharacteristics: z.array(z.string()).optional().describe("Key characteristics or elements a strong submission for this take-home assignment would demonstrate, considering the problem, deliverables, and FAANG level."),
});

export type GenerateTakeHomeAssignmentOutput = z.infer< // EXPORTED (Type)
  typeof GenerateTakeHomeAssignmentOutputSchema
>;

// Main exported function that calls the flow
export async function generateTakeHomeAssignment( // EXPORTED (Async Function)
  input: GenerateTakeHomeAssignmentInput
): Promise<GenerateTakeHomeAssignmentOutput> {
  return generateTakeHomeAssignmentFlow(input);
}

// Internal prompt definition
const takeHomeAssignmentPrompt = ai.definePrompt({
  name: 'generateTakeHomeAssignmentPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: GenerateTakeHomeAssignmentInputSchema,
  },
  output: {
    schema: GenerateTakeHomeAssignmentOutputSchema,
  },
  customize: (promptDef, callInput) => ({
      ...promptDef,
    context: {
      AMAZON_LEADERSHIP_PRINCIPLES,
    },
  }),
  prompt: `You are an **Expert Interview Assignment Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate a single, comprehensive, and self-contained take-home assignment based on the provided specifications.
The output MUST be a JSON object with 'assignmentText' (string) and 'idealSubmissionCharacteristics' (array of strings). The 'assignmentText' should contain the full assignment, formatted with Markdown-like headings (e.g., "## Title", "### Goal").

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager from a top-tier tech company. Your goal is to craft assignments that assess practical skills, problem-solving abilities, and communication clarity.
- Ensure every part of the assignment directly reflects the provided inputs.
- The assignment must be detailed, well-structured, and directly reflect 'interviewType', 'jobTitle', 'jobDescription', 'targetedSkills', 'interviewFocus', and crucially, the 'faangLevel'.
- For the given 'faangLevel', consider common industry expectations regarding: Ambiguity, Complexity, Scope, and Execution.

**FAANG Level Calibration:**
The 'faangLevel' is critical. Calibrate the assignment based on typical expectations for Ambiguity, Complexity, Scope, and Execution for that level.
The problem scenario, guiding questions, and expected depth of the deliverable MUST reflect these level-specific expectations.
- Example: An L3/L4 assignment: well-defined problem, clear expected output.
- Example: An L5/L6 assignment: more ambiguous problem, requires candidate to define scope, make assumptions, propose a strategic solution with trade-offs.
- Example: An L7 assignment: highly complex, strategic, or organization-wide problem with significant ambiguity.

**Output Requirement - Ideal Submission Characteristics:**
For the assignment generated, you MUST also provide 'idealSubmissionCharacteristics', a list of 3-5 key elements a strong submission would typically exhibit for THIS SPECIFIC assignment, considering the 'interviewType', 'faangLevel', and 'interviewFocus'.
- Example for Product Sense L6 "Develop GTM strategy": Characteristics like "Deep understanding of target users", "Clear value proposition", "Comprehensive GTM plan", "Data-driven success metrics", "Executive-level communication".
- Example for DSA L5 "Design ride-sharing dispatch algorithm": Characteristics like "Correct and efficient algorithm", "Justified data structures for real-time updates", "Rigorous time/space complexity analysis", "Thorough edge case handling", "Clear explanation of trade-offs".

**Input Context to Consider:**
Interview Type: {{{interviewType}}}
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description Context:
{{{jobDescription}}}
(Use this to understand relevant problems, technologies, and responsibilities.)
{{/if}}
FAANG Level: {{{faangLevel}}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

**Internal Reflection on Ideal Submission Characteristics (Guiding your assignment generation):**
Before finalizing the assignment, briefly consider the key characteristics or elements a strong submission would demonstrate (e.g., clear problem definition for Product Sense; robustness, scalability for System Design; sound ML model choice for ML; correct algorithm and complexity analysis for DSA). This internal reflection will help ensure the assignment is well-posed and effectively tests the intended skills for the given 'faangLevel'. You DO need to output these characteristics in the 'idealSubmissionCharacteristics' field.

**Assignment Generation Logic:**
1.  **Structure Planning:** Mentally outline each section described below. The 'Problem Scenario' must be crafted with care, heavily influenced by 'interviewFocus' and calibrated for 'faangLevel'.
2.  **Assignment Structure (Strictly Adhere to this Format for 'assignmentText'):**

    *   **## Title of the Exercise**: Clear, descriptive title. Example: "Take-Home Exercise: [Specific Problem or Domain]"

    *   **### Goal / Objective**:
        *   State the main purpose, reflecting 'faangLevel' and 'interviewType'.
        *   List 2-4 key skills being assessed, aligned with 'targetedSkills' and 'jobTitle'.

    *   **### The Exercise - Problem Scenario**:
        *   Provide a detailed and specific problem scenario. 'interviewFocus' MUST be central.
        *   Calibrate technical depth based on 'interviewType', 'jobTitle', 'jobDescription', and 'faangLevel'.
            *   **For "product sense"**:
                *   If 'jobTitle' or 'jobDescription' suggest a highly technical PM role (e.g., "PM, Machine Learning Platforms"), the scenario should involve more technical considerations (e.g., API design, data model implications, ML feasibility). Base the scenario on the 'interviewFocus' if provided.
                *   If the role seems less technically deep (e.g., "Product Manager, Growth") or if the 'interviewFocus' is on strategy or reflection, generate a "Product Innovation Story" style assignment: ask the candidate to describe an innovative product they delivered, focusing on context, journey, impact, and lessons learned, especially if 'interviewFocus' is about past experiences or achievements.
                *   Otherwise, default to product strategy, market entry analysis, feature deep-dive, or metrics definition based on 'interviewFocus'.
            *   **For "technical system design"**: A specific technical system design challenge (e.g., "Design a scalable notification system," "Architect a real-time analytics pipeline"). The problem must be directly related to the 'interviewFocus' if provided.
            *   **For "behavioral"**: A reflective exercise asking the candidate to describe a complex past project, a significant challenge, or a strategic decision they drove. Focus on role, actions, outcomes, learnings (STAR method implicitly encouraged), especially if 'interviewFocus' aligns with such a reflection.
            *   **For "machine learning"**: A detailed ML system design challenge (e.g., "Design a fraud detection system") or a comprehensive proposal for an ML initiative (e.g., "Propose an ML-based solution to improve user retention"). The problem should be directly based on 'interviewFocus'.
            *   **For "data structures & algorithms"**: A comprehensive algorithmic problem requiring detailed textual design, pseudo-code, complexity analysis, and discussion of edge cases. More involved than a typical live coding problem. The problem should relate to 'interviewFocus' if applicable.

    *   **### Key Aspects to Consider / Guiding Questions**:
        *   List 5-8 bullet points or explicit questions tailored to the 'Problem Scenario', 'interviewFocus', 'interviewType', and 'faangLevel'.
        *   *Example for System Design:* "What are the key components?", "How will it scale?", "Potential bottlenecks?", "Data storage trade-offs."
        *   *Example for Product Sense:* "Target users?", "Key success metrics?", "Major risks & mitigations?", "Outline MVP."
        *   *Example for ML:* "What data would you use?", "What's your proposed model architecture?", "How would you evaluate performance?", "Deployment considerations?"
        *   *Example for DSA:* "Explain your algorithm", "Analyze time/space complexity", "Discuss edge cases and constraints."

    *   **### Deliverable Requirements**:
        *   Specify format (e.g., "Written memo," "Slide deck (PDF)," "Detailed design document," "Textual algorithm explanation").
        *   Provide constraints (e.g., "Max 6 pages," "10-12 slides," "Approx 1000-1500 words").
        *   Define target audience if relevant (e.g., "Product audience," "Technical peers," "Executive review").

    *   **### (Optional) Tips for Success**:
        *   Provide 1-2 brief, general tips (e.g., "Focus on clear communication," "Be explicit about assumptions and trade-offs").

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Subtly weave in opportunities to demonstrate Amazon's Leadership Principles, especially if the assignment type allows (e.g., behavioral reflection, or product strategy).
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES}")}}
{{this}}
{{/each}}
{{/if}}

**Final Output Format:**
Output a JSON object with two keys:
- 'assignmentText': The full assignment text (string, Markdown-like headings).
- 'idealSubmissionCharacteristics': An array of 3-5 strings describing elements of a strong submission.
`,
});

// Internal flow definition
const generateTakeHomeAssignmentFlow = ai.defineFlow(
  {
    name: 'generateTakeHomeAssignmentFlow',
    inputSchema: GenerateTakeHomeAssignmentInputSchema, // Use internal schema
    outputSchema: GenerateTakeHomeAssignmentOutputSchema, // Use internal schema
  },
  async (input: GenerateTakeHomeAssignmentInput): Promise<GenerateTakeHomeAssignmentOutput> => {
    try {
      const {output} = await takeHomeAssignmentPrompt(input);
      if (!output || !output.assignmentText || !output.idealSubmissionCharacteristics || output.idealSubmissionCharacteristics.length === 0) {
        const fallbackTitle = `Take-Home Assignment: ${input.interviewFocus || input.interviewType} Challenge (${input.faangLevel})`;
        const fallbackJobContext = input.jobTitle ? `for the role of ${input.jobTitle}` : `for the specified role`;
        const fallbackCompanyContext = input.targetCompany ? `at ${input.targetCompany}` : `at a leading tech company`;
        const fallbackFocusContext = input.interviewFocus || input.interviewType;
        const fallbackLevelContext = input.faangLevel || 'a relevant professional';

        const fallbackText = `## ${fallbackTitle}

### Goal
Demonstrate your ability to analyze a complex problem related to ${fallbackFocusContext} and propose a well-reasoned solution appropriate for a ${fallbackLevelContext} level ${fallbackJobContext} ${fallbackCompanyContext}.

### Problem Scenario
Develop a detailed proposal for [a relevant problem based on: ${fallbackJobContext}, focusing on ${fallbackFocusContext}]. Consider aspects like [key challenge 1, key challenge 2, and key challenge 3 related to ${input.faangLevel} expectations].

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
        
        console.warn(`AI Take-Home Assignment Generation Fallback - A simplified assignment was generated. Input: ${JSON.stringify(input)}. This might be due to an issue with the AI model or prompt.`);

        return { 
          assignmentText: fallbackText,
          idealSubmissionCharacteristics: fallbackCharacteristics
        };
      }
      return output;
    } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error during take-home assignment generation.';
        console.error(`Error in generateTakeHomeAssignmentFlow (input: ${JSON.stringify(input)}):`, error);
        const errorAssignmentText = `## Error Generating Take-Home Assignment

We encountered an error while trying to generate your take-home assignment for:
- Interview Type: ${input.interviewType}
- Focus: ${input.interviewFocus || 'Not specified'}
- Level: ${input.faangLevel || 'Not specified'}
- Job Title: ${input.jobTitle || 'Not specified'}

Please try configuring your interview again. If the problem persists, the AI model might be temporarily unavailable or the prompt requires further adjustment. The error was: ${errMessage}`;
        
        const errorCharacteristics = ["Error during generation - please report this."];
        
        return {
            assignmentText: errorAssignmentText,
            idealSubmissionCharacteristics: errorCharacteristics
        };
    }
  }
);

    