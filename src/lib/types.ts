
import type { InterviewType, FaangLevel, InterviewStyle, Skill, InterviewerPersona } from './constants';
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
  interviewerPersona?: InterviewerPersona | string;
  caseStudyNotes?: string | null;
}

export interface ThemedInterviewPackConfig extends Partial<Omit<InterviewSetupData, 'resume' | 'targetedSkills' | 'selectedThemeId'>> {
  targetedSkills?: string[];
  interviewerPersona?: InterviewerPersona | string;
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

export type AdminFeedbackTargetType = 'overall_session' | 'ai_question_quality' | 'ai_feedback_quality' | 'user_answer_quality';

export interface AdminFeedbackItem {
  adminId: string;
  adminEmail?: string;
  feedbackText: string;
  targetType: AdminFeedbackTargetType;
  targetQuestionId?: string;
  createdAt: Timestamp;
}

export interface InterviewSessionData extends InterviewSetupData {
  questions: InterviewQuestion[];
  answers: Answer[];
  currentQuestionIndex: number;
  currentQuestionStartTime?: number | null;
  isLoading: boolean;
  error?: string | null;
  interviewStarted: boolean;
  interviewFinished: boolean;
  feedback?: InterviewFeedback | null;
  deepDives?: Record<string, DeepDiveFeedback>;
  sampleAnswers?: Record<string, string>;
  currentCaseTurnNumber?: number | null;
  caseConversationHistory?: Array<{ questionText: string, answerText: string }>;
  isLoggedToServer?: boolean;
  firestoreDocId?: string;
  completedAt?: Timestamp | any;
  adminFeedback?: AdminFeedbackItem[];
  userId?: string; // Added to explicitly store user ID with session data
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

export interface SavedInterviewSetup {
  id?: string;
  userId?: string;
  title: string;
  config: InterviewSetupData;
  createdAt?: any;
  updatedAt?: any;
}

export interface ResumeAnalysis {
  strengths: string[];
  areasForImprovement: string[];
  clarityScore: number;
  impactScore: number;
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

export interface AnalyzeTakeHomeSubmissionContext {
    interviewType: string;
    faangLevel: string;
    jobTitle?: string;
    interviewFocus?: string;
}
export interface AnalyzeTakeHomeSubmissionInput {
    assignmentText: string;
    idealSubmissionCharacteristics: string[];
    userSubmissionText: string;
    interviewContext: AnalyzeTakeHomeSubmissionContext;
}

export interface AnalyzeTakeHomeSubmissionOutput {
    overallAssessment: string;
    strengthsOfSubmission: string[];
    areasForImprovementInSubmission: string[];
    actionableSuggestionsForRevision: string[];
}

export interface SharedAssessmentDocument {
  id?: string;
  userId: string;
  uploaderEmail?: string;
  title: string;
  assessmentType: InterviewType;
  assessmentStyle?: InterviewStyle | '';
  difficultyLevel?: FaangLevel | '';
  content: string;
  keywords?: string[];
  notes?: string;
  source?: string;
  isPublic?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface AppSecrets {
  geminiApiKey?: string;
}
