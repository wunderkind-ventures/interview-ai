
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
  jobTitle: z
    .string()
    .optional()
    .describe('The job title to customize the interview questions for.'),
  jobDescription: z
    .string()
    .optional()
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
{{#if jobTitle}}Job Title: {{{jobTitle}}}{{/if}}
{{#if jobDescription}}Job Description: {{{jobDescription}}}{{/if}}
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

Consider the job title and job description (if provided) to adjust the technical depth and focus of the questions. For example, a "Senior Product Manager, Machine Learning" should receive more technical questions than a "Product Manager, Growth".

{{#if (eq interviewStyle "case-study")}}
For the 'case-study' style, structure the output to simulate a multi-turn conversation.
Start with 1 or 2 broad, open-ended scenario questions suitable for the interview type (e.g., a product design challenge for "product sense", a system scaling problem for "technical system design", or a complex past experience for "behavioral").
The subsequent questions should be probing follow-ups that delve deeper into different facets of the initial scenario(s). These follow-ups should encourage detailed, structured responses and allow for a conversational exploration of the candidate's thought process.
For example, an initial product sense question might be "Design a new product for X market." Follow-up questions could then explore user segments, monetization, MVP features, metrics, and trade-offs.
The total number of questions (initial scenarios + follow-ups) should be between 5 and 10.
The goal is to create a set of questions that naturally flow like a real case study interview, starting broad and then exploring specifics.
{{else if (eq interviewStyle "take-home")}}
For the 'take-home' assignment style, you must generate ONLY ONE detailed assignment description. This description should be structured like a formal take-home exercise document. The goal is to assess the candidate's practical skills, problem-solving abilities, and communication, relevant to the specified 'interviewType', 'faangLevel', 'jobTitle', 'jobDescription', and 'targetCompany'.

The assignment description MUST include the following sections, clearly delineated:

1.  **Title of the Exercise**:
    *   Create a clear, descriptive title for the take-home assignment. (e.g., "Product Strategy for New Market Entry", "System Design for a Scalable Notification Service", "Product Innovation Story Analysis").

2.  **Goal / Objective**:
    *   Clearly state the main purpose of the exercise.
    *   List 2-4 key characteristics or skills being assessed. These should align with the 'interviewType', 'jobTitle', 'jobDescription' and 'targetedSkills' (if provided). Examples: "Devising high-quality and practical solutions," "Clear and structured communication," "Strategic thinking," "Problem decomposition," "Systems thinking," "Data-driven decision making," "Reflection on product journey and impact."

3.  **The Exercise - Problem Scenario**:
    *   Provide a detailed and specific problem scenario relevant to the 'interviewType' and other inputs. The technical depth and nature of the scenario should reflect the likely requirements of the role as inferred from 'jobTitle', 'jobDescription' and 'targetedSkills'.
    *   If 'targetCompany' is provided, make the scenario plausible for that company or a similar one in its industry.
    *   If 'jobDescription' or 'jobTitle' is provided, try to incorporate elements, challenges, or responsibilities mentioned into the scenario.
    *   The scenario should be complex enough to warrant a detailed written response and should be appropriate for the specified 'faangLevel'.

    *   **If 'interviewType' is "product sense"**:
        *   The scenario could involve (select or adapt based on 'jobTitle', 'jobDescription' and 'targetedSkills' to match the role's likely focus, e.g., strategic, reflective, analytical, or product strategy for a technical product):
            *   **Strategic Proposal**: "Propose a new feature for [Product/Service related to targetCompany or JD, e.g., 'enhancing user engagement on a social media platform'] to address [Specific User Problem/Market Opportunity, e.g., 'declining daily active users among a key demographic']. Define the target audience, core functionality, MVP, key success metrics, and a high-level go-to-market strategy."
            *   **Reflective Analysis (Product Innovation Story style)**: "Describe an innovative product you were instrumental in delivering. Detail the context (product purpose, audience), the journey (how it came to be), its impact post-launch, and key lessons learned that have influenced your approach to product management. Focus on your product management process and insights." (This style is more suitable for less technical PM roles or when specified in Job Title/Description)
            *   **Market/User Problem Deep Dive**: "Analyze [Specific Market Trend or User Problem] and propose a product solution. Detail your understanding of the problem, target users, potential solutions, and how you'd validate your approach."
    *   **If 'interviewType' is "technical system design"**:
        *   The scenario MUST be a technical design challenge (e.g., "Design a [Specific System, e.g., 'personalized recommendation feed for an e-commerce app' or 'scalable backend for a new real-time collaboration feature'] for [Context related to targetCompany or JD]. Focus on system architecture, data models, API design, component interactions, and key scalability/reliability/cost trade-offs.").
    *   **If 'interviewType' is "behavioral"**:
        *   The scenario should primarily be a reflective exercise (e.g., "Reflect on a complex project or situation from your past experience that aligns with challenges suggested in the 'jobTitle' or 'jobDescription' or typical for the 'faangLevel'. Describe the situation, the actions you took, the rationale behind your decisions, the outcome, and key learnings, particularly focusing on [select 1-2 relevant from 'targetedSkills' or general principles like leadership, conflict resolution, etc.]."). This is especially suitable if 'targetedSkills' point to specific behavioral competencies.

4.  **Key Aspects to Consider / Guiding Questions**:
    *   Provide a list of 5-8 bullet points or questions that the candidate should address in their response. These should guide their thinking and ensure comprehensive coverage.
    *   **Crucially, these aspects MUST be tailored to the specific problem scenario generated above and its required technical/strategic/reflective depth (informed by jobTitle/JD).**
    *   Examples for Strategic/Product-Focused Scenarios: "What data would you use for analysis?", "Define success metrics.", "Outline GTM strategy.", "What are risks/challenges?", "What are key trade-offs in your proposal?", "How would you prioritize features for an MVP?".
    *   Examples for Technical Design Scenarios: "Detail system components and their interactions.", "Define data models and APIs.", "Discuss scalability, reliability, and security concerns.", "What are the key trade-offs in your design (e.g., consistency vs. availability)?", "How would you test/validate this system and monitor its performance?".
    *   Examples for Reflective Scenarios (like Product Innovation Story): "What was the initial problem or opportunity?", "How did you define success and measure impact?", "What was the most critical decision you made and its rationale?", "How did you handle stakeholder communication or disagreements?", "What would you do differently if you were to do it again?".

5.  **Deliverable Requirements**:
    *   Specify the expected format of the submission (e.g., "A written memo," "A slide deck (PDF format)," "A design document with diagrams").
    *   Mention any constraints (e.g., "Maximum 6 pages, excluding appendices," "A 10-12 slide presentation," "Response should be around 1000-2000 words").
    *   Specify the target audience for the deliverable (e.g., "A panel of Product Managers, Engineering Leads, and Data Scientists," "Your future peers and manager," "Product leadership").

6.  **(Optional) Tips for Success**:
    *   Include 1-2 brief, general tips for approaching the assignment. Examples: "Focus on clear, structured reasoning and communication," "Prioritize practical and well-justified solutions," "Be explicit about your assumptions," "Use the STAR method for reflective answers if applicable."

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
Ensure the questions or assignment are relevant and challenging for the specified FAANG level, job title, interview type, interview style, targeted skills (if provided), and target company (if specified, especially Amazon for non-take-home styles).
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
