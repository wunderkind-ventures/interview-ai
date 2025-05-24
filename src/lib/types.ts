
import type { InterviewType, FaangLevel, InterviewStyle, Skill } from './constants';

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
  selectedThemeId?: string; // Added for theme persistence
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
  confidenceScore?: number; // 1-5 stars
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
  confidenceScore?: number; // To display user's confidence alongside feedback
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
  currentCaseTurnNumber?: number; // For case studies
  caseConversationHistory?: Array<{ questionText: string, answerText: string }>; // For case studies
  caseStudyNotes?: string; // For case studies
  isLoggedToServer?: boolean;
}

export interface Achievement {
  id?: string; // Firestore document ID
  userId?: string; // Associated user
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  skillsDemonstrated?: string[];
  quantifiableImpact?: string;
  dateAchieved?: string | null; // ISO string or null
  createdAt?: any; // Firestore serverTimestamp
  updatedAt?: any; // Firestore serverTimestamp
}

export interface SavedItem {
  id?: string;
  userId?: string;
  title: string;
  content: string;
  createdAt?: any; // Firestore serverTimestamp
  updatedAt?: any; // Firestore serverTimestamp
}

export interface SavedResume extends SavedItem {}
export interface SavedJobDescription extends SavedItem {}
