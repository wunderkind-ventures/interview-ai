
import type { InterviewType, FaangLevel, InterviewStyle, Skill } from './constants';
import type { Timestamp } from 'firebase/firestore';


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
  selectedThemeId?: string;
}

export interface ThemedInterviewPackConfig extends Partial<Omit<InterviewSetupData, 'resume' | 'targetedSkills' | 'selectedThemeId'>> {
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
  idealAnswerCharacteristics?: string[];
  isInitialCaseQuestion?: boolean;
  fullScenarioDescription?: string;
  internalNotesForFollowUpGenerator?: string;
  isLikelyFinalFollowUp?: boolean;
}

export interface Answer {
  questionId: string;
  answerText: string;
  timeTakenMs?: number;
  confidenceScore?: number;
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
  confidenceScore?: number;
  reflectionPrompts?: string[];
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
  questions: InterviewQuestion[];
  answers: Answer[];
  currentQuestionIndex: number;
  currentQuestionStartTime?: number;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null;
  deepDives?: Record<string, DeepDiveFeedback>;
  sampleAnswers?: Record<string, string>;
  currentCaseTurnNumber?: number;
  caseConversationHistory?: Array<{ questionText: string, answerText: string }>;
  caseStudyNotes?: string;
  isLoggedToServer?: boolean;
  firestoreDocId?: string; // To store the Firestore document ID of the logged session
  completedAt?: Timestamp; // To store the server timestamp when it's logged
}

export interface Achievement {
  id?: string;
  userId?: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  skillsDemonstrated?: string[];
  quantifiableImpact?: string;
  dateAchieved?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

export interface SavedItem {
  id?: string;
  userId?: string;
  title: string;
  content: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SavedResume extends SavedItem {}
export interface SavedJobDescription extends SavedItem {}

// Types for Resume Lab AI Flows
export interface ResumeAnalysis {
  strengths: string[];
  areasForImprovement: string[];
  clarityScore: number; // 1-5
  impactScore: number; // 1-5
  overallFeedback: string;
  actionableSuggestions: string[];
}

export interface ResumeTailoringSuggestions {
  keywordsFromJD: string[];
  missingKeywordsInResume: string[];
  relevantExperiencesToHighlight: string[];
  suggestionsForTailoring: string[];
  overallFitAssessment: string;
}
