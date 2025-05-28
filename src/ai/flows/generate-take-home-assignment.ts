
'use server';
/**
 * @fileOverview Generates a detailed take-home assignment for various interview types.
 *
 * - generateTakeHomeAssignment - A function that creates a take-home assignment.
 * - GenerateTakeHomeAssignmentInput - The input type for the assignment generation.
 * - GenerateTakeHomeAssignmentOutput - The return type containing the assignment text.
 */

import {ai as globalAI} from '@/ai/genkit'; // Use globalAI for defining prompt
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';
import { findRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool'; 
import type { CustomizeInterviewQuestionsInput as BaseFlowInputType } from '../schemas'; // Use the base schema type from orchestrator

// Input schema for the flow - this is what this specific flow expects.
// It should be compatible with what the orchestrator passes.
const GenerateTakeHomeAssignmentInputSchema = BaseFlowInputType; // For this flow, input is largely the same as orchestrator's base
export type GenerateTakeHomeAssignmentInput = z.infer<
  typeof GenerateTakeHomeAssignmentInputSchema
>;

// Output schema for the flow
const GenerateTakeHomeAssignmentOutputSchema = z.object({
  assignmentText: z
    .string()
    .describe('The full text of the generated take-home assignment, formatted with Markdown-like headings.'),
  idealSubmissionCharacteristics: z.array(z.string()).optional().describe("Key characteristics or elements a strong submission for this take-home assignment would demonstrate, considering the problem, deliverables, and FAANG level."),
});

export type GenerateTakeHomeAssignmentOutput = z.infer<
  typeof GenerateTakeHomeAssignmentOutputSchema
>;

// Main exported function that calls the flow
export async function generateTakeHomeAssignment(
  input: GenerateTakeHomeAssignmentInput,
  aiInstance: any // Expect an AI instance to be passed
): Promise<GenerateTakeHomeAssignmentOutput> {
  return generateTakeHomeAssignmentFlow(input, aiInstance);
}

// Internal prompt definition
const prompt = globalAI.definePrompt({ // Use globalAI here for definition
  name: 'generateTakeHomeAssignmentPrompt',
  tools: [getTechnologyBriefTool, findRelevantAssessmentsTool], 
  input: {
    schema: GenerateTakeHomeAssignmentInputSchema, // Use the specific input schema for this flow
  },
  output: {
    schema: GenerateTakeHomeAssignmentOutputSchema,
  },
  prompt: `You are an **Expert Interview Assignment Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate a single, comprehensive, and self-contained take-home assignment based on the provided specifications.
If an 'interviewerPersona' is provided (current: '{{{interviewerPersona}}}'), subtly adapt the framing or expectations of the assignment to reflect this persona.
For example:
- 'standard': Balanced and typical assignment.
- 'friendly_peer': Assignment framing might be more collaborative or suggestive.
- 'skeptical_hiring_manager': The assignment might ask for more explicit justifications, risk assessments, or defense of choices.
- 'time_pressed_technical_lead': The assignment might emphasize conciseness, core technical delivery, and efficient solutions.
- 'behavioral_specialist': If the assignment has behavioral elements (e.g., product innovation story), it might ask for deeper reflection on interpersonal dynamics or learning.
- 'antagonistic_challenger': The assignment problem itself might be highly constrained, controversial, or require difficult trade-offs, and the expected deliverable might demand rigorous defense of choices.
- 'apathetic_business_lead': The assignment brief might be intentionally high-level or less directive, requiring the candidate to define the scope and structure their response proactively to demonstrate value.

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

**Tool Usage for RAG:**
- To ensure your generated assignment is high-quality and relevant, you MAY use the \`findRelevantAssessmentsTool\`.
- Formulate a query for the tool based on '{{{interviewType}}}', '{{{faangLevel}}}', and '{{{interviewFocus}}}'.
- Use the retrieved assessment snippets as inspiration for the problem scenario, common challenges, or deliverable expectations.
- **DO NOT simply copy the retrieved content.** Adapt, synthesize, and use it as inspiration to create a *new, unique* take-home assignment.

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
{{#if interviewerPersona}}Interviewer Persona: {{{interviewerPersona}}} (Adapt assignment style if appropriate){{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if interviewFocus}}Specific Focus: {{{interviewFocus}}}{{/if}}

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
            If the 'interviewType' is "product sense":
                If 'jobTitle' or 'jobDescription' suggest a highly technical PM role (e.g., "PM, Machine Learning Platforms"), the scenario should involve more technical considerations (e.g., API design, data model implications, ML feasibility). Base the scenario on the 'interviewFocus' if provided.
                Else if 'interviewFocus' relates to personal reflection or past work (e.g., "describe an innovative product you delivered"), generate a "Product Innovation Story" style assignment: ask the candidate to describe an innovative product they delivered, focusing on context, journey, impact, and lessons learned.
                Else, default to product strategy, market entry analysis, feature deep-dive, or metrics definition based on 'interviewFocus'.
            If the 'interviewType' is "technical system design": A specific technical system design challenge (e.g., "Design a scalable notification system," "Architect a real-time analytics pipeline"). The problem must be directly related to the 'interviewFocus' if provided.
            If the 'interviewType' is "behavioral": A reflective exercise asking the candidate to describe a complex past project, a significant challenge, or a strategic decision they drove. Focus on role, actions, outcomes, learnings (STAR method implicitly encouraged), especially if 'interviewFocus' aligns with such a reflection.
            If the 'interviewType' is "machine learning": A detailed ML system design challenge (e.g., "Design a fraud detection system") or a comprehensive proposal for an ML initiative (e.g., "Propose an ML-based solution to improve user retention"). The problem should be directly based on 'interviewFocus'.
            If the 'interviewType' is "data structures & algorithms": A comprehensive algorithmic problem requiring detailed textual design, pseudo-code, complexity analysis, and discussion of edge cases. More involved than a typical live coding problem. The problem should relate to 'interviewFocus' if applicable.

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

{{#if targetCompany}}
If the targetCompany field has a value like "Amazon" (perform a case-insensitive check in your reasoning and apply the following if true):
**Amazon-Specific Considerations:**
Subtly weave in opportunities to demonstrate Amazon's Leadership Principles, especially if the assignment type allows (e.g., behavioral reflection, or product strategy).
Amazon's Leadership Principles for your reference:
{{{AMAZON_LPS_LIST}}}
End of Amazon-specific considerations.
{{/if}}

**Final Output Format:**
Output a JSON object with two keys:
- 'assignmentText': The full assignment text (string, Markdown-like headings).
- 'idealSubmissionCharacteristics': An array of 3-5 strings describing elements of a strong submission.
`,
  customize: (promptDef, callInput: GenerateTakeHomeAssignmentInput) => {
    let promptText = promptDef.prompt!;
    if (callInput.targetCompany && callInput.targetCompany.toLowerCase() === 'amazon') {
      const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n');
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', lpList);
    } else {
      promptText = promptText.replace('{{{AMAZON_LPS_LIST}}}', 'Not applicable for this company.');
    }
    return {
      ...promptDef,
      prompt: promptText,
    };
  }
});

// Internal flow definition
const generateTakeHomeAssignmentFlow = ai.defineFlow(
  {
    name: 'generateTakeHomeAssignmentFlow',
    inputSchema: GenerateTakeHomeAssignmentInputSchema, // Use the specific input schema
    outputSchema: GenerateTakeHomeAssignmentOutputSchema,
  },
  async (input: GenerateTakeHomeAssignmentInput, aiInstance: any): Promise<GenerateTakeHomeAssignmentOutput> => {
    try {
      const saneInput: GenerateTakeHomeAssignmentInput = {
        ...input,
        interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
      };
      // Use the passed AI instance for the prompt call
      const {output} = await aiInstance.run(prompt, saneInput);

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

        console.warn(`AI Take-Home Assignment Generation Fallback - A simplified assignment was generated. Input: ${JSON.stringify(saneInput)}. This might be due to an issue with the AI model or prompt.`);

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
- Persona: ${input.interviewerPersona || 'Standard'}

Please try configuring your interview again. If the problem persists, the AI model might be temporarily unavailable or the prompt requires further adjustment. The error was: ${errMessage}`;

        const errorCharacteristics = ["Error during generation - please report this."];

        return {
            assignmentText: errorAssignmentText,
            idealSubmissionCharacteristics: errorCharacteristics
        };
    }
  }
);
