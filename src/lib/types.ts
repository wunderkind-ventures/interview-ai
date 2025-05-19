
import type { InterviewType, FaangLevel, InterviewStyle } from './constants';

export interface InterviewSetupData {
  interviewType: InterviewType;
  interviewStyle: InterviewStyle;
  faangLevel: FaangLevel;
  jobTitle?: string; // Added jobTitle
  jobDescription?: string;
  resume?: string;
  targetedSkills?: string[];
  targetCompany?: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
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
  feedbackText: string;
  timeTakenMs?: number;
}

export interface InterviewFeedback {
  feedbackItems: FeedbackItem[];
  overallSummary: string;
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[];
  answers: Answer[];
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null;
  // jobTitle, targetedSkills, and targetCompany are inherited from InterviewSetupData
}
