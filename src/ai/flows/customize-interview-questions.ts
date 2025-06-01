'use server';

/**
 * @fileOverview Orchestrates interview question generation.
 *               Delegates to specialized flows for 'take-home' and 'case-study' styles.
 *               Handles 'simple-qa' style directly, now with manual JSON parsing.
 *
 * - customizeInterviewQuestions - Orchestrator function.
 * - CustomizeInterviewQuestionsInput - The input type for the orchestrator.
 * - CustomizeInterviewQuestionsOutput - The return type for the orchestrator.
 */

import { genkit, z, type Genkit as GenkitInstanceType, type ModelReference } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAI, getTechnologyBriefTool as globalGetTechnologyBriefTool, findRelevantAssessmentsTool as globalFindRelevantAssessmentsTool } from '@/ai/genkit';

import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';
import { defineGetTechnologyBriefTool } from '../tools/technology-tools';
import { defineFindRelevantAssessmentsTool } from '../tools/assessment-retrieval-tool';

import { generateTakeHomeAssignment, type GenerateTakeHomeAssignmentInput } from './generate-take-home-assignment';
import { generateInitialCaseSetup, type GenerateInitialCaseSetupInput, type GenerateInitialCaseSetupOutput } from './generate-case-study-questions';

import { CustomizeInterviewQuestionsInputSchema as BaseCustomizeInterviewQuestionsInputSchema } from '../schemas';

// This schema is for the client-side call to this orchestrator.
export type CustomizeInterviewQuestionsInput = z.infer<typeof BaseCustomizeInterviewQuestionsInputSchema>;


// Output schema for individual questions from ANY generation path
const OrchestratorQuestionOutputSchema = z.object({
    questionText: z.string(),
    idealAnswerCharacteristics: z.array(z.string()).optional().describe("Brief key characteristics or elements a strong answer to this specific question/assignment would demonstrate."),
    isInitialCaseQuestion: z.boolean().optional(),
    fullScenarioDescription: z.string().optional().describe("The full descriptive text of the case scenario, provided for the first question of a case study."),
    internalNotesForFollowUpGenerator: z.string().optional().describe("Context for the AI to generate the next dynamic follow-up question in a case study."),
    isLikelyFinalFollowUp: z.boolean().optional().describe("Indicates if this question (in a case study) is likely the final one for the initial setup. Note: dynamic follow-ups will manage their own finality."),
});

// This schema is for the final output of the orchestrator
const CustomizeInterviewQuestionsOutputSchema = z.object({ 
  customizedQuestions: z
    .array(OrchestratorQuestionOutputSchema)
    .describe('An array of customized interview questions/assignments. For case studies, this will contain only the first question along with context for dynamic follow-ups.'),
});
export type CustomizeInterviewQuestionsOutput = z.infer<typeof CustomizeInterviewQuestionsOutputSchema>;


// Main exported orchestrator function
export async function customizeInterviewQuestions(
  input: CustomizeInterviewQuestionsInput,
  options?: { apiKey?: string } 
): Promise<CustomizeInterviewQuestionsOutput> {

  const saneInput: CustomizeInterviewQuestionsInput = {
    ...input,
    jobTitle: input.jobTitle || "",
    jobDescription: input.jobDescription || "",
    resume: input.resume || "",
    targetedSkills: input.targetedSkills || [],
    targetCompany: input.targetCompany || "",
    interviewFocus: input.interviewFocus || "",
    interviewerPersona: input.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
  };

  let aiInstanceToUse: GenkitInstanceType = globalAI;
  let toolsForInstance = [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool];

  if (options?.apiKey) {
    try {
      console.log("[BYOK] Orchestrator: Using user-provided API key for AI operations.");
      const userGoogleAIPlugin = googleAI({ apiKey: options.apiKey });
      const userKit = genkit({
        plugins: [userGoogleAIPlugin],
      });
      // Define tools specifically for this userKit instance
      const userTechTool = await defineGetTechnologyBriefTool(userKit);
      const userAssessTool = await defineFindRelevantAssessmentsTool(userKit);
      
aiInstanceToUse = userKit;
      toolsForInstance = [userTechTool, userAssessTool];

    } catch (e) {
      console.warn(`[BYOK] Orchestrator: Failed to initialize Genkit or define tools with user-provided API key: ${(e as Error).message}. Falling back to default key.`);
      // aiInstanceToUse remains globalAI, toolsForInstance remains global tools
    }
  } else {
    console.log("[BYOK] Orchestrator: No user API key provided; using default global AI instance and tools for customizeInterviewQuestions.");
  }

  if (saneInput.interviewStyle === 'take-home') {
    const takeHomeInput: GenerateTakeHomeAssignmentInput = saneInput;
    try {
      const takeHomeOutput = await generateTakeHomeAssignment(takeHomeInput, { aiInstance: aiInstanceToUse, tools: toolsForInstance, apiKey: options?.apiKey });
      return {
        customizedQuestions: [{
          questionText: takeHomeOutput.assignmentText,
          idealAnswerCharacteristics: takeHomeOutput.idealSubmissionCharacteristics,
        }]
      };
    } catch (error) {
      console.error("Error generating take-home assignment:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error.";
      return { customizedQuestions: [{ questionText: `Failed to generate take-home assignment. The detailed problem statement could not be created. Please ensure all relevant fields are filled. Error: ${errorMsg}` , idealAnswerCharacteristics: [] }] };
    }
  } else if (saneInput.interviewStyle === 'case-study') {
    try {
        const initialCaseOutput: GenerateInitialCaseSetupOutput = await generateInitialCaseSetup(saneInput, { aiInstance: aiInstanceToUse, tools: toolsForInstance, apiKey: options?.apiKey });
        return {
          customizedQuestions: [{
            questionText: initialCaseOutput.firstQuestionToAsk,
            idealAnswerCharacteristics: initialCaseOutput.idealAnswerCharacteristicsForFirstQuestion,
            isInitialCaseQuestion: true,
            fullScenarioDescription: initialCaseOutput.fullScenarioDescription,
            internalNotesForFollowUpGenerator: initialCaseOutput.internalNotesForFollowUpGenerator,
          }]
        };
    } catch (error) {
        console.error("Error generating initial case setup:", error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error generating case study.";
        const fallbackScenario = `Considering your role as a ${saneInput.jobTitle || 'professional'} and the interview focus on ${saneInput.interviewFocus || saneInput.interviewType}, describe a complex project or challenge you've faced. This will serve as our initial case. Error: ${errorMsg}`;
        return {
          customizedQuestions: [
            {
              questionText: fallbackScenario,
              idealAnswerCharacteristics: ["Clarity of situation", "Logical approach", "Measurable outcome"],
              isInitialCaseQuestion: true,
              fullScenarioDescription: fallbackScenario,
              internalNotesForFollowUpGenerator: "Fallback case: focus on project challenge, approach, outcome."
            },
          ]
        };
    }
  }
  return customizeSimpleQAInterviewQuestionsFlow(saneInput, aiInstanceToUse, toolsForInstance);
}

const SimpleQAPromptInputSchema = BaseCustomizeInterviewQuestionsInputSchema.extend({
    isBehavioral: z.boolean(),
    isProductSense: z.boolean(),
    isTechnicalSystemDesign: z.boolean(),
    isMachineLearning: z.boolean(),
    isDSA: z.boolean(),
    isAmazonTarget: z.boolean(),
    isGeneralInterviewType: z.boolean(),
});
type SimpleQAPromptInput = z.infer<typeof SimpleQAPromptInputSchema>;


const SimpleQAQuestionsOutputSchema = z.object({
  customizedQuestions: z.array(
    OrchestratorQuestionOutputSchema
  ).describe('An array of 5-10 customized Q&A questions (or 2-3 for Amazon behavioral), each with text and ideal answer characteristics.'),
});

const AIServiceOutputSchemaSimpleQA = z.object({
  jsonString: z.string().describe("A JSON string representing the Simple Q&A questions and their characteristics, which itself can be parsed into an object matching SimpleQAQuestionsOutputSchema.")
});

// Store the raw prompt template string separately
const SIMPLE_QA_PROMPT_TEMPLATE_STRING = `Generate tailored interview questions.
You are an **Expert Interview Architect AI**, embodying the persona of a **seasoned hiring manager and curriculum designer from a top-tier tech company (e.g., Google, Meta, Amazon)**.
Your primary function is to generate tailored interview content for the 'simple-qa' style ONLY, based on the detailed specifications provided.
You must meticulously consider all inputs to create relevant, challenging, and insightful questions.
Adopt the '{{{interviewerPersona}}}' persona in the style and focus of the questions you generate.
For example:
- 'standard': Balanced and typical questions.
- 'friendly_peer': Collaborative tone, questions might explore thought process more gently.
- 'skeptical_hiring_manager': Questions might probe for weaknesses, edge cases, or justifications more directly.
- 'time_pressed_technical_lead': Questions might be more direct, focused on core technical competency, expecting concise answers.
- 'behavioral_specialist': Deep focus on STAR method and specific behavioral competencies.
- 'antagonistic_challenger': Questions will be challenging, probing, and designed to test resilience and conviction. Expect pushback on assumptions and demand strong justifications.
- 'apathetic_business_lead': Questions may seem broad, disengaged, or slightly vague. The candidate will need to drive the conversation and clearly articulate value to keep this persona engaged.


DO NOT attempt to generate 'take-home' assignments or 'case-study' questions; those are handled by specialized processes called by an orchestrator. You are only responsible for 'simple-qa'.

**Core Instructions & Persona Nuances:**
- Your persona is that of a seasoned hiring manager. Your goal is to craft questions that not only test skills but also make the candidate think critically and reveal their problem-solving process. You want them to leave the mock interview feeling challenged yet enlightened.
- You are creating questions for a mock interview, designed to help candidates prepare effectively.
- Ensure every question directly reflects the provided inputs.
- For L4+ roles, AVOID asking questions that can be answered with a simple 'yes' or 'no'. FOCUS on questions that elicit problem-solving approaches and trade-off discussions.
- **Output Requirement - Ideal Answer Characteristics:** For each question, you MUST provide a brief list (2-4 bullet points) of 'idealAnswerCharacteristics'. These are key elements a strong answer to THAT SPECIFIC question would exhibit.

**Input Utilization & Context:**
- Job Title: {{#if jobTitle}}{{{jobTitle}}}{{else}}Not specified. Generate general questions for the interview type.{{/if}}
- Job Description: {{#if jobDescription}}Provided (see details below if used for tailoring).{{else}}Not specified.{{/if}}
- Candidate Resume Context: {{#if resume}}Provided (use for subtle angling if appropriate for interview type).{{else}}Not specified.{{/if}}
- Interview Type: {{{interviewType}}}
- Interview Style: {{{interviewStyle}}} (This prompt is for 'simple-qa' style)
- FAANG Level: {{#if faangLevel}}{{{faangLevel}}}{{else}}Not specified; assume mid-level.{{/if}}
- Target Company: {{#if targetCompany}}{{{targetCompany}}}{{else}}Not specified.{{/if}}
- Interviewer Persona: {{#if interviewerPersona}}{{{interviewerPersona}}}{{else}}Standard.{{/if}}
- Targeted Skills: {{#if targetedSkills.length}}{{#each targetedSkills}}- {{{this}}} {{/each}}{{else}}None specified; focus on core skills for the interview type and level.{{/if}}
- Specific Focus: {{#if interviewFocus}}{{{interviewFocus}}}{{else}}None specified; generate general questions for the interview type.{{/if}}

**Tool Usage for RAG:**
- If you need inspiration for question types, scenarios, or common pitfalls (e.g., for '{{{interviewType}}}' at '{{{faangLevel}}}' focusing on '{{{interviewFocus}}}'), you MAY use the \`findRelevantAssessmentsTool\`.
- Formulate a query for the tool based on '{{{interviewType}}}', '{{{faangLevel}}}', and '{{{interviewFocus}}}'.
- Use the tool's output to help you generate *new, unique, and relevant* questions. **DO NOT simply copy the retrieved content.** Adapt and synthesize.

**General Principles for All Questions (for 'simple-qa'):**
1.  Relevance & Specificity: Questions must be directly pertinent to 'interviewType'.
2.  Difficulty Calibration (FAANG Level): Calibrate to 'faangLevel' considering Ambiguity, Complexity, Scope, Execution.
3.  Clarity & Conciseness: Questions must be unambiguous.
4.  Skill Assessment: Design questions to effectively evaluate 'targetedSkills' or core competencies. 'interviewFocus' should be a primary theme.
5.  Open-Ended (Crucial for L4+): Questions should encourage detailed, reasoned responses.
6.  Technology Context (Tool Usage): If technologies are crucial, you may use the \`getTechnologyBriefTool\`. Integrate insights to make questions more specific.

{{#if jobDescription}}
---
Job Description Details (if tailoring):
{{{jobDescription}}}
---
{{/if}}

{{#if resume}}
---
Resume Details (if used for context):
{{{resume}}}
---
{{/if}}

**Style-Specific Question Generation Logic (for 'simple-qa' ONLY):**

{{#if isBehavioral}}
  {{#if isAmazonTarget}}
    You are an **experienced Amazon Bar Raiser or Senior Hiring Manager**. Your primary goal is to craft 2-3 distinct behavioral questions for a simulated 1-hour interview block. Each question should be designed to give the candidate an opportunity to share specific experiences demonstrating one or more Amazon Leadership Principles (LPs) using the STAR method.
    1.  Generate 2-3 behavioral questions. Each question should target one or more LPs. Aim for a diverse set of LPs across these questions.
    2.  Phrase questions to naturally elicit STAR method responses (e.g., "Tell me about a time when...", "Describe a situation where...", "Give me an example of...").
    3.  Ensure questions prompt for details about the candidate's specific actions, the impact of those actions, and what they learned. Aim to include questions that allow the candidate to showcase instances where they excelled, and at least one question that specifically probes a situation involving a challenge, setback, or a time they learned from a mistake or failure.
    4.  For each question, the 'idealAnswerCharacteristics' MUST include:
        - "Clear use of STAR method (Situation, Task, Action, Result)."
        - "Specific examples and quantifiable data points where applicable."
        - "Clear demonstration of the targeted Amazon Leadership Principle(s) (e.g., [LP Name])."
        - "Focus on personal contributions ('I' statements)."
        - "Articulation of impact and learnings from the experience, especially from challenges or setbacks."
    The Amazon Leadership Principles for your reference:
{{{AMAZON_LPS_LIST}}}
  {{else}}
    You are an experienced interviewer. Generate 5-7 standard behavioral questions.
    1.  Questions should probe for past behaviors and experiences related to common workplace competencies (teamwork, problem-solving, leadership, conflict resolution, etc.), tailored by 'jobTitle', 'faangLevel', and 'targetedSkills'.
    2.  Use formats like "Tell me about a time...", "Describe a situation where...".
    3.  For each question, 'idealAnswerCharacteristics' should reflect general best practices for behavioral answers, such as:
        - "Provides a specific, relevant example."
        - "Clearly describes the situation and their role."
        - "Details actions taken and thought process."
        - "Explains the outcome and impact."
        - "Includes reflection or lessons learned."
  {{/if}}
{{else if isProductSense}}
  You are an experienced Product Management interviewer. Generate 5-7 product sense questions.
  1. Include questions on product strategy, execution, metrics, user understanding, and problem-solving.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
     - IMPORTANT: If 'interviewFocus' mentions specific behavioral competencies (like Amazon Leadership Principles, e.g., "Dive Deep", "Customer Obsession"), ensure these are assessed *through the lens of product sense questions*. Ask about product strategies, decisions, or experiences that would showcase these principles. For example, "Describe a product strategy you developed that required significant 'Dive Deep'. What did you uncover and how did it impact the outcome?" DO NOT generate separate, direct behavioral questions (e.g., "Tell me about a time...") unless 'isBehavioral' is true. The goal is to evaluate product skills, using the 'interviewFocus' to flavor the product-centric questions.
  3. Example idealAnswerCharacteristics: "User-centric problem definition", "Data-driven approach", "Creative but feasible solutions", "Clear success metrics", "Considers trade-offs".
{{else if isTechnicalSystemDesign}}
  You are an experienced System Design interviewer. Generate 3-5 technical system design prompts.
  1. Ask about designing specific systems or components, focusing on architecture, trade-offs, scalability, reliability, etc.
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics: "Clarifies requirements and constraints", "Proposes a high-level architecture", "Discusses key components and their interactions", "Addresses scalability and performance", "Considers trade-offs and justifies decisions".
{{else if isMachineLearning}}
  You are an experienced Machine Learning interviewer. Generate 5-7 machine learning questions.
  1. Include a mix of conceptual questions (e.g., "Explain...") and high-level ML system design prompts ("Design a system to...").
  2. Tailor to 'jobTitle', 'jobDescription', 'faangLevel', 'targetedSkills', and 'interviewFocus'.
  3. Example idealAnswerCharacteristics (conceptual): "Accurate definition of concept", "Explains pros and cons", "Provides relevant examples or use cases".
  4. Example idealAnswerCharacteristics (system design): "Problem understanding & scoping", "Data considerations (sources, features, biases)", "Model selection and justification", "Evaluation strategy", "Deployment and operational aspects".
{{else if isDSA}}
  You are an experienced Data Structures & Algorithms interviewer. Generate 5-7 DSA problem statements.
  1. Problems should prompt for clarification, approach description, algorithm design, data structure justification, complexity analysis, and edge case consideration.
  2. Tailor difficulty to 'faangLevel'. 'targetedSkills' might guide problem categories (e.g., "Trees & Graphs").
  3. Example idealAnswerCharacteristics: "Clarification of constraints and edge cases", "Efficient algorithmic approach", "Correct data structure choice and justification", "Accurate time/space complexity analysis", "Walkthrough of logic and edge cases".
{{else if isGeneralInterviewType}}
  You are an experienced interviewer. Generate 5-7 general questions relevant to the 'interviewType' ('{{{interviewType}}}'), 'jobTitle', 'faangLevel', and 'interviewFocus'.
  1. Focus on open-ended questions that encourage detailed responses.
  2. Ensure 'idealAnswerCharacteristics' reflect the core skills being tested for that 'interviewType'.
{{else}}
  Fallback Instruction: Generate 3 general professional interview questions suitable for the specified 'faangLevel', 'jobTitle', and 'interviewType'. Ensure 'idealAnswerCharacteristics' are provided for each. This is a safety net.
{{/if}}

`;

// Template customization function to replace placeholders with actual values
const customizeSimpleQAPromptText = (template: string, input: SimpleQAPromptInput): string => {
  let promptText = template;
  
  // Step 1: Replace all triple-brace placeholders first
  const replacements: Record<string, string> = {
    '{{{interviewerPersona}}}': input.interviewerPersona || 'standard',
    '{{{interviewType}}}': input.interviewType,
    '{{{interviewStyle}}}': input.interviewStyle,
    '{{{faangLevel}}}': input.faangLevel || 'Not specified',
    '{{{targetCompany}}}': input.targetCompany || 'Not specified',
    '{{{interviewFocus}}}': input.interviewFocus || 'None specified',
    '{{{jobTitle}}}': input.jobTitle || 'Not specified',
    '{{{jobDescription}}}': input.jobDescription || '',
    '{{{resume}}}': input.resume || '',
  };
  
  // Apply simple replacements
  for (const [placeholder, value] of Object.entries(replacements)) {
    promptText = promptText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  
  // Step 2: Handle conditional blocks with a function-based approach
  
  // Handle job title conditional
  promptText = promptText.replace(/{{#if jobTitle}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, 
    input.jobTitle ? '$1' : '$2'
  );
  
  // Handle job description conditional and section
  if (input.jobDescription) {
    promptText = promptText.replace(/{{#if jobDescription}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, '$1');
    // Replace the job description section
    promptText = promptText.replace(
      /{{#if jobDescription}}\s*---\s*Job Description Details[\s\S]*?---\s*{{\/if}}/g,
      `---\nJob Description Details (if tailoring):\n${input.jobDescription}\n---`
    );
  } else {
    promptText = promptText.replace(/{{#if jobDescription}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, '$2');
    promptText = promptText.replace(/{{#if jobDescription}}[\s\S]*?{{\/if}}/g, '');
  }
  
  // Handle resume conditional and section
  if (input.resume) {
    promptText = promptText.replace(/{{#if resume}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, '$1');
    // Replace the resume section
    promptText = promptText.replace(
      /{{#if resume}}\s*---\s*Resume Details[\s\S]*?---\s*{{\/if}}/g,
      `---\nResume Details (if used for context):\n${input.resume}\n---`
    );
  } else {
    promptText = promptText.replace(/{{#if resume}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, '$2');
    promptText = promptText.replace(/{{#if resume}}[\s\S]*?{{\/if}}/g, '');
  }
  
  // Handle other simple conditionals
  promptText = promptText.replace(/{{#if faangLevel}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, 
    input.faangLevel ? '$1' : '$2'
  );
  promptText = promptText.replace(/{{#if targetCompany}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, 
    input.targetCompany ? '$1' : '$2'
  );
  promptText = promptText.replace(/{{#if interviewerPersona}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, 
    input.interviewerPersona ? '$1' : '$2'
  );
  promptText = promptText.replace(/{{#if interviewFocus}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, 
    input.interviewFocus ? '$1' : '$2'
  );
  
  // Handle targeted skills array
  if (input.targetedSkills && input.targetedSkills.length > 0) {
    const skillsList = input.targetedSkills.map(skill => `- ${skill}`).join('\n');
    // Look for the targeted skills section and replace it
    promptText = promptText.replace(
      /{{#if targetedSkills\.length}}[\s\S]*?{{#each targetedSkills}}[\s\S]*?- {{{this}}}[\s\S]*?{{\/each}}[\s\S]*?{{else}}([\s\S]*?){{\/if}}/g,
      skillsList
    );
  } else {
    promptText = promptText.replace(
      /{{#if targetedSkills\.length}}[\s\S]*?{{#each targetedSkills}}[\s\S]*?{{\/each}}[\s\S]*?{{else}}([\s\S]*?){{\/if}}/g,
      '$1'
    );
  }
  
  // Step 3: Handle the complex interview type conditionals
  // Extract the style-specific section
  const styleMatch = promptText.match(/\*\*Style-Specific Question Generation Logic[\s\S]*?\*\*:([\s\S]*)/);
  if (styleMatch) {
    let styleSection = styleMatch[1];
    let selectedContent = '';
    
    if (input.isBehavioral) {
      // Extract behavioral section
      const behavioralMatch = styleSection.match(/{{#if isBehavioral}}([\s\S]*?)(?={{else if|{{\/if}})/);
      if (behavioralMatch) {
        selectedContent = behavioralMatch[1];
        
        // Handle nested Amazon condition
        if (input.isAmazonTarget) {
          const amazonMatch = selectedContent.match(/{{#if isAmazonTarget}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/);
          if (amazonMatch) {
            selectedContent = selectedContent.replace(/{{#if isAmazonTarget}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/, amazonMatch[1]);
            // Replace Amazon LPs placeholder
            const lpList = AMAZON_LEADERSHIP_PRINCIPLES.map(lp => `- ${lp}`).join('\n');
            selectedContent = selectedContent.replace(/{{{AMAZON_LPS_LIST}}}/g, lpList);
          }
        } else {
          const amazonMatch = selectedContent.match(/{{#if isAmazonTarget}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/);
          if (amazonMatch) {
            selectedContent = selectedContent.replace(/{{#if isAmazonTarget}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/, amazonMatch[2]);
          }
        }
      }
    } else if (input.isProductSense) {
      const productMatch = styleSection.match(/{{else if isProductSense}}([\s\S]*?)(?={{else if|{{else}})/);
      if (productMatch) {
        selectedContent = productMatch[1];
      }
    } else if (input.isTechnicalSystemDesign) {
      const techMatch = styleSection.match(/{{else if isTechnicalSystemDesign}}([\s\S]*?)(?={{else if|{{else}})/);
      if (techMatch) {
        selectedContent = techMatch[1];
      }
    } else if (input.isMachineLearning) {
      const mlMatch = styleSection.match(/{{else if isMachineLearning}}([\s\S]*?)(?={{else if|{{else}})/);
      if (mlMatch) {
        selectedContent = mlMatch[1];
      }
    } else if (input.isDSA) {
      const dsaMatch = styleSection.match(/{{else if isDSA}}([\s\S]*?)(?={{else if|{{else}})/);
      if (dsaMatch) {
        selectedContent = dsaMatch[1];
      }
    } else if (input.isGeneralInterviewType) {
      const generalMatch = styleSection.match(/{{else if isGeneralInterviewType}}([\s\S]*?)(?={{else}})/);
      if (generalMatch) {
        selectedContent = generalMatch[1];
      }
    } else {
      // Extract fallback content
      const fallbackMatch = styleSection.match(/{{else}}([\s\S]*?){{\/if}}/);
      if (fallbackMatch) {
        selectedContent = fallbackMatch[1];
      }
    }
    
    // Replace the entire style section with the selected content
    promptText = promptText.substring(0, promptText.indexOf('**Style-Specific Question Generation Logic')) + 
                 '**Style-Specific Question Generation Logic (for \'simple-qa\' ONLY):**\n\n' + 
                 selectedContent.trim();
  }
  
  // Step 4: Final cleanup - remove any remaining template syntax
  promptText = promptText.replace(/{{#if[\s\S]*?{{\/if}}/g, '');
  promptText = promptText.replace(/{{else if[\s\S]*?}}/g, '');
  promptText = promptText.replace(/{{else}}/g, '');
  promptText = promptText.replace(/{{\/if}}/g, '');
  promptText = promptText.replace(/{{#each[\s\S]*?{{\/each}}/g, '');
  
  // Remove any triple braces that might have been missed
  promptText = promptText.replace(/{{{[^}]+}}}/g, (match) => {
    console.warn(`[DEBUG] Unresolved placeholder found: ${match}`);
    return '[UNRESOLVED]';
  });
  
  return promptText;
};

const customizeSimpleQAInterviewQuestionsPrompt = globalAI.definePrompt({
  name: 'customizeSimpleQAInterviewQuestionsPrompt',
  tools: [globalGetTechnologyBriefTool, globalFindRelevantAssessmentsTool],
  input: {
    schema: SimpleQAPromptInputSchema,
  },
  output: { // The AI model will return an object with a single key "jsonString"
    schema: AIServiceOutputSchemaSimpleQA
  },
  prompt: SIMPLE_QA_PROMPT_TEMPLATE_STRING, // Use the constant here
});

async function customizeSimpleQAInterviewQuestionsFlow(
  baseInput: CustomizeInterviewQuestionsInput,
  aiInstance: GenkitInstanceType,
  toolsToUse: any[]
): Promise<z.infer<typeof SimpleQAQuestionsOutputSchema>> {
    if (baseInput.interviewStyle !== 'simple-qa') {
        console.warn(`[BYOK] customizeSimpleQAInterviewQuestionsFlow called with incorrect style: ${baseInput.interviewStyle}. This indicates an orchestrator logic issue.`);
        return { customizedQuestions: [{ questionText: `Error: This flow is for 'simple-qa' only. Received '${baseInput.interviewStyle}'.`, idealAnswerCharacteristics: [] }] };
    }

    const promptInput: SimpleQAPromptInput = {
        ...baseInput,
        interviewType: baseInput.interviewType,
        interviewStyle: baseInput.interviewStyle,
        faangLevel: baseInput.faangLevel,
        interviewerPersona: baseInput.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
        isBehavioral: baseInput.interviewType === 'behavioral',
        isProductSense: baseInput.interviewType === 'product sense',
        isTechnicalSystemDesign: baseInput.interviewType === 'technical system design',
        isMachineLearning: baseInput.interviewType === 'machine learning',
        isDSA: baseInput.interviewType === 'data structures & algorithms',
        isAmazonTarget: baseInput.targetCompany?.toLowerCase() === 'amazon',
        isGeneralInterviewType: !['behavioral', 'product sense', 'technical system design', 'machine learning', 'data structures & algorithms'].includes(baseInput.interviewType),
    };

    // Use the template customization function to replace all placeholders
    const customizedPrompt = customizeSimpleQAPromptText(SIMPLE_QA_PROMPT_TEMPLATE_STRING, promptInput);
    
    // Debug: Check if placeholders were replaced
    const hasUnreplacedPlaceholders = customizedPrompt.includes('{{{') || customizedPrompt.includes('{{#if');
    if (hasUnreplacedPlaceholders) {
        console.error('[DEBUG] WARNING: Customized prompt still contains unreplaced placeholders!');
        // Find and log any remaining placeholders
        const remainingPlaceholders = customizedPrompt.match(/{{{[^}]+}}}|{{#[^}]+}}|{{\/[^}]+}}/g);
        if (remainingPlaceholders) {
            console.error('[DEBUG] Remaining placeholders:', remainingPlaceholders.slice(0, 5));
        }
        console.log('[DEBUG] Sample of prompt:', customizedPrompt.substring(0, 500));
    } else {
        console.log('[DEBUG] Template interpolation successful. All placeholders replaced.');
        // Log the interview type specific section that was selected
        const styleSection = customizedPrompt.match(/\*\*Style-Specific Question Generation Logic[\s\S]*?\*\*:\n\n([\s\S]{0,200})/);
        if (styleSection) {
            console.log('[DEBUG] Selected style section preview:', styleSection[1].replace(/\n/g, ' ').substring(0, 150) + '...');
        }
    }

    const generateOptions = {
        model: googleAI.model('gemini-1.5-flash-latest') as ModelReference<any>,
        prompt: customizedPrompt,
        context: promptInput,
        tools: toolsToUse,
        output: { schema: SimpleQAQuestionsOutputSchema },
        config: { responseMimeType: "application/json" },
    };

    let rawJsonString: string | undefined;
    try {
        console.log(`[BYOK] customizeSimpleQAInterviewQuestionsFlow: Attempting to generate with AI instance and input: ${JSON.stringify(promptInput, null, 2)}`);
        
        const resultFromGenerate = await aiInstance.generate<typeof SimpleQAQuestionsOutputSchema>(generateOptions);

        const aiServiceOutput = resultFromGenerate.output;

        if (aiServiceOutput && typeof aiServiceOutput === 'object' && 'customizedQuestions' in aiServiceOutput) {
            rawJsonString = JSON.stringify(aiServiceOutput);
        } else {
            console.warn(`[BYOK] customizeSimpleQAInterviewQuestionsFlow: AI output was not the expected direct object structure...`);
            throw new Error("AI response was not in the expected direct object format.");
        }

        if (typeof rawJsonString !== 'string') {
            throw new Error("AI did not return a processable JSON string.");
        }
        const parsedJson = JSON.parse(rawJsonString);
        const validatedOutput = SimpleQAQuestionsOutputSchema.parse(parsedJson);

        if (!validatedOutput.customizedQuestions || validatedOutput.customizedQuestions.length === 0) {
            throw new Error("The AI returned data that doesn't match the expected question format after parsing.");
        }
        return { customizedQuestions: validatedOutput.customizedQuestions.map((q:any) => ({...q})) };

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[BYOK] customizeSimpleQAInterviewQuestionsFlow: AI call or parsing FAILED: ${errorMsg}`);
        if (e instanceof z.ZodError) {
            console.error("Zod validation error in customizeSimpleQAInterviewQuestionsFlow:", e.errors);
        }
        // Provide more specific fallback questions based on interview type
        const fallbackQuestions = getFallbackQuestions(baseInput.interviewType, baseInput.faangLevel);
        return { customizedQuestions: fallbackQuestions };
    }
}

// Helper function to provide better fallback questions
function getFallbackQuestions(interviewType: string, faangLevel?: string): any[] {
    const level = faangLevel || 'L4';
    
    switch (interviewType) {
        case 'behavioral':
            return [
                {
                    questionText: "Tell me about a time when you had to work with a difficult team member. How did you handle the situation?",
                    idealAnswerCharacteristics: [
                        "Clear use of STAR method",
                        "Demonstrates empathy and professionalism",
                        "Shows conflict resolution skills",
                        "Describes positive outcome or learning"
                    ]
                },
                {
                    questionText: "Describe a situation where you failed to meet a deadline. What happened and what did you learn?",
                    idealAnswerCharacteristics: [
                        "Takes ownership of the failure",
                        "Explains root cause analysis",
                        "Shows lessons learned",
                        "Demonstrates process improvements made"
                    ]
                }
            ];
        case 'technical system design':
            return [
                {
                    questionText: "Design a distributed cache system that can handle millions of requests per second.",
                    idealAnswerCharacteristics: [
                        "Clarifies requirements and constraints",
                        "Proposes high-level architecture",
                        "Discusses consistency models",
                        "Addresses scalability and fault tolerance"
                    ]
                }
            ];
        case 'product sense':
            return [
                {
                    questionText: "How would you improve the onboarding experience for a B2B SaaS product?",
                    idealAnswerCharacteristics: [
                        "Identifies user personas and pain points",
                        "Proposes data-driven solutions",
                        "Defines success metrics",
                        "Considers implementation trade-offs"
                    ]
                }
            ];
        default:
            return [
                {
                    questionText: `Given your background, what unique value would you bring to a ${level} role?`,
                    idealAnswerCharacteristics: [
                        "Highlights relevant experience",
                        "Shows understanding of role expectations",
                        "Demonstrates growth potential",
                        "Provides specific examples"
                    ]
                }
            ];
    }
}

// Export the main orchestrator type for potential external use if needed, though it's primarily for internal routing now.
export type { CustomizeInterviewQuestionsInput as CustomizeInterviewQuestionsOrchestratorInput, CustomizeInterviewQuestionsOutput as CustomizeInterviewQuestionsOrchestratorOutput };
