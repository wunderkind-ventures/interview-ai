/**
 * Telemetry and monitoring infrastructure for the AI Interview Coach
 * Integrates with Genkit's built-in OpenTelemetry support
 */

import { trace, metrics, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Agent names as defined in our architecture
export enum AgentName {
  ORCHESTRATOR = 'orchestrator',
  CONTEXT = 'context',
  INTERVIEWER = 'interviewer',
  EVALUATOR = 'evaluator',
  SYNTHESIS = 'synthesis',
  COACHING = 'coaching',
  STORY_DECONSTRUCTOR = 'story-deconstructor',
  IMPACT_QUANTIFIER = 'impact-quantifier',
  ACHIEVEMENT_REFRAMING = 'achievement-reframing',
  PROMPT_ENGINEER = 'prompt-engineer',
  CHALLENGER = 'challenger'
}

export enum ComplexityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum ReasoningStrategy {
  LEAN = 'LEAN',
  COT = 'COT',
  STEP_BACK = 'STEP_BACK'
}

// Tracer instances for each agent
const tracer = trace.getTracer('interview-ai-agents', '1.0.0');
const meter = metrics.getMeter('interview-ai-agents', '1.0.0');

// Custom metrics
export const agentMetrics = {
  // Performance metrics
  agentLatency: meter.createHistogram('agent_latency_ms', {
    description: 'Latency of agent operations in milliseconds',
    unit: 'ms'
  }),
  
  tokenUsage: meter.createCounter('agent_token_usage', {
    description: 'Number of tokens used by agent operations'
  }),
  
  operationSuccess: meter.createCounter('agent_operation_success', {
    description: 'Number of successful agent operations'
  }),
  
  operationFailure: meter.createCounter('agent_operation_failure', {
    description: 'Number of failed agent operations'
  }),
  
  // Business metrics
  complexityDistribution: meter.createCounter('complexity_assessment', {
    description: 'Distribution of complexity assessments'
  }),
  
  stateTransitions: meter.createCounter('state_transitions', {
    description: 'Number of state transitions by type'
  }),
  
  fallbackUsage: meter.createCounter('fallback_usage', {
    description: 'Number of times fallback strategies were used'
  }),
  
  // Cost metrics
  operationCost: meter.createHistogram('operation_cost_usd', {
    description: 'Cost of operations in USD',
    unit: 'USD'
  })
};

export interface AgentTraceAttributes {
  agentName: AgentName;
  agentVersion: string;
  sessionId: string;
  userId: string;
  complexityLevel?: ComplexityLevel;
  reasoningStrategy?: ReasoningStrategy;
  promptVariant?: string;
  interviewPhase?: string;
}

export interface AgentMetrics {
  latency: number;
  tokensUsed: number;
  cost: number;
  success: boolean;
  errorType?: string;
  fallbackUsed?: boolean;
}

/**
 * Decorator for tracing agent operations
 */
export function traceAgentOperation(
  operationName: string,
  agentName: AgentName
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(operationName, {
        kind: SpanKind.INTERNAL,
        attributes: {
          'agent.name': agentName,
          'agent.operation': operationName,
          'agent.method': propertyName
        }
      });

      const startTime = Date.now();

      try {
        const result = await method.apply(this, args);
        
        // Record success metrics
        agentMetrics.operationSuccess.add(1, {
          agent_name: agentName,
          operation: operationName
        });
        
        const latency = Date.now() - startTime;
        agentMetrics.agentLatency.record(latency, {
          agent_name: agentName,
          operation: operationName
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({
          'operation.duration_ms': latency,
          'operation.success': true
        });
        
        return result;
      } catch (error: any) {
        // Record failure metrics
        agentMetrics.operationFailure.add(1, {
          agent_name: agentName,
          operation: operationName,
          error_type: error.constructor.name
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        
        span.setAttributes({
          'operation.error': true,
          'error.type': error.constructor.name,
          'error.message': error.message
        });
        
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Start a new agent trace span
 */
export function startAgentSpan(
  operationName: string,
  attributes: AgentTraceAttributes
): any {
  return tracer.startSpan(operationName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'agent.name': attributes.agentName,
      'agent.version': attributes.agentVersion,
      'session.id': attributes.sessionId,
      'user.id': attributes.userId,
      ...(attributes.complexityLevel && { 'operation.complexity': attributes.complexityLevel }),
      ...(attributes.reasoningStrategy && { 'operation.reasoning_strategy': attributes.reasoningStrategy }),
      ...(attributes.promptVariant && { 'prompt.variant': attributes.promptVariant }),
      ...(attributes.interviewPhase && { 'interview.phase': attributes.interviewPhase })
    }
  });
}

/**
 * Record agent performance metrics
 */
export function recordAgentMetrics(
  agentName: AgentName,
  operation: string,
  metrics: AgentMetrics
): void {
  const commonAttributes = {
    agent_name: agentName,
    operation: operation
  };

  // Record latency
  agentMetrics.agentLatency.record(metrics.latency, commonAttributes);
  
  // Record token usage
  agentMetrics.tokenUsage.add(metrics.tokensUsed, commonAttributes);
  
  // Record cost
  agentMetrics.operationCost.record(metrics.cost, commonAttributes);
  
  // Record success/failure
  if (metrics.success) {
    agentMetrics.operationSuccess.add(1, commonAttributes);
  } else {
    agentMetrics.operationFailure.add(1, {
      ...commonAttributes,
      error_type: metrics.errorType || 'unknown'
    });
  }
  
  // Record fallback usage
  if (metrics.fallbackUsed) {
    agentMetrics.fallbackUsage.add(1, commonAttributes);
  }
}

/**
 * Record complexity assessment
 */
export function recordComplexityAssessment(
  complexity: ComplexityLevel,
  agentName: AgentName
): void {
  agentMetrics.complexityDistribution.add(1, {
    complexity_level: complexity,
    agent_name: agentName
  });
}

/**
 * Record state transition
 */
export function recordStateTransition(
  fromState: string,
  toState: string,
  sessionId: string
): void {
  agentMetrics.stateTransitions.add(1, {
    from_state: fromState,
    to_state: toState,
    session_id: sessionId
  });
}

/**
 * Create a child span for agent communication
 */
export function createAgentCommunicationSpan(
  parentSpan: any,
  fromAgent: AgentName,
  toAgent: AgentName,
  messageType: string
): any {
  return tracer.startSpan(`${fromAgent}->${toAgent}`, {
    parent: parentSpan,
    kind: SpanKind.CLIENT,
    attributes: {
      'communication.from_agent': fromAgent,
      'communication.to_agent': toAgent,
      'communication.message_type': messageType,
      'communication.direction': 'outbound'
    }
  });
}

/**
 * Enhanced error tracking with context
 */
export function recordAgentError(
  agentName: AgentName,
  operation: string,
  error: Error,
  context: Record<string, any> = {}
): void {
  const span = trace.getActiveSpan();
  
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    
    // Add context attributes
    Object.entries(context).forEach(([key, value]) => {
      span.setAttribute(`error.context.${key}`, String(value));
    });
  }
  
  // Record error metrics
  agentMetrics.operationFailure.add(1, {
    agent_name: agentName,
    operation: operation,
    error_type: error.constructor.name
  });
}

/**
 * Session-level tracing utilities
 */
export class SessionTracker {
  private sessionId: string;
  private userId: string;
  private sessionSpan: any;

  constructor(sessionId: string, userId: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.sessionSpan = tracer.startSpan('interview_session', {
      kind: SpanKind.SERVER,
      attributes: {
        'session.id': sessionId,
        'user.id': userId,
        'session.type': 'interview'
      }
    });
  }

  createAgentOperationSpan(
    agentName: AgentName,
    operation: string,
    attributes: Partial<AgentTraceAttributes> = {}
  ) {
    return tracer.startSpan(`${agentName}.${operation}`, {
      parent: this.sessionSpan,
      kind: SpanKind.INTERNAL,
      attributes: {
        'agent.name': agentName,
        'agent.operation': operation,
        'session.id': this.sessionId,
        'user.id': this.userId,
        ...attributes
      }
    });
  }

  endSession(outcome: 'completed' | 'failed' | 'abandoned') {
    this.sessionSpan.setAttributes({
      'session.outcome': outcome,
      'session.end_time': new Date().toISOString()
    });
    
    this.sessionSpan.end();
  }
}

/**
 * Cost calculation utilities
 */
export function calculateOperationCost(
  tokensUsed: number,
  modelName: string = 'gemini-pro-1.5'
): number {
  // Gemini Pro 1.5 pricing (as of 2025)
  const pricePerToken = {
    'gemini-pro-1.5': 0.00000125, // $1.25 per 1M tokens
    'gemini-flash': 0.000000075   // $0.075 per 1M tokens
  };
  
  return tokensUsed * (pricePerToken[modelName] || pricePerToken['gemini-pro-1.5']);
}

export default {
  tracer,
  meter,
  agentMetrics,
  traceAgentOperation,
  startAgentSpan,
  recordAgentMetrics,
  recordComplexityAssessment,
  recordStateTransition,
  createAgentCommunicationSpan,
  recordAgentError,
  SessionTracker,
  calculateOperationCost
};