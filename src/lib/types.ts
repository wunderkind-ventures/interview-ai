
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
  timeTakenMs?: number; // Added to store time taken for the answer
}

export interface FeedbackItem {
  questionId: string;
  questionText: string;
  answerText: string;
  feedbackText: string;
  timeTakenMs?: number; // Added to display time taken alongside feedback
}

export interface InterviewFeedback {
  feedbackItems: FeedbackItem[];
  overallSummary: string;
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[];
  answers: Answer[];
  currentQuestionIndex: number;
  currentQuestionStartTime?: number; // Added to track start time of current question
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null;
}
