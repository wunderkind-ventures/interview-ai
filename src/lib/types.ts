import type { InterviewType, FaangLevel } from './constants';

export interface InterviewSetupData {
  interviewType: InterviewType;
  faangLevel: FaangLevel;
  jobDescription?: string;
  resume?: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[];
  answers: { questionId: string, answerText: string }[];
  currentQuestionIndex: number;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
}
