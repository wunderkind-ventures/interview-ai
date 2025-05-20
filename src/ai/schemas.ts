import { z } from 'genkit';

// Input schema for customizing interview questions (e.g., adding follow-ups)
export const CustomizeInterviewQuestionsInputSchema = z.object({
  jobTitle: z
    .string()
    .optional()
    .describe('The job title for tailoring questions.'),
  jobDescription: z
    .string()
    .optional()
    .describe('The job description for context.'),
  resume: z
    .string()
    .optional()
    .describe('The candidate\'s resume for personalized questions.'),
  interviewType: z
    .enum(['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms'])
    .describe('The type of interview.'),
  interviewStyle: z
    .enum(['standard', 'case-study', 'take-home'])
    .describe('The style of the interview.'),
  faangLevel: z
    .string()
    .describe('The target FAANG level for complexity calibration.'),
  targetCompany: z
    .string()
    .optional()
    .describe('The target company, which can influence style.'),
  targetedSkills: z
    .array(z.string())
    .optional()
    .describe('Specific skills to target.'),
  interviewFocus: z
    .string()
    .optional()
    .describe('A specific focus area or sub-topic.'),
  previousConversation: z
    .string()
    .optional()
    .describe('The transcript of the conversation so far, for context and follow-ups.'),
  currentQuestion: z
    .string()
    .optional()
    .describe('The question currently being discussed, for generating follow-ups.'),
  caseStudyNotes: z
    .string()
    .optional()
    .describe('Internal notes/summary of the case study, for generating relevant follow-up questions.'),
});

export type CustomizeInterviewQuestionsInput = z.infer<
  typeof CustomizeInterviewQuestionsInputSchema
>;