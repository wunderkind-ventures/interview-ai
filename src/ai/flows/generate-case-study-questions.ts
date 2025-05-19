
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
// Using the same input schema as the main customization flow for consistency,
// as all fields can be relevant for tailoring case studies.
export type { CustomizeInterviewQuestionsInput } from './customize-interview-questions'; 
import { CustomizeInterviewQuestionsInputSchema } from './customize-interview-questions';


// Output schema should be an array of questions
const GenerateCaseStudyQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(z.string())
    .describe('An array of 5-7 customized case study questions, starting with a broad scenario and followed by probing follow-ups.'),
});
export type GenerateCaseStudyQuestionsOutput = z.infer<
  typeof GenerateCaseStudyQuestionsOutputSchema
>;

// Exported function to be called by the orchestrator
export async function generateCaseStudyQuestions(
  input: z.infer<typeof CustomizeInterviewQuestionsInputSchema> // Use the concrete type here
): Promise<GenerateCaseStudyQuestionsOutput> {
  return generateCaseStudyQuestionsFlow(input);
}

const caseStudyPrompt = ai.definePrompt({
  name: 'generateCaseStudyQuestionsPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema, // Using the comprehensive input schema
  },
  output: {
    schema: GenerateCaseStudyQuestionsOutputSchema,
  },
  prompt: `You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager from a top-tier tech company (e.g., Google, Meta, Amazon)** who excels at designing **compelling and realistic case study interviews**.
Your primary function is to generate a cohesive set of 5-7 questions that simulate a thought-provoking, multi-turn conversational deep-dive.
Your goal is to create a case that not only tests skills but makes the candidate think critically, reveal their problem-solving process, and explore trade-offs. The scenario should NOT have an obvious single 'correct' answer.

**Core Instructions & Persona Nuances:**
- You are creating questions for a mock interview, designed to help candidates prepare effectively for a case study style interaction by presenting them with engaging and realistic challenges.
- Ensure every question directly reflects the provided inputs.

**General Principles for All Questions:**
1.  **Relevance & Specificity:** The case must be directly pertinent to the specified 'interviewType'. If 'jobTitle' and 'jobDescription' are provided, the case must be deeply tailored to the responsibilities, technologies, and domain mentioned.
2.  **Difficulty Calibration (FAANG Level):** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level, such as:
    *   **Ambiguity:** (e.g., L3/L4 might get well-defined problems, L5/L6 more ambiguous ones that require the candidate to seek clarity and define scope. For L6+, the initial scenario should be intentionally somewhat ambiguous, requiring the candidate to ask clarifying questions and narrow the problem space.)
    *   **Complexity:** (e.g., L4 handles 'straightforward' problems, L6 handles 'complex' multi-faceted problems with interdependencies and requires strategic thinking. For L6+, the case should involve multiple variables, potential conflicts, or non-obvious trade-offs.)
    *   **Scope & Impact:** (e.g., team-level vs. org-level vs. company-wide. An L6 case might involve cross-organizational impact or significant business implications.)
    *   **Execution:** (e.g., L5 decides actions to meet goals, L7 sets vision and designs long-term solutions. Higher-level cases should probe for strategic vision and justification, not just tactical steps.)
3.  **Clarity & Conciseness (of your questions):** Questions must be unambiguous and clear.
4.  **Skill Assessment:** Design the case to effectively evaluate 'targetedSkills' (if provided) or core competencies expected for the 'interviewType' and 'faangLevel'. The 'interviewFocus' (if provided) MUST be a central theme.
5.  **Open-Ended:** Questions should encourage detailed, reasoned responses.
6.  **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding of the candidate's likely background. Do not generate questions *directly about* the resume content itself.
7.  **Tool Usage for Clarity:** If crucial technologies are involved in the case, you may use the \`getTechnologyBriefTool\` to get a summary. Integrate insights to make your case more specific and realistic.

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

**Case Study (Multi-turn) - Generate 5-7 questions total:**
Your goal is to simulate a multi-turn conversational deep-dive.
1.  **Internal Deliberation (Chain-of-Thought):**
    *   First, deeply analyze 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and especially 'interviewFocus'.
    *   Based on this, brainstorm a single, rich, open-ended core scenario or problem statement. This scenario must be **compelling and realistic**, presenting a clear problem, opportunity, or strategic decision point relevant to the 'interviewType' and 'jobTitle'. It should be complex enough to sustain multiple follow-up questions and directly reflect the 'interviewFocus' and be appropriately calibrated for 'faangLevel'. The scenario should invite exploration rather than having one simple solution.
    *   Then, devise 4-6 probing follow-up questions that logically extend from this core scenario. These follow-ups should not be random; they should **strategically probe** different dimensions of the candidate's thinking. Consider questions that explore:
        *   How the candidate clarifies the problem and gathers necessary information.
        *   Assumptions the candidate is making and how they validate them.
        *   How the candidate defines success, metrics, and uses data for decisions.
        *   Potential risks, challenges, and mitigation strategies.
        *   Trade-offs considered and clear justification for choices (this is key).
        *   Prioritization frameworks or approaches used.
        *   Handling of edge cases, constraints, or unexpected changes (e.g., 'What if a key dependency is delayed?' or 'How would your approach change if the budget was halved?').
        *   Stakeholder management, communication strategies, and how to gain buy-in (especially for PM or higher-level roles).
        These follow-up questions should encourage the candidate to elaborate on their thinking process, trade-offs, and justifications, all while keeping the 'interviewFocus' in mind and aligned with the 'faangLevel' expectations for depth and complexity.
2.  **Output Structure:**
    *   The first string in the 'customizedQuestions' array MUST be the broad, initial scenario question. It should set the stage.
    *   The subsequent strings in the array MUST be the probing follow-up questions.
    *   The entire set of questions should flow naturally, as if in a real-time conversation, starting broad and progressively narrowing focus or exploring related dimensions. Ensure the scenario has enough depth for a rich discussion but isn't overly prescriptive, allowing the candidate room to define their approach.
    *   Example of flow: Initial: "We're considering launching a new product for X market, focusing on {{{interviewFocus}}}. How would you approach defining the initial strategy and MVP?" Follow-ups: "What key user segments would you target first for {{{interviewFocus}}} and why?", "What are the top 3 metrics you'd track to determine success for this {{{interviewFocus}}} initiative?", "What are the major risks you foresee with this {{{interviewFocus}}} strategy, and how would you propose mitigating them for a {{{faangLevel}}} launch?", "Imagine your engineering counterpart strongly disagrees with your proposed technical approach for {{{interviewFocus}}}. How would you handle that?"
    *   The questions should be tailored. 
        {{#if (eq interviewType "technical system design")}}For 'technical system design', the scenario would be a system to design, and follow-ups would probe architecture, components, scalability, NFRs, data models, trade-offs etc., always relating back to 'interviewFocus' and 'faangLevel' complexity. The initial scenario should describe the problem the system solves, not the system itself.{{/if}}
        {{#if (eq interviewType "product sense")}}For 'product sense', it could be a product strategy, market entry, or feature design challenge centered on 'interviewFocus' and appropriate 'faangLevel' scope. Emphasize user problems and business goals.{{/if}}
        {{#if (eq interviewType "behavioral")}}For 'behavioral', it could be a complex hypothetical workplace situation requiring demonstration of specific skills (e.g., leadership, conflict resolution) based on 'targetedSkills', framed by 'interviewFocus'. {{/if}}
        {{#if (eq interviewType "machine learning")}}
        For 'machine learning', the case study MUST be an ML System Design problem. The scenario should describe a real-world problem requiring an ML solution (e.g., 'Design a system to detect and mitigate bias in our hiring algorithms, focusing on {{{interviewFocus}}}').
        Follow-up questions should probe:
        - Problem framing, data collection, and labeling strategies relevant to {{{interviewFocus}}}.
        - Feature engineering choices and their impact.
        - Model selection rationale (e.g., tradeoffs between different models for {{{interviewFocus}}}, considering interpretability vs. performance for {{{faangLevel}}}).
        - Training, validation, and testing methodologies, including how to handle imbalanced data or domain shift.
        - Deployment considerations (scalability, latency, cost for {{{faangLevel}}}).
        - Monitoring strategies for model performance, drift, and fairness.
        - Ethical considerations specific to the {{{interviewFocus}}} or problem.
        Ensure the complexity and ambiguity are appropriate for '{{{faangLevel}}}'.
        {{/if}}
        {{#if (eq interviewType "data structures & algorithms")}}
        For "Data Structures & Algorithms," the case study should present a more complex algorithmic problem that might involve multiple steps, analyzing trade-offs between solutions, or designing a system component heavily reliant on specific algorithms.
        The initial scenario should set up a real-world-esque problem. Follow-up questions should probe:
        - Initial understanding, clarification of constraints and scale.
        - Different algorithmic approaches and their high-level trade-offs.
        - Detailed discussion of a chosen approach (algorithm, data structures, justification).
        - Rigorous time and space complexity analysis.
        - How the solution handles edge cases, large inputs, or variations of the problem.
        - Potential optimizations and real-world deployment considerations for the algorithm.
        Example Scenario: "Imagine you're designing a core component for a ride-sharing app that matches riders to the nearest available drivers efficiently, with a focus on minimizing wait times ({{{interviewFocus}}}). Describe the algorithmic approach."
        Follow-ups: "What data structures would be most suitable for storing driver locations and rider requests, and why?", "How would your algorithm handle a sudden surge in requests in a specific area?", "Discuss the complexity of your matching algorithm. Are there scenarios where it might perform poorly?", "How would you adapt your solution if drivers had different types of vehicles or riders had preferences?"
        The problem's depth (e.g., requiring graph algorithms, advanced data structures, or probabilistic approaches) should align with 'faangLevel'.
        {{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Pay special attention to Amazon's Leadership Principles. Your role-play as an Amazon interviewer crafting this case should ensure the scenario and follow-ups provide opportunities to demonstrate these.
1.  **Behavioral:** If the case study leans behavioral, questions MUST provide an opportunity to demonstrate these principles.
2.  **Product Sense / Technical System Design / Machine Learning / Data Structures & Algorithms:** Frame the case study and follow-ups to subtly align with principles like Customer Obsession (e.g., "How would your design for {{{interviewFocus}}} ensure the best customer experience even if it means higher operational costs? Justify your stance."), Ownership, Invent and Simplify, or Think Big (e.g., "How could this solution for {{{interviewFocus}}} be scaled or adapted to solve a related, much larger problem across the company?").
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output the questions as a JSON object with a 'customizedQuestions' key, which is an array of 5-7 strings.
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
        // Enhanced fallback for case studies
        const scenarioType = input.interviewType === "technical system design" ? "system design challenge" :
                             input.interviewType === "machine learning" ? "ML problem" :
                             input.interviewType === "data structures & algorithms" ? "algorithmic design task" :
                             "product strategy scenario";

        const fallbackScenario = `Imagine you are a ${input.jobTitle || 'professional'} at a company like ${input.targetCompany || 'a leading tech firm'}. You are tasked with addressing a ${scenarioType} related to "${input.interviewFocus || input.interviewType}" at the ${input.faangLevel || 'expected'} level of complexity. Describe your initial approach to understanding and scoping this problem.`;
        const fallbackFollowUps = [
            "What are the first 2-3 critical questions you would ask to clarify the requirements and constraints?",
            "What key metrics would you consider to measure success for this initiative?",
            "Outline potential challenges or risks you anticipate and how you might begin to address them.",
            "How would you structure your thinking to present a solution or strategy for this problem?"
        ];
        return { customizedQuestions: [fallbackScenario, ...fallbackFollowUps.slice(0, Math.max(0, 4 - (input.jobTitle ? 0:1) )) ] }; // Ensure 2-5 questions
    }
    return output;
  }
);

