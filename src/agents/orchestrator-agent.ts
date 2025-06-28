/**
 * Orchestrator Agent - Proof of Concept for Google Agent Development Kit Migration
 * 
 * This is a proof of concept implementation that simulates how the Orchestrator Agent
 * would work in Google's Agent Development Kit. It demonstrates:
 * - State machine management
 * - Agent communication patterns
 * - Adaptive reasoning logic
 * - Error handling and fallbacks
 */

import { z } from 'zod';
import { AgentName, ComplexityLevel, ReasoningStrategy, SessionTracker, recordStateTransition, recordComplexityAssessment } from '@/lib/telemetry';
import { circuitBreakerManager, withCircuitBreaker } from '@/lib/circuit-breaker';
import { configManager } from '@/lib/config-manager';

// State machine definitions
export enum InterviewState {
  CONFIGURING = 'configuring',
  SCOPING = 'scoping',
  ANALYSIS = 'analysis',
  SOLUTIONING = 'solutioning',
  METRICS = 'metrics',
  CHALLENGING = 'challenging',
  REPORT_GENERATION = 'report_generation',
  END = 'end'
}

export enum InterventionType {
  PREVENT_PREMATURE_SOLUTIONING = 'prevent_premature_solutioning',
  ENSURE_USER_FOCUS = 'ensure_user_focus',
  DEMAND_PRIORITIZATION_RATIONALE = 'demand_prioritization_rationale',
  REQUIRE_MEASURABLE_METRICS = 'require_measurable_metrics',
  HANDLE_SILENCE_OR_CONFUSION = 'handle_silence_or_confusion'
}

// Message schemas for agent communication
const AgentMessageSchema = z.object({
  type: z.string(),
  fromAgent: z.nativeEnum(AgentName),
  toAgent: z.nativeEnum(AgentName),
  sessionId: z.string(),
  timestamp: z.date().default(() => new Date()),
  payload: z.any()
});

const StateTransitionEventSchema = z.object({
  fromState: z.nativeEnum(InterviewState),
  toState: z.nativeEnum(InterviewState),
  trigger: z.enum(['user_action', 'semantic', 'agent_action', 'timeout']),
  sessionId: z.string(),
  metadata: z.any().optional()
});

const InterventionDirectiveSchema = z.object({
  type: z.nativeEnum(InterventionType),
  message: z.string(),
  context: z.any().optional()
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type StateTransitionEvent = z.infer<typeof StateTransitionEventSchema>;
export type InterventionDirective = z.infer<typeof InterventionDirectiveSchema>;

// Session state management
interface SessionState {
  sessionId: string;
  userId: string;
  currentState: InterviewState;
  previousState?: InterviewState;
  
  context: {
    interviewType: string;
    faangLevel: string;
    resume?: any;
    jobDescription?: string;
  };
  
  complexity: ComplexityLevel;
  reasoningStrategy: ReasoningStrategy;
  
  timeline: {
    startTime: Date;
    stateTransitions: Array<{
      state: InterviewState;
      timestamp: Date;
      trigger: string;
    }>;
  };
  
  scores: {
    [competency: string]: number;
  };
  
  interventions: InterventionDirective[];
  lastUserResponse?: string;
  lastResponseTimestamp?: Date;
}

/**
 * Mock Agent Communication Interface
 * Simulates the ADK agent communication system
 */
class AgentCommunicator {
  private messageQueue = new Map<AgentName, AgentMessage[]>();
  
  async sendMessage(message: AgentMessage): Promise<void> {
    console.log(`📨 ${message.fromAgent} → ${message.toAgent}: ${message.type}`);
    
    if (!this.messageQueue.has(message.toAgent)) {
      this.messageQueue.set(message.toAgent, []);
    }
    
    this.messageQueue.get(message.toAgent)!.push(message);
    
    // Simulate async message delivery
    await this.delay(Math.random() * 100);
  }
  
  async receiveMessages(agentName: AgentName): Promise<AgentMessage[]> {
    const messages = this.messageQueue.get(agentName) || [];
    this.messageQueue.set(agentName, []);
    return messages;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * State Machine Implementation
 */
class InterviewStateMachine {
  private validTransitions = new Map<InterviewState, InterviewState[]>([
    [InterviewState.CONFIGURING, [InterviewState.SCOPING]],
    [InterviewState.SCOPING, [InterviewState.ANALYSIS, InterviewState.CHALLENGING]],
    [InterviewState.ANALYSIS, [InterviewState.SOLUTIONING, InterviewState.CHALLENGING]],
    [InterviewState.SOLUTIONING, [InterviewState.METRICS, InterviewState.CHALLENGING]],
    [InterviewState.METRICS, [InterviewState.CHALLENGING]],
    [InterviewState.CHALLENGING, [InterviewState.REPORT_GENERATION]],
    [InterviewState.REPORT_GENERATION, [InterviewState.END]],
    [InterviewState.END, []]
  ]);

  canTransition(from: InterviewState, to: InterviewState): boolean {
    const allowedTransitions = this.validTransitions.get(from) || [];
    return allowedTransitions.includes(to);
  }

  getNextStates(currentState: InterviewState): InterviewState[] {
    return this.validTransitions.get(currentState) || [];
  }
}

/**
 * Orchestrator Agent Implementation
 * Simulates ADK agent architecture
 */
export class OrchestratorAgent {
  private sessionStates = new Map<string, SessionState>();
  private stateMachine = new InterviewStateMachine();
  private communicator = new AgentCommunicator();
  private sessionTrackers = new Map<string, SessionTracker>();

  constructor() {
    this.startMessageProcessing();
  }

  /**
   * Start a new interview session
   */
  @withCircuitBreaker(AgentName.ORCHESTRATOR, 'start_interview')
  async startInterview(input: {
    userId: string;
    sessionId: string;
    interviewType: string;
    faangLevel: string;
    resume?: any;
    jobDescription?: string;
  }): Promise<{ success: boolean; initialState: InterviewState }> {
    console.log(`🎯 Starting interview session ${input.sessionId} for user ${input.userId}`);
    
    // Initialize session tracker
    const sessionTracker = new SessionTracker(input.sessionId, input.userId);
    this.sessionTrackers.set(input.sessionId, sessionTracker);
    
    // Initialize session state
    const sessionState: SessionState = {
      sessionId: input.sessionId,
      userId: input.userId,
      currentState: InterviewState.CONFIGURING,
      
      context: {
        interviewType: input.interviewType,
        faangLevel: input.faangLevel,
        resume: input.resume,
        jobDescription: input.jobDescription
      },
      
      complexity: await this.assessInitialComplexity(input),
      reasoningStrategy: ReasoningStrategy.LEAN, // Will be updated based on complexity
      
      timeline: {
        startTime: new Date(),
        stateTransitions: [{
          state: InterviewState.CONFIGURING,
          timestamp: new Date(),
          trigger: 'session_start'
        }]
      },
      
      scores: {},
      interventions: []
    };

    this.sessionStates.set(input.sessionId, sessionState);

    // Transition to scoping
    await this.transitionState(input.sessionId, InterviewState.SCOPING, 'user_action');

    // Send directive to Context Agent to parse resume
    if (input.resume) {
      await this.communicator.sendMessage({
        type: 'parse_resume',
        fromAgent: AgentName.ORCHESTRATOR,
        toAgent: AgentName.CONTEXT,
        sessionId: input.sessionId,
        timestamp: new Date(),
        payload: {
          documentUrl: input.resume,
          sessionId: input.sessionId
        }
      });
    }

    // Send directive to Interviewer Agent
    await this.communicator.sendMessage({
      type: 'generate_scoping_question',
      fromAgent: AgentName.ORCHESTRATOR,
      toAgent: AgentName.INTERVIEWER,
      sessionId: input.sessionId,
      timestamp: new Date(),
      payload: {
        phase: InterviewState.SCOPING,
        complexity: sessionState.complexity,
        context: sessionState.context
      }
    });

    return {
      success: true,
      initialState: InterviewState.SCOPING
    };
  }

  /**
   * Handle user response and orchestrate next steps
   */
  async handleUserResponse(input: {
    sessionId: string;
    response: string;
    responseTime?: number;
  }): Promise<{ nextAction: string; intervention?: InterventionDirective }> {
    const sessionState = this.sessionStates.get(input.sessionId);
    if (!sessionState) {
      throw new Error(`Session ${input.sessionId} not found`);
    }

    // Update session state
    sessionState.lastUserResponse = input.response;
    sessionState.lastResponseTimestamp = new Date();

    // Send response to Evaluator Agent for real-time analysis
    await this.communicator.sendMessage({
      type: 'evaluate_response',
      fromAgent: AgentName.ORCHESTRATOR,
      toAgent: AgentName.EVALUATOR,
      sessionId: input.sessionId,
      timestamp: new Date(),
      payload: {
        response: input.response,
        currentPhase: sessionState.currentState,
        complexity: sessionState.complexity,
        responseTime: input.responseTime
      }
    });

    // Check for semantic transition triggers
    const nextState = await this.detectSemanticTransition(
      sessionState.currentState,
      input.response
    );

    if (nextState) {
      await this.transitionState(input.sessionId, nextState, 'semantic');
      return { nextAction: `transition_to_${nextState}` };
    }

    return { nextAction: 'continue_current_phase' };
  }

  /**
   * Handle messages from other agents
   */
  async handleAgentMessage(message: AgentMessage): Promise<void> {
    const sessionState = this.sessionStates.get(message.sessionId);
    if (!sessionState) {
      console.warn(`Received message for unknown session: ${message.sessionId}`);
      return;
    }

    console.log(`📬 Orchestrator received: ${message.type} from ${message.fromAgent}`);

    switch (message.type) {
      case 'context_ready':
        await this.handleContextReady(message);
        break;
        
      case 'response_scored':
        await this.handleResponseScored(message);
        break;
        
      case 'question_generated':
        await this.handleQuestionGenerated(message);
        break;
        
      default:
        console.log(`Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Assess complexity and adapt reasoning strategy
   */
  private async assessInitialComplexity(input: {
    interviewType: string;
    faangLevel: string;
    jobDescription?: string;
  }): Promise<ComplexityLevel> {
    const complexitySpan = this.sessionTrackers.get(input.sessionId || 'temp')
      ?.createAgentOperationSpan(AgentName.ORCHESTRATOR, 'assess_complexity');

    try {
      // Complexity assessment logic based on our design document
      const complexityFactors = {
        'data structures & algorithms': 1.0,
        'technical system design': 1.2,
        'machine learning': 1.1,
        'product sense': 0.9,
        'behavioral': 0.8
      };

      const levelFactors = {
        'L3': 0.8,
        'L4': 1.0,
        'L5': 1.2,
        'L6': 1.4,
        'L7+': 1.6
      };

      const typeScore = complexityFactors[input.interviewType] || 1.0;
      const levelScore = levelFactors[input.faangLevel] || 1.0;
      const complexityScore = typeScore * levelScore;

      let complexity: ComplexityLevel;
      if (complexityScore <= 0.9) {
        complexity = ComplexityLevel.LOW;
      } else if (complexityScore <= 1.2) {
        complexity = ComplexityLevel.MEDIUM;
      } else {
        complexity = ComplexityLevel.HIGH;
      }

      recordComplexityAssessment(complexity, AgentName.ORCHESTRATOR);

      complexitySpan?.setAttributes({
        'complexity.score': complexityScore,
        'complexity.level': complexity,
        'complexity.interview_type': input.interviewType,
        'complexity.faang_level': input.faangLevel
      });

      return complexity;

    } finally {
      complexitySpan?.end();
    }
  }

  /**
   * Transition state with validation and tracking
   */
  private async transitionState(
    sessionId: string,
    newState: InterviewState,
    trigger: StateTransitionEvent['trigger']
  ): Promise<boolean> {
    const sessionState = this.sessionStates.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentState = sessionState.currentState;

    // Validate transition
    if (!this.stateMachine.canTransition(currentState, newState)) {
      console.warn(`Invalid transition from ${currentState} to ${newState}`);
      return false;
    }

    // Update state
    sessionState.previousState = currentState;
    sessionState.currentState = newState;
    sessionState.timeline.stateTransitions.push({
      state: newState,
      timestamp: new Date(),
      trigger
    });

    // Record metrics
    recordStateTransition(currentState, newState, sessionId);

    console.log(`🔄 State transition: ${currentState} → ${newState} (${trigger})`);

    // Handle state-specific logic
    await this.handleStateEntry(sessionId, newState);

    return true;
  }

  /**
   * Handle entry into new state
   */
  private async handleStateEntry(sessionId: string, state: InterviewState): Promise<void> {
    const sessionState = this.sessionStates.get(sessionId)!;

    switch (state) {
      case InterviewState.ANALYSIS:
        // Assess complexity before transitioning
        const complexity = await this.assessResponseComplexity(
          sessionState.lastUserResponse || ''
        );
        sessionState.complexity = complexity;
        
        // Update reasoning strategy
        sessionState.reasoningStrategy = this.selectReasoningStrategy(complexity);
        
        // Notify Interviewer Agent of new phase and strategy
        await this.communicator.sendMessage({
          type: 'phase_transition',
          fromAgent: AgentName.ORCHESTRATOR,
          toAgent: AgentName.INTERVIEWER,
          sessionId,
          timestamp: new Date(),
          payload: {
            newPhase: state,
            complexity: complexity,
            reasoningStrategy: sessionState.reasoningStrategy
          }
        });
        break;

      case InterviewState.CHALLENGING:
        // Decide on appropriate challenge based on session history
        const challengeType = await this.selectChallengeType(sessionState);
        
        await this.communicator.sendMessage({
          type: 'generate_challenge',
          fromAgent: AgentName.ORCHESTRATOR,
          toAgent: AgentName.INTERVIEWER,
          sessionId,
          timestamp: new Date(),
          payload: {
            challengeType,
            sessionHistory: sessionState.timeline,
            currentScores: sessionState.scores
          }
        });
        break;

      case InterviewState.REPORT_GENERATION:
        // Trigger report generation
        await this.communicator.sendMessage({
          type: 'generate_report',
          fromAgent: AgentName.ORCHESTRATOR,
          toAgent: AgentName.SYNTHESIS,
          sessionId,
          timestamp: new Date(),
          payload: {
            sessionData: sessionState,
            finalScores: sessionState.scores
          }
        });
        break;
    }
  }

  /**
   * Check gating conditions and generate interventions
   */
  private async checkGatingConditions(
    sessionId: string,
    scores: Record<string, number>
  ): Promise<InterventionDirective | null> {
    const sessionState = this.sessionStates.get(sessionId)!;

    // Prevent premature solutioning
    if (sessionState.currentState === InterviewState.SCOPING) {
      const hasSolutionKeywords = this.containsSolutionKeywords(
        sessionState.lastUserResponse || ''
      );
      const problemDefinitionScore = scores['Problem Definition & Structuring'] || 0;

      if (hasSolutionKeywords && problemDefinitionScore < 3) {
        return {
          type: InterventionType.PREVENT_PREMATURE_SOLUTIONING,
          message: "That's an interesting idea. Before we dive into solutions, could you first walk me through how you're structuring your overall approach to this problem?",
          context: { currentScore: problemDefinitionScore }
        };
      }
    }

    // Ensure user focus
    if (sessionState.currentState === InterviewState.ANALYSIS) {
      const hasUserKeywords = this.containsUserKeywords(
        sessionState.lastUserResponse || ''
      );

      if (!hasUserKeywords) {
        return {
          type: InterventionType.ENSURE_USER_FOCUS,
          message: "This is a good start. Could you tell me more about the specific users or customers you are designing this for?",
          context: { missingUserFocus: true }
        };
      }
    }

    return null;
  }

  /**
   * Detect semantic transitions based on user response
   */
  private async detectSemanticTransition(
    currentState: InterviewState,
    response: string
  ): Promise<InterviewState | null> {
    const transitionKeywords = {
      [InterviewState.SCOPING]: {
        toAnalysis: ['move on to', 'user segments', 'pain points', 'understand the problem']
      },
      [InterviewState.ANALYSIS]: {
        toSolutioning: ['solution I propose', 'recommendation', 'feature I would build']
      },
      [InterviewState.SOLUTIONING]: {
        toMetrics: ['measure success', 'KPIs', 'North Star metric']
      }
    };

    const keywords = transitionKeywords[currentState];
    if (!keywords) return null;

    for (const [targetState, keywordList] of Object.entries(keywords)) {
      if (keywordList.some(keyword => response.toLowerCase().includes(keyword.toLowerCase()))) {
        const stateMapping = {
          toAnalysis: InterviewState.ANALYSIS,
          toSolutioning: InterviewState.SOLUTIONING,
          toMetrics: InterviewState.METRICS
        };
        return stateMapping[targetState as keyof typeof stateMapping] || null;
      }
    }

    return null;
  }

  // Message handlers
  private async handleContextReady(message: AgentMessage): Promise<void> {
    const { sessionId, context } = message.payload;
    const sessionState = this.sessionStates.get(sessionId);
    
    if (sessionState) {
      sessionState.context = { ...sessionState.context, ...context };
      console.log(`📋 Context ready for session ${sessionId}`);
    }
  }

  private async handleResponseScored(message: AgentMessage): Promise<void> {
    const { sessionId, scores } = message.payload;
    const sessionState = this.sessionStates.get(sessionId);
    
    if (sessionState) {
      // Update scores
      sessionState.scores = { ...sessionState.scores, ...scores };
      
      // Check for interventions
      const intervention = await this.checkGatingConditions(sessionId, scores);
      
      if (intervention) {
        sessionState.interventions.push(intervention);
        
        // Send intervention to Interviewer
        await this.communicator.sendMessage({
          type: 'intervention',
          fromAgent: AgentName.ORCHESTRATOR,
          toAgent: AgentName.INTERVIEWER,
          sessionId,
          timestamp: new Date(),
          payload: intervention
        });
      }
    }
  }

  private async handleQuestionGenerated(message: AgentMessage): Promise<void> {
    const { sessionId, question, metadata } = message.payload;
    console.log(`❓ Question generated for session ${sessionId}: ${question.substring(0, 100)}...`);
  }

  // Helper methods
  private selectReasoningStrategy(complexity: ComplexityLevel): ReasoningStrategy {
    switch (complexity) {
      case ComplexityLevel.LOW:
        return ReasoningStrategy.LEAN;
      case ComplexityLevel.MEDIUM:
        return ReasoningStrategy.COT;
      case ComplexityLevel.HIGH:
        return ReasoningStrategy.STEP_BACK;
    }
  }

  private async assessResponseComplexity(response: string): Promise<ComplexityLevel> {
    // Simple complexity assessment based on response characteristics
    const wordCount = response.split(' ').length;
    const hasComplexConcepts = /\b(architecture|scalability|microservices|distributed|algorithm)\b/i.test(response);
    
    if (wordCount > 200 && hasComplexConcepts) {
      return ComplexityLevel.HIGH;
    } else if (wordCount > 100 || hasComplexConcepts) {
      return ComplexityLevel.MEDIUM;
    }
    
    return ComplexityLevel.LOW;
  }

  private async selectChallengeType(sessionState: SessionState): Promise<string> {
    // Select challenge based on session performance
    const lowScores = Object.entries(sessionState.scores)
      .filter(([_, score]) => score < 3)
      .map(([competency, _]) => competency);

    if (lowScores.length > 0) {
      return `targeted_challenge_${lowScores[0].toLowerCase().replace(/\s+/g, '_')}`;
    }

    return 'general_challenge';
  }

  private containsSolutionKeywords(response: string): boolean {
    const solutionKeywords = ['solution', 'recommend', 'build', 'implement', 'design'];
    return solutionKeywords.some(keyword => 
      response.toLowerCase().includes(keyword)
    );
  }

  private containsUserKeywords(response: string): boolean {
    const userKeywords = ['user', 'customer', 'persona', 'audience'];
    return userKeywords.some(keyword => 
      response.toLowerCase().includes(keyword)
    );
  }

  private async startMessageProcessing(): Promise<void> {
    // Start message processing loop
    setInterval(async () => {
      const messages = await this.communicator.receiveMessages(AgentName.ORCHESTRATOR);
      for (const message of messages) {
        try {
          await this.handleAgentMessage(message);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    }, 1000);
  }

  // Public getters for testing and monitoring
  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  getCurrentState(sessionId: string): InterviewState | undefined {
    return this.sessionStates.get(sessionId)?.currentState;
  }

  getSessionMetrics(sessionId: string) {
    const state = this.sessionStates.get(sessionId);
    if (!state) return null;

    return {
      duration: Date.now() - state.timeline.startTime.getTime(),
      stateTransitions: state.timeline.stateTransitions.length,
      interventions: state.interventions.length,
      scores: state.scores,
      complexity: state.complexity,
      currentState: state.currentState
    };
  }
}

// Export singleton instance for testing
export const orchestratorAgent = new OrchestratorAgent();

export default OrchestratorAgent;