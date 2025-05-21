
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
    .enum(['simple-qa', 'case-study', 'take-home']) // Updated from 'standard' to 'simple-qa'
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


// Schema for an individual feedback item
export const FeedbackItemSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  answerText: z.string(),
  strengths: z.array(z.string()).optional(),
  areasForImprovement: z.array(z.string()).optional(),
  specificSuggestions: z.array(z.string()).optional(),
  critique: z.string().optional(),
  idealAnswerPointers: z.array(z.string()).optional(),
  timeTakenMs: z.number().optional(),
  confidenceScore: z.number().min(1).max(5).optional(),
  reflectionPrompts: z.array(z.string()).optional(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;


// Schema for the overall output of the feedback generation process
export const GenerateInterviewFeedbackOutputSchema = z.object({
  feedbackItems: z.array(FeedbackItemSchema),
  overallSummary: z.string(),
});
export type GenerateInterviewFeedbackOutput = z.infer<typeof GenerateInterviewFeedbackOutputSchema>;
