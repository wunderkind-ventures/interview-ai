
import type { InterviewType, FaangLevel, InterviewStyle } from './constants';

export interface InterviewSetupData {
  interviewType: InterviewType;
  interviewStyle: InterviewStyle;
  faangLevel: FaangLevel;
  jobDescription?: string;
  resume?: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
}

export interface Answer {
  questionId: string;
  answerText: string;
}

export interface FeedbackItem {
  questionId: string;
  questionText: string;
  answerText: string;
  feedbackText: string;
}

export interface InterviewFeedback {
  feedbackItems: FeedbackItem[];
  overallSummary: string;
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[];
  answers: Answer[];
  currentQuestionIndex: number;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null; // Added to store generated feedback
}
