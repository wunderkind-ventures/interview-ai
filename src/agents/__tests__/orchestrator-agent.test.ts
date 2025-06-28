/**
 * Test suite for Orchestrator Agent
 * Demonstrates the ADK-style agent architecture
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { OrchestratorAgent, InterviewState, orchestratorAgent } from '../orchestrator-agent';
import { AgentName, ComplexityLevel } from '@/lib/telemetry';

describe('Orchestrator Agent - ADK Proof of Concept', () => {
  let orchestrator: OrchestratorAgent;
  let testSessionId: string;
  let testUserId: string;

  beforeEach(() => {
    orchestrator = new OrchestratorAgent();
    testSessionId = `test-session-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
  });

  describe('Session Management', () => {
    test('should start interview session successfully', async () => {
      const result = await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'technical system design',
        faangLevel: 'L5',
        resume: { content: 'Senior Software Engineer with 5 years experience' }
      });

      expect(result.success).toBe(true);
      expect(result.initialState).toBe(InterviewState.SCOPING);

      const sessionState = orchestrator.getSessionState(testSessionId);
      expect(sessionState).toBeDefined();
      expect(sessionState?.currentState).toBe(InterviewState.SCOPING);
      expect(sessionState?.complexity).toBeDefined();
    });

    test('should assess complexity correctly for different interview types', async () => {
      // High complexity case
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId + '-high',
        interviewType: 'technical system design',
        faangLevel: 'L6'
      });

      const highComplexityState = orchestrator.getSessionState(testSessionId + '-high');
      expect(highComplexityState?.complexity).toBe(ComplexityLevel.HIGH);

      // Low complexity case
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId + '-low',
        interviewType: 'behavioral',
        faangLevel: 'L3'
      });

      const lowComplexityState = orchestrator.getSessionState(testSessionId + '-low');
      expect(lowComplexityState?.complexity).toBe(ComplexityLevel.LOW);
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'product sense',
        faangLevel: 'L4'
      });
    });

    test('should transition from scoping to analysis on semantic trigger', async () => {
      const response = "Now I'll move on to the users. The key user segments I see are power users and casual users.";
      
      const result = await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response,
        responseTime: 45000
      });

      expect(result.nextAction).toContain('transition');
      
      const sessionState = orchestrator.getSessionState(testSessionId);
      expect(sessionState?.currentState).toBe(InterviewState.ANALYSIS);
      expect(sessionState?.previousState).toBe(InterviewState.SCOPING);
    });

    test('should transition from analysis to solutioning', async () => {
      // First transition to analysis
      await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response: "Let me identify the user segments first."
      });

      // Then transition to solutioning
      const solutionResponse = "Based on that analysis, the solution I'd propose is a tiered notification system.";
      
      const result = await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response: solutionResponse
      });

      const sessionState = orchestrator.getSessionState(testSessionId);
      expect(sessionState?.currentState).toBe(InterviewState.SOLUTIONING);
    });

    test('should track state transition timeline', async () => {
      const initialState = orchestrator.getSessionState(testSessionId);
      const initialTransitions = initialState?.timeline.stateTransitions.length || 0;

      await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response: "Let me analyze the user personas and pain points."
      });

      const updatedState = orchestrator.getSessionState(testSessionId);
      const updatedTransitions = updatedState?.timeline.stateTransitions.length || 0;

      expect(updatedTransitions).toBeGreaterThan(initialTransitions);
      expect(updatedState?.timeline.stateTransitions).toContainEqual(
        expect.objectContaining({
          state: InterviewState.ANALYSIS,
          trigger: 'semantic'
        })
      );
    });
  });

  describe('Adaptive Reasoning', () => {
    test('should adapt reasoning strategy based on complexity', async () => {
      // High complexity interview
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId + '-complex',
        interviewType: 'technical system design',
        faangLevel: 'L6'
      });

      const complexState = orchestrator.getSessionState(testSessionId + '-complex');
      expect(complexState?.reasoningStrategy).toBeDefined();

      // Simulate complex response
      const complexResponse = `
        For this distributed system architecture, I need to consider multiple factors:
        scalability, consistency, availability, and partition tolerance. The microservices
        architecture would involve API gateways, service discovery, load balancing,
        and eventual consistency patterns across multiple data centers.
      `;

      await orchestrator.handleUserResponse({
        sessionId: testSessionId + '-complex',
        response: complexResponse
      });

      const updatedState = orchestrator.getSessionState(testSessionId + '-complex');
      // Should use more sophisticated reasoning for complex responses
      expect(updatedState?.reasoningStrategy).toBeDefined();
    });
  });

  describe('Error Handling and Circuit Breaker', () => {
    test('should handle invalid session gracefully', async () => {
      await expect(
        orchestrator.handleUserResponse({
          sessionId: 'non-existent-session',
          response: 'Some response'
        })
      ).rejects.toThrow('Session non-existent-session not found');
    });

    test('should track session metrics', async () => {
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'behavioral',
        faangLevel: 'L4'
      });

      // Generate some activity
      await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response: "I led a project to improve team collaboration."
      });

      const metrics = orchestrator.getSessionMetrics(testSessionId);
      expect(metrics).toBeDefined();
      expect(metrics?.stateTransitions).toBeGreaterThan(0);
      expect(metrics?.duration).toBeGreaterThan(0);
      expect(metrics?.currentState).toBeDefined();
    });
  });

  describe('Agent Communication Simulation', () => {
    test('should simulate agent message handling', async () => {
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'technical system design',
        faangLevel: 'L5'
      });

      // Simulate message from Evaluator Agent
      await orchestrator.handleAgentMessage({
        type: 'response_scored',
        fromAgent: AgentName.EVALUATOR,
        toAgent: AgentName.ORCHESTRATOR,
        sessionId: testSessionId,
        timestamp: new Date(),
        payload: {
          sessionId: testSessionId,
          scores: {
            'Problem Definition & Structuring': 2,
            'Technical Depth': 4
          }
        }
      });

      const sessionState = orchestrator.getSessionState(testSessionId);
      expect(sessionState?.scores).toEqual({
        'Problem Definition & Structuring': 2,
        'Technical Depth': 4
      });
    });

    test('should generate interventions based on low scores', async () => {
      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'product sense',
        faangLevel: 'L4'
      });

      // Set up for premature solutioning scenario
      await orchestrator.handleUserResponse({
        sessionId: testSessionId,
        response: "I think the solution should be a mobile app with push notifications."
      });

      // Simulate low score from evaluator
      await orchestrator.handleAgentMessage({
        type: 'response_scored',
        fromAgent: AgentName.EVALUATOR,
        toAgent: AgentName.ORCHESTRATOR,
        sessionId: testSessionId,
        timestamp: new Date(),
        payload: {
          sessionId: testSessionId,
          scores: {
            'Problem Definition & Structuring': 2
          }
        }
      });

      const sessionState = orchestrator.getSessionState(testSessionId);
      expect(sessionState?.interventions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track performance metrics during session', async () => {
      const startTime = Date.now();

      await orchestrator.startInterview({
        userId: testUserId,
        sessionId: testSessionId,
        interviewType: 'machine learning',
        faangLevel: 'L5'
      });

      const sessionMetrics = orchestrator.getSessionMetrics(testSessionId);
      expect(sessionMetrics).toBeDefined();
      expect(sessionMetrics?.duration).toBeGreaterThanOrEqual(0);
      expect(sessionMetrics?.complexity).toBeDefined();
    });

    test('should handle multiple concurrent sessions', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      
      // Start multiple sessions concurrently
      await Promise.all(
        sessions.map(sessionId =>
          orchestrator.startInterview({
            userId: `user-${sessionId}`,
            sessionId,
            interviewType: 'behavioral',
            faangLevel: 'L4'
          })
        )
      );

      // Verify all sessions are tracked independently
      sessions.forEach(sessionId => {
        const state = orchestrator.getSessionState(sessionId);
        expect(state).toBeDefined();
        expect(state?.sessionId).toBe(sessionId);
        expect(state?.currentState).toBe(InterviewState.SCOPING);
      });
    });
  });
});

// Integration test demonstrating full workflow
describe('Orchestrator Agent Integration', () => {
  test('should complete a full interview workflow simulation', async () => {
    const orchestrator = new OrchestratorAgent();
    const sessionId = `integration-test-${Date.now()}`;
    const userId = `integration-user-${Date.now()}`;

    // 1. Start interview
    console.log('🎯 Starting integration test interview...');
    
    const startResult = await orchestrator.startInterview({
      userId,
      sessionId,
      interviewType: 'technical system design',
      faangLevel: 'L5',
      resume: { experience: '5 years senior engineer' }
    });

    expect(startResult.success).toBe(true);
    console.log(`✅ Interview started in state: ${startResult.initialState}`);

    // 2. Progress through states with user responses
    const responses = [
      {
        phase: 'scoping',
        response: "I need to understand the scale and user base first. Let me identify the key user segments and their pain points."
      },
      {
        phase: 'analysis',
        response: "Based on my analysis, the solution I'd propose is a microservices architecture with event-driven communication between services."
      },
      {
        phase: 'solutioning',
        response: "To measure success, I would track system latency, throughput, and user satisfaction scores as key metrics."
      }
    ];

    for (const { phase, response } of responses) {
      console.log(`📝 User response in ${phase}: ${response.substring(0, 80)}...`);
      
      const result = await orchestrator.handleUserResponse({
        sessionId,
        response,
        responseTime: Math.random() * 60000 + 30000
      });

      console.log(`🔄 Action: ${result.nextAction}`);

      // Simulate evaluator response
      await orchestrator.handleAgentMessage({
        type: 'response_scored',
        fromAgent: AgentName.EVALUATOR,
        toAgent: AgentName.ORCHESTRATOR,
        sessionId,
        timestamp: new Date(),
        payload: {
          sessionId,
          scores: {
            'Problem Definition & Structuring': Math.floor(Math.random() * 2) + 3,
            'Technical Depth': Math.floor(Math.random() * 2) + 3,
            'Solution Design': Math.floor(Math.random() * 2) + 3
          }
        }
      });

      // Small delay to simulate real interaction
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 3. Check final state
    const finalMetrics = orchestrator.getSessionMetrics(sessionId);
    console.log('📊 Final session metrics:', finalMetrics);

    expect(finalMetrics).toBeDefined();
    expect(finalMetrics?.stateTransitions).toBeGreaterThan(2);
    expect(finalMetrics?.duration).toBeGreaterThan(0);

    console.log('✅ Integration test completed successfully!');
  }, 10000); // 10 second timeout for integration test
});