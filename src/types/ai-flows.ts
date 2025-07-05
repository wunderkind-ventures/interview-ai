/**
 * Type definitions for AI flows and Genkit integrations
 */

import type { z } from 'zod';
import type { InterviewType, InterviewStyle, FaangLevel } from '@/lib/types';

// Base types for all AI flows
export interface BaseFlowInput {
  userId?: string;
  sessionId?: string;
  timestamp?: number;
}

export interface BaseFlowOutput {
  success: boolean;
  error?: string;
  processingTime?: number;
}

// Question generation types
export interface InterviewQuestion {
  id: string;
  text: string;
  idealAnswerCharacteristics: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  estimatedTime?: number;

  // Case study specific
  isInitialCaseQuestion?: boolean;
  fullScenarioDescription?: string;
  internalNotesForFollowUpGenerator?: string;
  isLikelyFinalFollowUp?: boolean;
}

export interface CustomizeQuestionsInput extends BaseFlowInput {
  interviewType: InterviewType;
  interviewStyle: InterviewStyle;
  faangLevel: FaangLevel;

  // Optional context
  jobTitle?: string;
  jobDescription?: string;
  resume?: string;
  targetedSkills?: string[];
  targetCompany?: string;
  interviewFocus?: string;
  interviewerPersona?: string;

  // For follow-up questions
  previousConversation?: string;
  currentQuestion?: string;
  caseStudyNotes?: string;
}

export interface CustomizeQuestionsOutput extends BaseFlowOutput {
  customizedQuestions: InterviewQuestion[];
  totalQuestions: number;
  estimatedDuration: number;
}

// Feedback generation types
export interface FeedbackSection {
  title: string;
  content: string;
  score?: number;
  highlights?: string[];
  improvements?: string[];
}

export interface GenerateFeedbackInput extends BaseFlowInput {
  interviewType: InterviewType;
  faangLevel: FaangLevel;
  questions: InterviewQuestion[];
  answers: string[];
  timeTaken?: number[];

  // Optional context
  jobTitle?: string;
  targetCompany?: string;
  resume?: string;

  // Evaluation criteria
  evaluationCriteria?: string[];
  weightings?: Record<string, number>;
}

export interface GenerateFeedbackOutput extends BaseFlowOutput {
  overallScore: number;
  overallFeedback: string;
  sections: FeedbackSection[];
  strengths: string[];
  areasForImprovement: string[];
  nextSteps?: string[];
  detailedScores?: Record<string, number>;
}

// Hint generation types
export interface GenerateHintInput extends BaseFlowInput {
  questionText: string;
  questionContext?: string;
  attemptedAnswer?: string;
  hintLevel?: 1 | 2 | 3; // Progressive hints
  interviewType?: InterviewType;
}

export interface GenerateHintOutput extends BaseFlowOutput {
  hint: string;
  hintLevel: number;
  remainingHints: number;
  shouldRevealAnswer: boolean;
}

// Sample answer generation
export interface GenerateSampleAnswerInput extends BaseFlowInput {
  questionText: string;
  interviewType: InterviewType;
  faangLevel: FaangLevel;
  targetCompany?: string;
  includeStructure?: boolean;
}

export interface GenerateSampleAnswerOutput extends BaseFlowOutput {
  sampleAnswer: string;
  answerStructure?: string[];
  keyPoints: string[];
  commonMistakes?: string[];
}

// Clarification types
export interface ClarifyQuestionInput extends BaseFlowInput {
  interviewQuestionText: string;
  userClarificationRequest: string;
  interviewContext?: {
    interviewType: InterviewType;
    currentPhase?: string;
    previousQuestions?: string[];
  };
}

export interface ClarifyQuestionOutput extends BaseFlowOutput {
  clarificationResponse: string;
  additionalContext?: string;
  suggestedFollowUp?: string;
}

// Resume analysis types
export interface AnalyzeResumeInput extends BaseFlowInput {
  resumeText: string;
  targetRole?: string;
  targetCompany?: string;
  focusAreas?: string[];
}

export interface AnalyzeResumeOutput extends BaseFlowOutput {
  summary: string;
  keySkills: string[];
  experience: {
    years: number;
    roles: string[];
    companies: string[];
  };
  strengths: string[];
  gaps?: string[];
  suggestions?: string[];
  matchScore?: number;
}

// Deep dive types
export interface GenerateDeepDiveInput extends BaseFlowInput {
  originalQuestion: string;
  userAnswer: string;
  deepDiveArea: string;
  currentDepth: number;
  maxDepth?: number;
}

export interface GenerateDeepDiveOutput extends BaseFlowOutput {
  followUpQuestion: string;
  rationale: string;
  shouldContinueDeepDive: boolean;
  insights?: string[];
}

// Case study types
export interface CaseStudyTurn {
  speaker: 'interviewer' | 'candidate';
  message: string;
  timestamp: number;
}

export interface GenerateCaseFollowUpInput extends BaseFlowInput {
  conversationHistory: CaseStudyTurn[];
  caseContext: string;
  currentPhase: string;
  candidateApproach?: string;
}

export interface GenerateCaseFollowUpOutput extends BaseFlowOutput {
  followUpQuestion: string;
  phaseTransition?: {
    from: string;
    to: string;
    reason: string;
  };
  hints?: string[];
  evaluation?: {
    structure: number;
    analysis: number;
    creativity: number;
  };
}

// Explain concept types
export interface ExplainConceptInput extends BaseFlowInput {
  concept: string;
  context?: string;
  complexity?: 'simple' | 'detailed' | 'technical';
  relatedTo?: string;
}

export interface ExplainConceptOutput extends BaseFlowOutput {
  explanation: string;
  examples?: string[];
  relatedConcepts?: string[];
  resources?: Array<{
    title: string;
    url: string;
    type: 'article' | 'video' | 'documentation';
  }>;
}

// Content scraping types
export interface ScrapeContentInput extends BaseFlowInput {
  url: string;
  contentType?: 'youtube' | 'blog' | 'documentation';
  extractSections?: string[];
}

export interface ScrapeContentOutput extends BaseFlowOutput {
  title: string;
  content: string;
  metadata?: {
    author?: string;
    publishDate?: string;
    duration?: number;
    tags?: string[];
  };
  sections?: Record<string, string>;
}

// Prompt template types
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  version: string;
  lastUpdated: string;
}

export interface PromptInput {
  [key: string]: string | number | boolean | string[] | undefined;
}

// Model configuration
export interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  responseMimeType?: 'text/plain' | 'application/json';
}

// Flow execution options
export interface FlowExecutionOptions {
  apiKey?: string;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  telemetry?: boolean;
}

// Error types for AI flows
export class AIFlowError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIFlowError';
  }
}

export enum AIFlowErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  MODEL_ERROR = 'MODEL_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  PARSING_ERROR = 'PARSING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Zod schema helpers
export type InferFlowInput<T> = T extends z.ZodType<infer U> ? U : never;
export type InferFlowOutput<T> = T extends z.ZodType<infer U> ? U : never;
