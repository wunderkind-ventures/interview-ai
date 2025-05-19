
'use server';

/**
 * @fileOverview Customizes interview questions based on a provided job description, interview type, style, targeted skills, and other factors.
 *
 * - customizeInterviewQuestions - A function that customizes interview questions.
 * - CustomizeInterviewQuestionsInput - The input type for the customizeInterviewQuestions function.
 * - CustomizeInterviewQuestionsOutput - The return type for the customizeInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AMAZON_LEADERSHIP_PRINCIPLES } from '@/lib/constants';
import { getTechnologyBriefTool } from '../tools/technology-tools';

const CustomizeInterviewQuestionsInputSchema = z.object({
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
    .describe('The target FAANG level for difficulty adjustment. This is critical for calibrating question complexity.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the user wants to focus on. Prioritize questions that assess these skills.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company the user is interviewing for (e.g., Amazon, Google). This can influence question style and thematic focus.'),
});

export type CustomizeInterviewQuestionsInput = z.infer<
  typeof CustomizeInterviewQuestionsInputSchema
>;

const CustomizeInterviewQuestionsOutputSchema = z.object({
  customizedQuestions: z
    .array(z.string())
    .describe('An array of customized interview questions. For "take-home" style, this will contain a single, comprehensive assignment description.'),
});

export type CustomizeInterviewQuestionsOutput = z.infer<
  typeof CustomizeInterviewQuestionsOutputSchema
>;

export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput
): Promise<CustomizeInterviewQuestionsOutput> {
  return customizeInterviewQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customizeInterviewQuestionsPrompt',
  tools: [getTechnologyBriefTool],
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: CustomizeInterviewQuestionsOutputSchema,
  },
  prompt: `You are an expert Interview Architect AI, highly skilled in crafting FAANG-level interview questions and take-home assignments. Your primary function is to generate tailored interview content based on the detailed specifications provided. You must meticulously consider all inputs to create relevant, challenging, and insightful questions or assignments.

**Core Instructions & Persona:**
- Your persona is that of a seasoned hiring manager and curriculum designer from a top-tier tech company (like Google, Meta, or Amazon).
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Adhere strictly to the number of questions specified for each style.
- Ensure every question or assignment component directly reflects the provided inputs.

**General Principles for All Questions/Assignments:**
1.  **Relevance & Specificity:** Questions must be directly pertinent to the specified 'interviewType'. If 'jobTitle' and 'jobDescription' are provided, questions must be deeply tailored to the responsibilities, technologies, and domain mentioned. For instance, "Senior Product Manager, Machine Learning" requires significantly more technical depth in product questions than a "Product Manager, Growth."
2.  **Difficulty Calibration:** All content must be precisely calibrated to the 'faangLevel'. An L3 question should be fundamentally different in scope and complexity from an L6 question.
3.  **Clarity & Conciseness:** Questions must be unambiguous, clear, and easy to understand. Avoid jargon unless it's central to the role defined by 'jobTitle' or 'jobDescription'.
4.  **Skill Assessment:** Design questions to effectively evaluate 'targetedSkills' (if provided) or core competencies expected for the 'interviewType' and 'faangLevel'.
5.  **Open-Ended:** Questions should encourage detailed, reasoned responses, not simple yes/no answers.
6.  **Resume Context:** Use the 'resume' (if provided) *only* for contextual understanding of the candidate's potential background. This might subtly influence the angle or examples in questions, but do not generate questions *directly about* the resume content itself, unless the 'interviewType' is "behavioral" and the question explicitly asks for past experiences.
7.  **Tool Usage for Clarity:** If the 'jobDescription' or 'targetedSkills' mention specific technologies crucial for the role, and you need a concise overview to ensure your questions are deeply relevant and appropriately targeted, you may use the \`getTechnologyBriefTool\` to get a summary. Focus on incorporating insights from the tool to make your questions more specific and context-aware. Do not just repeat the tool's output; integrate its information to create better questions.

**Interview Context & Inputs to Consider:**
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
{{#if resume}}Candidate Resume Context: {{{resume}}}{{/if}}
Interview Type: {{{interviewType}}}
Interview Style: {{{interviewStyle}}}
{{#if faangLevel}}FAANG Level: {{{faangLevel}}}{{/if}}
{{#if targetCompany}}Target Company: {{{targetCompany}}}{{/if}}
{{#if targetedSkills.length}}
Targeted Skills:
{{#each targetedSkills}}
- {{{this}}}
{{/each}}
{{/if}}

**Style-Specific Question Generation Logic:**

{{#if (eq interviewStyle "case-study")}}
**Case Study (Multi-turn) - Generate 5-7 questions total:**
Your goal is to simulate a multi-turn conversational deep-dive.
1.  **Internal Deliberation (Chain-of-Thought):**
    *   First, deeply analyze the 'interviewType', 'jobTitle', 'jobDescription', and 'targetedSkills'.
    *   Based on this, brainstorm a single, rich, open-ended core scenario or problem statement. This scenario must be complex enough to sustain multiple follow-up questions.
    *   Then, devise 4-6 probing follow-up questions that logically extend from this core scenario. These follow-ups should explore different facets of the problem, challenge assumptions, and push the candidate to elaborate on their thinking process, trade-offs, and justifications.
2.  **Output Structure:**
    *   The first string in the 'customizedQuestions' array MUST be the broad, initial scenario question.
    *   The subsequent strings in the array MUST be the probing follow-up questions.
    *   The entire set of questions should flow naturally, as if in a real-time conversation, starting broad and progressively narrowing focus or exploring related dimensions.
    *   Example of flow: Initial: "Design a new product for X market." Follow-ups: "Who are the key user segments and how would you prioritize them?", "What would be your MVP and why?", "How would you measure success?", "What are the major risks and how would you mitigate them?".
    *   The questions should be tailored. For 'technical system design', the scenario would be a system to design, and follow-ups would probe architecture, components, scalability, etc. For 'product sense', it could be a product strategy or design challenge. For 'behavioral', it could be a complex hypothetical situation requiring demonstration of specific skills.

{{else if (eq interviewStyle "take-home")}}
**Take-Home Assignment - Generate 1 comprehensive assignment description:**
Adopt the persona of a hiring manager at the 'targetCompany' (or a similar top-tier company if none specified) creating a formal exercise. The assignment must be detailed and self-contained.
1.  **Internal Deliberation (Structure Planning):** Before writing, mentally outline each section described below to ensure coherence and completeness. The 'Problem Scenario' is the heart of the assignment and must be crafted with care.
2.  **Assignment Structure (Strictly Adhere to this Format):**
    The generated string MUST include the following sections, clearly delineated using Markdown-like headings (e.g., "## Title", "### Goal"):

    *   **Title of the Exercise**: Clear, descriptive title (e.g., "Product Strategy for New Market Entry," "System Design for Scalable Notification Service").
    *   **Goal / Objective**: State the main purpose. List 2-4 key characteristics/skills being assessed (align with 'interviewType', 'jobTitle', 'jobDescription', 'targetedSkills').
    *   **The Exercise - Problem Scenario**:
        *   Provide a **detailed and specific** problem scenario.
        *   If 'jobTitle' or 'jobDescription' are provided, the scenario MUST reflect the technical depth, domain, and challenges implied. For a technical PM (e.g., ML, Infrastructure), the scenario should be appropriately technical. For a less technical PM (e.g., growth, UI/UX focus), it should be more strategic or user-focused.
        *   If 'targetCompany' is provided, make the scenario plausible for that company.
        *   The scenario should be complex enough for a detailed written response, appropriate for the 'faangLevel'.
        *   **For "product sense"**: Adapt based on 'jobTitle'/'jobDescription'.
            *   *Strategic/Technical PM*: "Propose a new feature/product for [Product/Service related to targetCompany or JD] to address [Specific User Problem/Market Opportunity]. Define target audience, core functionality, MVP, key success metrics, high-level GTM, and potential technical challenges/dependencies."
            *   *Reflective/Process PM (Product Innovation Story style)*: "Describe an innovative product you were instrumental in delivering. Detail context (product, audience), journey (ideation to launch), impact, and key lessons learned. Focus on your product management process, stakeholder management, and insights."
            *   *Market/User Problem Deep Dive*: "Analyze [Specific Market Trend or User Problem] and propose a product solution. Detail understanding of the problem, target users, potential solutions, validation approach, and how you'd pitch this internally."
        *   **For "technical system design"**: MUST be a technical design challenge (e.g., "Design a [Specific System like 'personalized recommendation feed'] for [Context related to targetCompany or JD]. Focus on architecture, data models, APIs, components, scalability, reliability, cost trade-offs.").
        *   **For "behavioral"**: Primarily a reflective exercise on a complex past project or situation, demonstrating skills like leadership, conflict resolution, etc., as indicated by 'targetedSkills' or typical for 'jobTitle'/'faangLevel'.
    *   **Key Aspects to Consider / Guiding Questions**:
        *   List 5-8 bullet points or questions tailored to the specific 'Problem Scenario' generated above. These guide the candidate's response structure.
        *   *Examples for Strategic/Product*: "Data for analysis?", "Success metrics?", "GTM strategy?", "Risks/challenges?", "Key trade-offs?", "MVP prioritization rationale?".
        *   *Examples for Technical Design*: "System components & interactions?", "Data models & APIs?", "Scalability, reliability, security concerns?", "Key design trade-offs (consistency vs. availability)?", "Testing/validation/monitoring strategy?".
        *   *Examples for Reflective*: "Initial problem/opportunity?", "Success definition & impact measurement?", "Most critical decision & rationale?", "Stakeholder communication/disagreements?", "What would you do differently?".
    *   **Deliverable Requirements**: Specify format (e.g., "Written memo," "Slide deck (PDF)"), constraints (e.g., "Max 6 pages," "10-12 slides," "Approx 1000-2000 words"), and target audience (e.g., "Panel of PMs, Eng Leads, Data Scientists").
    *   **(Optional) Tips for Success**: 1-2 brief, general tips (e.g., "Focus on clear, structured reasoning," "Prioritize practical solutions," "Be explicit about assumptions").

    The entire output for this 'take-home' assignment should be formatted as a single string within the 'customizedQuestions' array.

{{else}}
**Simple Q&A - Generate 5-10 questions:**
1.  For the 'simple-qa' style, questions should be direct, standalone, and suitable for a straightforward question-and-answer format.
2.  Ensure questions are tailored to the 'interviewType', 'jobTitle', 'jobDescription', 'faangLevel', and any 'targetedSkills'.
3.  Generate 5-10 diverse questions that cover different facets of the 'interviewType'. For example, for "Product Sense," include questions on strategy, execution, metrics, and user understanding.
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
**Amazon-Specific Considerations (if 'targetCompany' is Amazon):**
If the 'interviewStyle' is NOT 'take-home':
Pay special attention to Amazon's Leadership Principles.
1.  **Behavioral:** Many questions MUST provide an opportunity to demonstrate these principles. Frame questions using situations or ask for examples (e.g., "Tell me about a time you Insisted on the Highest Standards, even when it was difficult.").
2.  **Product Sense / Technical System Design:** Frame questions to subtly align with principles like Customer Obsession (e.g., "How would you design this system to ensure the best possible customer experience under failure conditions?"), Ownership, or Invent and Simplify (e.g., "Propose a significantly simpler approach to solve X problem.").
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
{{/if}}

**Final Output Format:**
Output the questions/assignment as a JSON array of strings.
- For 'simple-qa' and 'case-study', this will be an array of 5-10 or 5-7 strings respectively.
- For 'take-home', this array will contain a single string with the full assignment text, formatted with Markdown-like headings.
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

const customizeInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'customizeInterviewQuestionsFlow',
    inputSchema: CustomizeInterviewQuestionsInputSchema,
    outputSchema: CustomizeInterviewQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure output is not null and customizedQuestions exists
    if (!output || !output.customizedQuestions) {
        // Fallback or error handling for failed generation
        if (input.interviewStyle === 'take-home') {
            return { customizedQuestions: ["Error: Could not generate take-home assignment. Please try again with more specific job details or contact support if the issue persists."] };
        }
        // Fallback for other styles - generate generic questions if possible or error
        const genericFallback = ["Tell me about yourself.", "Why are you interested in this role?", "Describe a challenging project you worked on."];
        const numQuestions = input.interviewStyle === 'case-study' ? 5 : 7; // Default number
        return { customizedQuestions: genericFallback.slice(0, numQuestions) };
    }
    return output!;
  }
);
