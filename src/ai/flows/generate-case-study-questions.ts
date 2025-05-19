
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
import type { CustomizeInterviewQuestionsInput } from './customize-interview-questions'; 
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
  input: CustomizeInterviewQuestionsInput
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
  prompt: `You are an expert Interview Architect AI, specializing in crafting FAANG-level case study interviews.
Your primary function is to generate a cohesive set of 5-7 questions that simulate a compelling, realistic, and thought-provoking multi-turn conversational deep-dive.
You must meticulously consider all inputs to create a relevant, challenging, and insightful case study scenario and follow-up questions.

**Core Instructions & Persona:**
- Your persona is that of a seasoned hiring manager and curriculum designer from a top-tier tech company (like Google, Meta, or Amazon).
- You are creating questions for a mock interview, designed to help candidates prepare effectively for a case study style interaction by presenting them with engaging and realistic challenges.
- Ensure every question directly reflects the provided inputs.

**General Principles for All Questions:**
1.  **Relevance & Specificity:** The case must be directly pertinent to the specified 'interviewType'. If 'jobTitle' and 'jobDescription' are provided, the case must be deeply tailored to the responsibilities, technologies, and domain mentioned.
2.  **Difficulty Calibration (FAANG Level):** All content must be precisely calibrated to the 'faangLevel'. This means considering the expected dimensions for that level, such as:
    *   **Ambiguity:** The degree to which the problem is defined (e.g., L3/L4 might get well-defined problems, L5/L6 more ambiguous ones that require the candidate to seek clarity and define scope).
    *   **Complexity:** The intricacy of the problem and the expected solution (e.g., L4 handles 'straightforward' problems, L6 handles 'complex' multi-faceted problems with interdependencies and requires strategic thinking).
    *   **Scope & Impact:** The breadth of the problem and the expected scale of the solution's impact (e.g., team-level vs. org-level vs. company-wide). An L6 case might involve cross-organizational impact.
    *   **Execution:** The expected level of independence, strategic thinking vs. tactical execution (e.g., L5 decides actions to meet goals, L7 sets vision and designs long-term solutions).
    Adjust the nature of the case scenario and follow-up questions to reflect these expectations. Higher levels should face more ambiguity, require more strategic depth, and deal with broader scope.
3.  **Clarity & Conciseness:** Questions must be unambiguous and clear.
4.  **Skill Assessment:** Design the case to effectively evaluate 'targetedSkills' (if provided) or core competencies expected for the 'interviewType' and 'faangLevel'. The 'interviewFocus' (if provided) MUST be a central theme.
5.  **Open-Ended:** Questions should encourage detailed, reasoned responses.
6.  **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding. Do not generate questions *directly about* the resume content itself for the case study, unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences in the context of the case.
7.  **Tool Usage for Clarity:** If crucial technologies are involved, you may use the \`getTechnologyBriefTool\` to get a summary. Integrate insights to make your case more specific.

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
    *   First, deeply analyze the 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and especially the 'interviewFocus' if provided.
    *   Based on this, brainstorm a single, rich, open-ended core scenario or problem statement. This scenario must be **compelling and realistic**, presenting a clear problem, opportunity, or strategic decision point relevant to the 'interviewType' and 'jobTitle'. It should be complex enough to sustain multiple follow-up questions and directly reflect the 'interviewFocus' and be appropriately calibrated for 'faangLevel'.
    *   Then, devise 4-6 probing follow-up questions that logically extend from this core scenario. These follow-ups should not just be random; they should **strategically probe** different dimensions of the candidate's thinking. Consider questions that explore:
        *   Clarifying questions the candidate might ask back.
        *   Assumptions made by the candidate.
        *   Metrics for success and data-driven decisions.
        *   Potential risks and mitigation strategies.
        *   Trade-offs considered and justification for choices.
        *   Prioritization frameworks or approaches.
        *   Handling of edge cases or unexpected constraints (e.g., 'What if a key technology fails?' or 'What if market conditions suddenly change? Imagine your budget was suddenly halved.').
        *   Stakeholder management or communication strategy (especially for PM or higher-level roles).
        These follow-up questions should encourage the candidate to elaborate on their thinking process, trade-offs, and justifications, all while keeping the 'interviewFocus' in mind and aligned with the 'faangLevel' expectations for depth and complexity.
2.  **Output Structure:**
    *   The first string in the 'customizedQuestions' array MUST be the broad, initial scenario question.
    *   The subsequent strings in the array MUST be the probing follow-up questions.
    *   The entire set of questions should flow naturally, as if in a real-time conversation, starting broad and progressively narrowing focus or exploring related dimensions. Ensure the scenario has enough depth for a rich discussion but isn't overly prescriptive, allowing the candidate room to define their approach. The follow-ups should feel like natural progressions in a conversation, adapting to potential lines of reasoning.
    *   Example of flow: Initial: "Design a new product for X market, with a specific focus on {{{interviewFocus}}}." Follow-ups: "Who are the key user segments for this {{{interviewFocus}}} and how would you prioritize them?", "What would be your MVP for {{{interviewFocus}}} and why?", "How would you measure success specifically for the {{{interviewFocus}}} aspect?", "What are the major risks related to {{{interviewFocus}}} and how would you mitigate them?".
    *   The questions should be tailored. For 'technical system design', the scenario would be a system to design, and follow-ups would probe architecture, components, scalability, etc., always relating back to the 'interviewFocus' and 'faangLevel' complexity. For 'product sense', it could be a product strategy or design challenge centered on the 'interviewFocus' and appropriate 'faangLevel' scope. For 'behavioral', it could be a complex hypothetical situation requiring demonstration of specific skills, potentially framed by the 'interviewFocus'.

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
Pay special attention to Amazon's Leadership Principles.
1.  **Behavioral:** If the case study leans behavioral, questions MUST provide an opportunity to demonstrate these principles. Frame questions using situations or ask for examples (e.g., "Imagine in this scenario, you encountered strong resistance to your proposed {{{interviewFocus}}} strategy. Tell me about a time you Insisted on the Highest Standards to overcome such a challenge.").
2.  **Product Sense / Technical System Design:** Frame the case study and follow-ups to subtly align with principles like Customer Obsession (e.g., "How would your design for {{{interviewFocus}}} ensure the best possible customer experience under failure conditions?"), Ownership, or Invent and Simplify (e.g., "Within this case, propose a significantly simpler approach to solve X problem related to {{{interviewFocus}}}.").
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
  async (input: CustomizeInterviewQuestionsInput): Promise<GenerateCaseStudyQuestionsOutput> => {
    const {output} = await caseStudyPrompt(input);
    if (!output || !output.customizedQuestions || output.customizedQuestions.length < 2) { 
        const fallbackScenario = `Considering your role as a ${input.jobTitle || 'professional'} (${input.faangLevel || 'level'}) and the interview focus on ${input.interviewFocus || input.interviewType}, describe a complex project or challenge you've faced that required handling significant ambiguity. What was the situation, your approach to navigating the ambiguity and complexity, and the outcome?`;
        const fallbackFollowUp = "What were the key trade-offs you had to make, and how did your understanding of the scope and impact influence your decisions?";
        return { customizedQuestions: [fallbackScenario, fallbackFollowUp, "What would you do differently if you faced a similar situation again?"] };
    }
    return output;
  }
);

    
