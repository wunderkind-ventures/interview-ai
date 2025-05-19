
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

const CustomizeInterviewQuestionsInputSchema = z.object({
  jobDescription: z
    .string()
    .describe('The job description to customize the interview questions for.'),
  resume: z
    .string()
    .optional()
    .describe('The user resume to further customize the interview questions for.'),
  interviewType: z
    .enum(['product sense', 'technical system design', 'behavioral'])
    .describe('The type of interview to generate questions for.'),
  interviewStyle: z
    .enum(['simple-qa', 'case-study', 'take-home'])
    .describe('The style of the interview: simple Q&A, multi-turn case study, or take-home assignment.'),
  faangLevel: z
    .string()
    .optional()
    .describe('The target FAANG level for difficulty adjustment.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills the user wants to focus on.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company the user is interviewing for (e.g., Amazon, Google).'),
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
  input: {
    schema: CustomizeInterviewQuestionsInputSchema,
  },
  output: {
    schema: CustomizeInterviewQuestionsOutputSchema,
  },
  prompt: `You are an expert interviewer and curriculum designer specializing in FAANG-level interviews and take-home assignments.

Your goal is to generate interview questions or a detailed take-home assignment tailored to the inputs provided.

Interview Context:
Job Description: {{{jobDescription}}}
{{#if resume}}Resume (for context, not for generating the assignment content itself): {{{resume}}}{{/if}}
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

{{#if (eq interviewStyle "case-study")}}
For the 'case-study' style, structure the output to simulate a multi-turn conversation.
Start with 1 or 2 broad, open-ended scenario questions suitable for the interview type (e.g., a product design challenge for "product sense", a system scaling problem for "technical system design", or a complex past experience for "behavioral").
The subsequent questions should be probing follow-ups that delve deeper into different facets of the initial scenario(s). These follow-ups should encourage detailed, structured responses and allow for a conversational exploration of the candidate's thought process.
For example, an initial product sense question might be "Design a new product for X market." Follow-up questions could then explore user segments, monetization, MVP features, metrics, and trade-offs.
The total number of questions (initial scenarios + follow-ups) should be between 5 and 10.
The goal is to create a set of questions that naturally flow like a real case study interview, starting broad and then exploring specifics.
{{else if (eq interviewStyle "take-home")}}
For the 'take-home' assignment style, you must generate ONLY ONE detailed assignment description. This description should be structured like a formal take-home exercise document. The goal is to assess the candidate's practical skills, problem-solving abilities, and communication, relevant to the specified 'interviewType', 'faangLevel', 'jobDescription', and 'targetCompany'.

The assignment description MUST include the following sections, clearly delineated:

1.  **Title of the Exercise**:
    *   Create a clear, descriptive title for the take-home assignment. (e.g., "Product Strategy for New Market Entry", "System Design for a Scalable Notification Service").

2.  **Goal / Objective**:
    *   Clearly state the main purpose of the exercise.
    *   List 2-4 key characteristics or skills being assessed. These should align with the 'interviewType' and 'targetedSkills' (if provided). Examples: "Devising high-quality and practical solutions," "Clear and structured communication," "Strategic thinking," "Problem decomposition," "Systems thinking," "Data-driven decision making."

3.  **The Exercise - Problem Scenario**:
    *   Provide a detailed and specific problem scenario relevant to the 'interviewType'.
    *   If 'targetCompany' is provided, make the scenario plausible for that company or a similar one in its industry.
    *   If 'jobDescription' is provided, try to incorporate elements, challenges, or responsibilities mentioned into the scenario.
    *   The scenario should be complex enough to warrant a detailed written response and should be appropriate for the specified 'faangLevel'.
    *   Example for Product Sense: "Propose a new feature for [Product/Service related to targetCompany or JD, e.g., 'enhancing user engagement on a social media platform'] to address [Specific User Problem/Market Opportunity, e.g., 'declining daily active users among a key demographic']. Define the target audience, core functionality, MVP, key success metrics, and a high-level go-to-market strategy."
    *   Example for Technical System Design: "Design a [Specific System, e.g., 'personalized recommendation feed for an e-commerce app' or 'scalable backend for a new real-time collaboration feature'] for [Context related to targetCompany or JD]. Focus on system architecture, data models, API design, component interactions, and key scalability/reliability/cost trade-offs."
    *   Example for Behavioral (if applicable, e.g., written reflection on a past complex project): "Reflect on a complex project or situation from your past experience that aligns with challenges suggested in the 'jobDescription' or typical for the 'faangLevel'. Describe the situation, the actions you took, the rationale behind your decisions, the outcome, and key learnings, particularly focusing on [select 1-2 relevant from 'targetedSkills' or general principles like leadership, conflict resolution, etc.]."

4.  **Key Aspects to Consider / Guiding Questions**:
    *   Provide a list of 5-8 bullet points or questions that the candidate should address in their response. These should guide their thinking and ensure comprehensive coverage of the problem.
    *   These aspects should be tailored to the 'interviewType', 'targetedSkills', and the specific problem scenario.
    *   Examples (adapt based on interview type):
        *   "What data would you need for your analysis/design? How would you obtain or estimate it?"
        *   "What are the potential risks or challenges associated with your proposal, and how would you mitigate them?"
        *   "How would you define and measure the success of your proposed solution/design?"
        *   "What are the key trade-offs you considered in your approach?"
        *   "Outline your A/B testing strategy or validation plan."
        *   "What are the potential ethical considerations?"
        *   "How would your solution evolve over time or scale?"

5.  **Deliverable Requirements**:
    *   Specify the expected format of the submission (e.g., "A written memo," "A slide deck (PDF format)," "A design document with diagrams").
    *   Mention any constraints (e.g., "Maximum 6 pages, excluding appendices," "A 10-12 slide presentation," "Response should be around 1500-2000 words").
    *   Specify the target audience for the deliverable (e.g., "A panel of Product Managers, Engineering Leads, and Data Scientists," "Your future peers and manager").

6.  **(Optional) Tips for Success**:
    *   Include 1-2 brief, general tips for approaching the assignment. Examples: "Focus on clear, structured reasoning and communication," "Prioritize practical and well-justified solutions," "Be explicit about your assumptions."

The entire output for this 'take-home' assignment should be formatted as a single string, which will be the only element in the 'customizedQuestions' array. Use Markdown-like headings (e.g., "## Title", "### Goal") and bullet points for readability.

{{else}}
For the 'simple-qa' style, the questions should be direct and suitable for a simple question and answer format, tailored to the interview type. Generate 5-10 questions.
{{/if}}

{{#if (eq (toLowerCase targetCompany) "amazon")}}
If the interview style is NOT 'take-home': Given the target company is Amazon, pay special attention to Amazon's Leadership Principles. If the interview type is 'behavioral', ensure many questions provide an opportunity to demonstrate these principles. For other interview types, frame questions that align with Amazon's culture of customer obsession, ownership, and invention.
Amazon's Leadership Principles for your reference:
{{#each (raw "${AMAZON_LEADERSHIP_PRINCIPLES_JOINED}")}}
- {{{this}}}
{{/each}}
Suggest situations or ask for examples where the candidate has demonstrated these.
{{/if}}

{{#if (eq interviewStyle "take-home")}}
Generate 1 comprehensive take-home assignment description as detailed above.
{{else}}
Generate 5-10 interview questions.
{{/if}}
Ensure the questions or assignment are relevant and challenging for the specified FAANG level, interview type, interview style, targeted skills (if provided), and target company (if specified, especially Amazon for non-take-home styles).
Output the questions/assignment as a JSON array of strings. For 'take-home', this array will contain a single string with the full assignment text.
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
    return output!;
  }
);


    