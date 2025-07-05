/**
 * Type definitions for the multi-agent system
 */

import type { AgentName } from '@/lib/telemetry';

// Agent message types
export interface AgentMessage {
  id: string;
  timestamp: number;
  from: AgentName;
  to: AgentName;
  type: MessageType;
  content: unknown;
  metadata?: MessageMetadata;
}

export enum MessageType {
  // Core message types
  REQUEST = 'request',
  RESPONSE = 'response',
  ERROR = 'error',

  // Control messages
  START_SESSION = 'start_session',
  END_SESSION = 'end_session',
  PAUSE_SESSION = 'pause_session',
  RESUME_SESSION = 'resume_session',

  // Orchestration messages
  DELEGATE_TASK = 'delegate_task',
  TASK_COMPLETE = 'task_complete',
  REQUEST_EVALUATION = 'request_evaluation',
  EVALUATION_COMPLETE = 'evaluation_complete',

  // Context messages
  UPDATE_CONTEXT = 'update_context',
  GET_CONTEXT = 'get_context',
  CONTEXT_UPDATED = 'context_updated',

  // Interview flow
  ASK_QUESTION = 'ask_question',
  RECEIVE_ANSWER = 'receive_answer',
  PROVIDE_FEEDBACK = 'provide_feedback',
  REQUEST_CLARIFICATION = 'request_clarification',
}

export interface MessageMetadata {
  correlationId?: string;
  sessionId: string;
  userId: string;
  retryCount?: number;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

// Interview session state
export enum InterviewState {
  // Initial states
  NOT_STARTED = 'not_started',
  INITIALIZING = 'initializing',

  // Active interview states
  INTRODUCTION = 'introduction',
  WARM_UP = 'warm_up',
  MAIN_QUESTIONS = 'main_questions',
  DEEP_DIVE = 'deep_dive',
  CASE_STUDY = 'case_study',
  BEHAVIORAL = 'behavioral',

  // Product sense specific states
  SCOPING = 'scoping',
  ANALYSIS = 'analysis',
  SOLUTIONING = 'solutioning',
  METRICS = 'metrics',

  // Closing states
  WRAP_UP = 'wrap_up',
  FEEDBACK = 'feedback',
  COMPLETED = 'completed',

  // Error states
  ERROR = 'error',
  TERMINATED = 'terminated',
}

// State transition rules
export interface StateTransition {
  from: InterviewState;
  to: InterviewState;
  condition?: (context: InterviewContext) => boolean;
  action?: (context: InterviewContext) => void;
}

// Interview context shared between agents
export interface InterviewContext {
  sessionId: string;
  userId: string;
  state: InterviewState;
  interviewType: string;
  faangLevel: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  startTime: number;

  // Question tracking
  questionsAsked: string[];
  questionsRemaining: string[];
  currentQuestion?: string;

  // Answer tracking
  answers: AnswerRecord[];
  currentAnswer?: string;

  // Evaluation data
  evaluations: EvaluationRecord[];
  overallScore?: number;

  // Metadata
  resume?: string;
  jobDescription?: string;
  targetCompany?: string;
  targetRole?: string;

  // Case study specific
  caseContext?: CaseStudyContext;

  // Feature flags
  features?: {
    realTimeEvaluation?: boolean;
    adaptiveDifficulty?: boolean;
    detailedFeedback?: boolean;
  };
}

export interface AnswerRecord {
  questionId: string;
  question: string;
  answer: string;
  timestamp: number;
  duration: number;
  confidence?: number;
}

export interface EvaluationRecord {
  questionId: string;
  score: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
  evaluatorNotes?: string;
}

export interface CaseStudyContext {
  scenario: string;
  constraints: string[];
  assumptions: string[];
  notes: string;
  currentPhase: 'problem_definition' | 'analysis' | 'solution' | 'metrics';
}

// Agent capabilities
export interface AgentCapabilities {
  canAskQuestions: boolean;
  canEvaluate: boolean;
  canProvideHints: boolean;
  canAdaptDifficulty: boolean;
  canGenerateReport: boolean;
  supportedInterviewTypes: string[];
  supportedStates: InterviewState[];
}

// Agent health and metrics
export interface AgentHealth {
  agentName: AgentName;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: number;
  metrics: {
    requestsHandled: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
  };
  errors?: string[];
}

// Orchestrator specific types
export interface TaskDelegation {
  taskId: string;
  fromAgent: AgentName;
  toAgent: AgentName;
  taskType: string;
  payload: unknown;
  deadline?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  completedAt: number;
  duration: number;
}

// Interview flow control
export interface InterviewFlowControl {
  canProceed: boolean;
  nextState?: InterviewState;
  reason?: string;
  requiredActions?: string[];
}

// Intervention directives
export interface InterventionDirective {
  type: 'hint' | 'clarification' | 'encouragement' | 'redirect';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  targetAgent?: AgentName;
}
