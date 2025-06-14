import { z } from 'genkit';
import type { InterviewSetupData } from '@/lib/types';

// Extended type for interview context that includes previousConversation
// This should align with the type used in the flow itself.
// We might need to centralize this type definition if it's used in multiple places.
type InterviewContextWithConversation = InterviewSetupData & {
  previousConversation?: string;
};

// Define an interface or type for the inputs to the prompt generation function.
// This is derived from ClarifyInterviewQuestionInput from the original flow.
export const GenerateClarificationPromptInputSchema = z.object({
  interviewQuestionText: z.string().describe("The original interview question posed by the AI that the user wants clarification on."),
  userClarificationRequest: z.string().describe("The user's specific question asking for clarification about the AI's interview question."),
  interviewContext: z.custom<InterviewContextWithConversation>().describe("The overall context of the interview (type, level, focus, persona, etc.)."),
});
export type GenerateClarificationPromptInput = z.infer<typeof GenerateClarificationPromptInputSchema>;


export const CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE = `You are an AI Interviewer currently embodying the persona of: '{{{interviewContext.interviewerPersona}}}'.
Your current interview type is '{{{interviewContext.interviewType}}}' at '{{{interviewContext.faangLevel}}}' level.
{{#if interviewContext.interviewFocus}}The specific focus is '{{{interviewContext.interviewFocus}}}'.{{/if}}

{{#if interviewContext.previousConversation}}
Briefly review the conversation history if the candidate's request seems to reference earlier parts of the dialogue:
Previous Conversation Snippets:
{{{interviewContext.previousConversation}}}
---
{{/if}}

The interview question you (as the AI Interviewer) asked was:
"{{{interviewQuestionText}}}"

The candidate is asking for clarification on THIS question. Their clarification request is:
"{{{userClarificationRequest}}}"

Your Task:
Provide a helpful and concise clarification.
- Directly address the candidate's specific point of confusion from their 'userClarificationRequest'.
- If the candidate is asking for factual context about the hypothetical scenario that was not previously provided (e.g., "What are the company's OKRs?", "What's the team size?"), and this information is not something they are expected to invent or assume, you MAY provide a brief, reasonable piece of information. Invent plausible details if necessary. Example: If asked for OKRs, you could say, "Assume a key OKR is to increase user engagement by 15% this quarter." State that you are providing this as assumed context.
- Maintain your '{{{interviewContext.interviewerPersona}}}' persona in your response. For example:
    - A 'friendly_peer' might say: "Good question! What I mean by that is..." or "Good clarifying question! For context, let's assume the company's main OKR is to grow active users by 20% this quarter."
    - A 'skeptical_hiring_manager' might say: "The question is straightforward. However, to clarify, consider..." or "While you should be comfortable making reasonable assumptions, for this discussion, assume the primary OKR is X."
    - A 'time_pressed_technical_lead' might give a very direct clarification.
    - An 'antagonistic_challenger' might rephrase slightly but still maintain a challenging tone, e.g., "If you're asking whether X is in scope, I expect you to make a reasonable assumption and state it. But to be clear, consider Y."
    - An 'apathetic_business_lead' might give a minimal clarification, e.g., "Focus on the core business problem."
- Do NOT give away the answer to the original 'interviewQuestionText'.
- Do NOT solve the problem for them.
- Your clarification should help them understand the question better so they can proceed.
- Aim for 1-3 sentences.

Begin your clarification directly.
`;

// Renamed and adapted from customizeClarifyPromptText
export function generateClarificationPromptString(input: GenerateClarificationPromptInput): string {
  let promptText = CLARIFY_INTERVIEW_QUESTION_PROMPT_TEMPLATE;

  // Replace basic placeholders
  promptText = promptText.replace(/{{{interviewContext\.interviewerPersona}}}/g, input.interviewContext.interviewerPersona || 'standard');
  promptText = promptText.replace(/{{{interviewContext\.interviewType}}}/g, input.interviewContext.interviewType);
  promptText = promptText.replace(/{{{interviewContext\.faangLevel}}}/g, input.interviewContext.faangLevel);
  promptText = promptText.replace(/{{{interviewQuestionText}}}/g, input.interviewQuestionText);
  promptText = promptText.replace(/{{{userClarificationRequest}}}/g, input.userClarificationRequest);

  // Handle optional fields with conditional blocks
  if (input.interviewContext.interviewFocus) {
    promptText = promptText.replace(
      /{{#if interviewContext\.interviewFocus}}The specific focus is '{{{interviewContext\.interviewFocus}}}'.{{\/if}}/g,
      `The specific focus is '${input.interviewContext.interviewFocus}'.`
    );
  } else {
    promptText = promptText.replace(
      /{{#if interviewContext\.interviewFocus}}The specific focus is '{{{interviewContext\.interviewFocus}}}'.{{\/if}}/g,
      ''
    );
  }

  // Regex for the previousConversation block
  const previousConversationBlockRegex = new RegExp(
    '{{#if interviewContext\\.previousConversation}}Briefly review the conversation history if the candidate\'s request seems to reference earlier parts of the dialogue:\\nPrevious Conversation Snippets:\\n{{{interviewContext\\.previousConversation}}}\\n---{{\\/if}}\\n*' // Added * to match optional trailing newline
  );
  const previousConversationBlockRegexFallback = new RegExp(
    '{{#if interviewContext\\.previousConversation}}Briefly review the conversation history if the candidate\'s request seems to reference earlier parts of the dialogue:\\nPrevious Conversation Snippets:\\n{{{interviewContext\\.previousConversation}}}\\n---{{\\/if}}'
  );

  if (input.interviewContext.previousConversation) {
    const replacementText = `Briefly review the conversation history if the candidate's request seems to reference earlier parts of the dialogue:\nPrevious Conversation Snippets:\n${input.interviewContext.previousConversation}\n---`;
    if (previousConversationBlockRegex.test(promptText)) {
        promptText = promptText.replace(previousConversationBlockRegex, replacementText);
    } else {
        promptText = promptText.replace(previousConversationBlockRegexFallback, replacementText);
    }
  } else {
    // Remove the entire block including the "Briefly review..." part if no previous conversation
    if (previousConversationBlockRegex.test(promptText)) {
        promptText = promptText.replace(previousConversationBlockRegex, '');
    } else {
        promptText = promptText.replace(previousConversationBlockRegexFallback, '');
    }
  }
  return promptText;
} 