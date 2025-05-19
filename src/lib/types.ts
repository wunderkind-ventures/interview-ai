
import type { InterviewType, FaangLevel, InterviewStyle } from './constants';

export interface InterviewSetupData {
  interviewType: InterviewType;
  interviewStyle: InterviewStyle;
  faangLevel: FaangLevel;
  jobTitle?: string;
  jobDescription?: string;
  resume?: string;
  targetedSkills?: string[];
  targetCompany?: string;
  interviewFocus?: string;
}

export interface ThemedInterviewPackConfig extends Partial<Omit<InterviewSetupData, 'resume' | 'targetedSkills'>> {
  targetedSkills?: string[];
}

export interface ThemedInterviewPack {
  id: string;
  label: string;
  description: string;
  config: ThemedInterviewPackConfig;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  idealAnswerCharacteristics?: string[]; // Added
}

export interface Answer {
  questionId: string;
  answerText: string;
  timeTakenMs?: number;
}

export interface FeedbackItem {
  questionId: string;
  questionText: string;
  answerText: string;
  strengths?: string[];
  areasForImprovement?: string[];
  specificSuggestions?: string[];
  critique?: string;
  idealAnswerPointers?: string[];
  timeTakenMs?: number;
}

export interface InterviewFeedback {
  feedbackItems: FeedbackItem[];
  overallSummary: string;
}

export interface DeepDiveFeedback {
  detailedIdealAnswerBreakdown: string[];
  alternativeApproaches: string[];
  followUpScenarios: string[];
  suggestedStudyConcepts: string[];
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[]; // Will now store characteristics
  answers: Answer[];
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null;
  deepDives?: Record<string, DeepDiveFeedback>;
}
