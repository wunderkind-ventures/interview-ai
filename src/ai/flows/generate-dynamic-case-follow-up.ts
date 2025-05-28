
'use server';
/**
 * @fileOverview Generates a dynamic follow-up question for a case study interview.
 * This flow takes the initial case context, the conversation history, and the last user answer
 * to generate a relevant and probing next question.
 *
 * - generateDynamicCaseFollowUp - Function to generate the next follow-up question.
 * - GenerateDynamicCaseFollowUpInput - Input type for this flow.
 * - GenerateDynamicCaseFollowUpOutput - Output type for this flow.
 */

import {ai as globalAI} from '@/ai/genkit'; // Use globalAI for defining prompt
import {z} from 'genkit';
import type { InterviewSetupData } from '@/lib/types'; // For interviewContext
import { AMAZON_LEADERSHIP_PRINCIPLES, INTERVIEWER_PERSONAS } from '@/lib/constants';

const GenerateDynamicCaseFollowUpInputSchema = z.object({
  internalNotesFromInitialScenario: z
    .string()
    .describe('Concise internal notes, keywords, or key aspects from the initial case setup. This helps the AI stay on topic.'),
  previousQuestionText: z
    .string()
    .describe("The text of the question the user just answered."),
  previousUserAnswerText: z
    .string()
    .describe("The user's answer to the previous question."),
  conversationHistory: z
    .array(z.object({ questionText: z.string(), answerText: z.string() }))
    .describe("The history of questions and answers in this case study so far, to provide context and avoid repetition."),
  interviewContext: z.custom<InterviewSetupData>() 
    .describe("The overall context of the interview (type, level, focus, job title, etc.)."),
  currentTurnNumber: z
    .number()
    .min(1)
    .describe("The current turn number for follow-up questions (e.g., 1 for the first follow-up, 2 for the second, etc.). Helps in pacing the case."),
  // No userApiKey here; it's handled by the passed aiInstance
});
export type GenerateDynamicCaseFollowUpInput = z.infer<typeof GenerateDynamicCaseFollowUpInputSchema>;

const GenerateDynamicCaseFollowUpOutputSchema = z.object({
  followUpQuestionText: z
    .string()
    .describe('The dynamically generated follow-up question.'),
  idealAnswerCharacteristicsForFollowUp: z
    .array(z.string())
    .optional()
    .describe("Brief key characteristics a strong answer to this *new specific follow-up question* would demonstrate."),
  isLikelyFinalFollowUp: z
    .boolean()
    .describe("The AI's assessment of whether this follow-up is likely a good point to conclude the case study (e.g., after 3-5 total follow-ups, or if a natural conclusion is reached)."),
});
export type GenerateDynamicCaseFollowUpOutput = z.infer<typeof GenerateDynamicCaseFollowUpOutputSchema>;

export async function generateDynamicCaseFollowUp(
  input: GenerateDynamicCaseFollowUpInput,
  aiInstance: any // Expect an AI instance
): Promise<GenerateDynamicCaseFollowUpOutput> {
  return generateDynamicCaseFollowUpFlow(input, aiInstance);
}

const MAX_CASE_FOLLOW_UPS = 4; // Generate up to 4 follow-ups after the initial question.

const dynamicCaseFollowUpPrompt = globalAI.definePrompt({ // Use globalAI here for definition
  name: 'generateDynamicCaseFollowUpPrompt',
  input: { schema: GenerateDynamicCaseFollowUpInputSchema },
  output: { schema: GenerateDynamicCaseFollowUpOutputSchema },
  prompt: `You are an **Expert Interviewer AI**, skilled at conducting dynamic, multi-turn case study interviews.
Your current task is to generate the **next single follow-up question** based on the ongoing case study.
Your adopted interviewer persona for this interaction is: '{{{interviewContext.interviewerPersona}}}'. Adapt your question style and probing depth accordingly:
- 'standard': Balanced and typical follow-up.
- 'friendly_peer': Collaborative tone, might ask "What if we considered X?" or "How would you think about Y together?".
- 'skeptical_hiring_manager': Follow-up might directly challenge an assumption made, or ask for stronger justification of a point.
- 'time_pressed_technical_lead': Follow-up will be very direct, focusing on core logic or a key trade-off.
- 'behavioral_specialist': If the case has behavioral elements, probe deeper into decision-making rationale or interpersonal dynamics.
- 'antagonistic_challenger': Vigorously probe the candidate's last response, question their assumptions, or introduce a difficult constraint to test their thinking under pressure.
- 'apathetic_business_lead': Ask a somewhat general follow-up that requires the candidate to re-engage you and demonstrate the value of their continued thought process.

**Overall Case Context (from initial setup):**
{{internalNotesFromInitialScenario}}

**Interview Setup:**
- Interview Type: {{interviewContext.interviewType}}
- FAANG Level: {{interviewContext.faangLevel}}
{{#if interviewContext.jobTitle}}- Job Title: {{interviewContext.jobTitle}}{{/if}}
{{#if interviewContext.interviewFocus}}- Specific Focus: {{interviewContext.interviewFocus}}{{/if}}
{{#if interviewContext.targetCompany}}- Target Company: {{interviewContext.targetCompany}}{{/if}}

**Conversation History (Most Recent First):**
{{#each conversationHistory}}
  Interviewer: "{{this.questionText}}"
  Candidate: "{{this.answerText}}"
{{/each}}
---
Last Question Asked to Candidate: "{{previousQuestionText}}"
Candidate's Last Answer: "{{previousUserAnswerText}}"
---

**Your Task (Turn {{currentTurnNumber}} of follow-ups):**
1.  **Analyze Context:** Review the 'Overall Case Context', the 'Interview Setup', the full 'Conversation History', and especially the 'Candidate's Last Answer'.
2.  **Generate ONE Follow-up Question:**
    *   The question should be a natural continuation of the discussion, probing deeper into an aspect of the candidate's last answer or introducing a new, relevant dimension/constraint to the case.
    *   It must be relevant to the 'Overall Case Context' and the 'Interview Setup' (especially 'faangLevel' and 'interviewFocus').
    *   Avoid simple yes/no questions. Aim for questions that require critical thinking, trade-off analysis, or further problem decomposition.
    *   Do not repeat questions already asked.
3.  **Define Ideal Answer Characteristics:** For your generated follow-up question, list 2-3 brief key characteristics of a strong answer.
4.  **Assess if Final Follow-up:**
    *   Based on the 'currentTurnNumber' (you are generating the question for this turn) and the depth of the conversation, decide if this is likely a good point to conclude the case.
    *   Typically, a case study might have 3-5 follow-up questions in total after the initial question. Set 'isLikelyFinalFollowUp' to true if 'currentTurnNumber' is >= ${MAX_CASE_FOLLOW_UPS} OR if the candidate's last answer suggests a natural resolution or comprehensive coverage of the main problem. Otherwise, set it to false.

**Example Areas to Probe (depending on case type and prior answers):**
- Clarification of assumptions made by the candidate.
- Trade-offs they considered or should consider.
- How they would measure success or validate their approach.
- Potential risks and mitigation strategies.
- Scalability, edge cases, error handling.
- Stakeholder considerations.
- Prioritization if multiple options were presented.

{{#if interviewContext.targetCompany}}
If the interviewContext.targetCompany field has a value like "Amazon" (perform a case-insensitive check in your reasoning and apply the following if true):
**Amazon-Specific Considerations:**
Frame your follow-up to provide opportunities to demonstrate Amazon's Leadership Principles.
The Amazon Leadership Principles are:
{{{AMAZON_LPS_LIST}}}
End of Amazon-specific considerations.
{{/if}}

Output a JSON object matching the GenerateDynamicCaseFollowUpOutputSchema.
`,
  customize: (promptDef, callInput: GenerateDynamicCaseFollowUpInput) => {
    let promptText = promptDef.prompt!;
    if (callInput.interviewContext?.targetCompany && callInput.interviewContext.targetCompany.toLowerCase() === 'amazon') {
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

const generateDynamicCaseFollowUpFlow = ai.defineFlow(
  {
    name: 'generateDynamicCaseFollowUpFlow',
    inputSchema: GenerateDynamicCaseFollowUpInputSchema,
    outputSchema: GenerateDynamicCaseFollowUpOutputSchema,
  },
  async (input: GenerateDynamicCaseFollowUpInput, aiInstance: any): Promise<GenerateDynamicCaseFollowUpOutput> => {
    if (input.currentTurnNumber > MAX_CASE_FOLLOW_UPS + 2) { 
        return {
            followUpQuestionText: "Thank you, that concludes this case study.",
            idealAnswerCharacteristicsForFollowUp: [],
            isLikelyFinalFollowUp: true,
        };
    }

    const saneInput = {
      ...input,
      interviewContext: {
        ...input.interviewContext,
        interviewerPersona: input.interviewContext.interviewerPersona || INTERVIEWER_PERSONAS[0].value,
      }
    };
    // Use the passed AI instance for the prompt call
    const {output} = await aiInstance.run(dynamicCaseFollowUpPrompt, saneInput);

    if (!output || !output.followUpQuestionText) {
        let fallbackText = "Could you elaborate on the potential risks of your proposed approach?";
        if (input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS) {
            fallbackText = "Thanks for walking me through your thoughts. What would be your key success metrics for this initiative?";
        }
         return {
            followUpQuestionText: fallbackText,
            idealAnswerCharacteristicsForFollowUp: ["Identification of 2-3 key risks", "Plausible mitigation strategies for each"],
            isLikelyFinalFollowUp: input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS,
        };
    }
    
    let finalOutput = { ...output };
    if (input.currentTurnNumber >= MAX_CASE_FOLLOW_UPS && !output.isLikelyFinalFollowUp) {
        finalOutput.isLikelyFinalFollowUp = true;
    }

    return finalOutput;
  }
);
