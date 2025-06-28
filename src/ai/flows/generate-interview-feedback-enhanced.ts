/**
 * Enhanced Interview Feedback Generation with Telemetry
 * This is an enhanced version that demonstrates the integration of our
 * telemetry and monitoring system with existing flows.
 */

'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai as globalAi, getTechnologyBriefTool } from '@/ai/genkit';
import { z } from 'genkit';
import { refineInterviewFeedback } from './refine-interview-feedback';
import type { RefineInterviewFeedbackInput } from './refine-interview-feedback';
import { FeedbackItemSchema, GenerateInterviewFeedbackOutputSchema } from '../schemas';
import type { GenerateInterviewFeedbackOutput } from '../schemas';
import { analyzeTakeHomeSubmission } from './analyze-take-home-submission';
import type { AnalyzeTakeHomeSubmissionInput, AnalyzeTakeHomeSubmissionOutput } from '@/lib/types';
import { INTERVIEW_TYPES, FAANG_LEVELS, INTERVIEW_STYLES, SKILLS_BY_ROLE, RoleType as RoleTypeFromConstants } from '@/lib/constants';
import { loadPromptFile, renderPromptTemplate } from '../utils/promptUtils';

// Import our telemetry system
import {
  AgentName,
  ComplexityLevel,
  ReasoningStrategy,
  traceAgentOperation,
  recordAgentMetrics,
  recordComplexityAssessment,
  SessionTracker,
  calculateOperationCost,
  recordAgentError
} from '@/lib/telemetry';

// Enhanced input schema with telemetry context
const GenerateInterviewFeedbackInputSchema = z.object({
  // Existing fields...
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      idealAnswerCharacteristics: z.array(z.string()).optional(),
    })
  ),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answerText: z.string(),
      timeTakenMs: z.number().optional(),
      confidenceScore: z.number().min(1).max(5).optional(),
    })
  ),
  interviewType: z.enum(['product sense', 'technical system design', 'behavioral', 'machine learning', 'data structures & algorithms']),
  interviewStyle: z.enum(['simple-qa', 'case-study', 'take-home']),
  faangLevel: z.string(),
  roleType: z.custom<RoleTypeFromConstants>().optional(),
  targetedSkills: z.array(z.string()).optional(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  resume: z.string().optional(),
  interviewFocus: z.string().optional(),
  
  // New telemetry fields
  sessionId: z.string().describe("Unique identifier for the interview session"),
  userId: z.string().describe("Unique identifier for the user"),
});

export type GenerateInterviewFeedbackInputEnhanced = z.infer<typeof GenerateInterviewFeedbackInputSchema>;

/**
 * Enhanced Evaluator Agent simulation with telemetry
 */
class EvaluatorAgent {
  @traceAgentOperation('generate_feedback', AgentName.EVALUATOR)
  async generateFeedback(
    input: GenerateInterviewFeedbackInputEnhanced,
    options?: { apiKey?: string }
  ): Promise<GenerateInterviewFeedbackOutput> {
    const sessionTracker = new SessionTracker(input.sessionId, input.userId);
    const operationSpan = sessionTracker.createAgentOperationSpan(
      AgentName.EVALUATOR,
      'generate_feedback',
      {
        agentName: AgentName.EVALUATOR,
        agentVersion: '1.0.0',
        sessionId: input.sessionId,
        userId: input.userId,
        interviewPhase: 'feedback_generation'
      }
    );

    const startTime = Date.now();
    let tokensUsed = 0;
    let success = false;
    let fallbackUsed = false;

    try {
      // Assess complexity based on interview type and FAANG level
      const complexity = this.assessComplexity(input.interviewType, input.faangLevel);
      recordComplexityAssessment(complexity, AgentName.EVALUATOR);
      
      operationSpan.setAttributes({
        'evaluation.complexity': complexity,
        'evaluation.interview_type': input.interviewType,
        'evaluation.faang_level': input.faangLevel,
        'evaluation.questions_count': input.questions.length
      });

      // Select reasoning strategy based on complexity
      const reasoningStrategy = this.selectReasoningStrategy(complexity);
      operationSpan.setAttributes({
        'evaluation.reasoning_strategy': reasoningStrategy
      });

      let activeAI = globalAi;
      if (options?.apiKey) {
        try {
          activeAI = genkit({
            plugins: [googleAI({ apiKey: options.apiKey })],
          });
          operationSpan.setAttributes({ 'evaluation.byok': true });
        } catch (e) {
          console.warn(`Failed to initialize with API key: ${(e as Error).message}`);
          fallbackUsed = true;
          operationSpan.setAttributes({ 'evaluation.byok_fallback': true });
        }
      }

      // Process take-home assignments if needed
      let structuredTakeHomeAnalysis: AnalyzeTakeHomeSubmissionOutput | undefined;
      if (input.interviewStyle === 'take-home') {
        const takeHomeSpan = sessionTracker.createAgentOperationSpan(
          AgentName.EVALUATOR,
          'analyze_take_home'
        );
        
        try {
          structuredTakeHomeAnalysis = await this.analyzeTakeHome(input, options);
          takeHomeSpan.setAttributes({ 'take_home.analysis_success': true });
        } catch (error: any) {
          recordAgentError(AgentName.EVALUATOR, 'analyze_take_home', error);
          takeHomeSpan.setAttributes({ 'take_home.analysis_failed': true });
          throw error;
        } finally {
          takeHomeSpan.end();
        }
      }

      // Generate draft feedback with selected strategy
      const draftResult = await this.generateDraftFeedback(
        input,
        activeAI,
        reasoningStrategy,
        structuredTakeHomeAnalysis
      );
      
      tokensUsed += draftResult.tokensUsed || 0;
      operationSpan.setAttributes({
        'evaluation.draft_tokens': draftResult.tokensUsed || 0
      });

      // Refine feedback
      const refinedResult = await this.refineFeedback(
        draftResult.feedback,
        input,
        options
      );
      
      tokensUsed += refinedResult.tokensUsed || 0;
      operationSpan.setAttributes({
        'evaluation.refine_tokens': refinedResult.tokensUsed || 0,
        'evaluation.total_tokens': tokensUsed
      });

      success = true;
      return refinedResult.feedback;

    } catch (error: any) {
      recordAgentError(AgentName.EVALUATOR, 'generate_feedback', error, {
        sessionId: input.sessionId,
        interviewType: input.interviewType,
        questionsCount: input.questions.length
      });
      
      // Implement fallback strategy
      try {
        const fallbackResult = await this.getFallbackFeedback(input);
        fallbackUsed = true;
        success = true;
        return fallbackResult;
      } catch (fallbackError: any) {
        recordAgentError(AgentName.EVALUATOR, 'fallback_feedback', fallbackError);
        throw error; // Throw original error
      }
    } finally {
      const latency = Date.now() - startTime;
      const cost = calculateOperationCost(tokensUsed);

      // Record metrics
      recordAgentMetrics(AgentName.EVALUATOR, 'generate_feedback', {
        latency,
        tokensUsed,
        cost,
        success,
        fallbackUsed
      });

      operationSpan.setAttributes({
        'evaluation.latency_ms': latency,
        'evaluation.cost_usd': cost,
        'evaluation.success': success,
        'evaluation.fallback_used': fallbackUsed
      });

      operationSpan.end();
      sessionTracker.endSession(success ? 'completed' : 'failed');
    }
  }

  private assessComplexity(
    interviewType: string,
    faangLevel: string
  ): ComplexityLevel {
    // Complexity assessment logic
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

    const complexityScore = 
      (complexityFactors[interviewType] || 1.0) * 
      (levelFactors[faangLevel] || 1.0);

    if (complexityScore <= 0.9) return ComplexityLevel.LOW;
    if (complexityScore <= 1.2) return ComplexityLevel.MEDIUM;
    return ComplexityLevel.HIGH;
  }

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

  private async analyzeTakeHome(
    input: GenerateInterviewFeedbackInputEnhanced,
    options?: { apiKey?: string }
  ): Promise<AnalyzeTakeHomeSubmissionOutput> {
    if (!input.questions[0] || !input.answers[0]) {
      throw new Error("Take-home style interview requires at least one question and one answer.");
    }

    const takeHomeInput: AnalyzeTakeHomeSubmissionInput = {
      assignmentText: input.questions[0].text,
      userSubmissionText: input.answers[0].answerText,
      idealSubmissionCharacteristics: input.questions[0].idealAnswerCharacteristics || [],
      interviewContext: {
        interviewType: input.interviewType,
        faangLevel: input.faangLevel,
        jobTitle: input.jobTitle,
        interviewFocus: input.interviewFocus,
      }
    };

    return await analyzeTakeHomeSubmission(takeHomeInput, options);
  }

  private async generateDraftFeedback(
    input: GenerateInterviewFeedbackInputEnhanced,
    activeAI: any,
    strategy: ReasoningStrategy,
    takeHomeAnalysis?: AnalyzeTakeHomeSubmissionOutput
  ): Promise<{ feedback: GenerateInterviewFeedbackOutput; tokensUsed: number }> {
    // This would contain the actual implementation similar to the original
    // but with strategy-specific prompts and telemetry
    
    // For now, using simplified implementation
    const questionsAndAnswers = input.questions.map((q, index) => {
      const answer = input.answers.find(a => a.questionId === q.id);
      return {
        questionId: q.id,
        questionText: q.text,
        answerText: answer?.answerText || '[No answer provided]',
        timeTakenMs: answer?.timeTakenMs,
        indexPlusOne: index + 1,
        idealAnswerCharacteristics: q.idealAnswerCharacteristics || [],
        confidenceScore: answer?.confidenceScore,
      };
    });

    // Load strategy-specific prompt
    const promptTemplate = this.getPromptForStrategy(strategy);
    const renderedPrompt = renderPromptTemplate(promptTemplate, {
      interviewType: input.interviewType,
      faangLevel: input.faangLevel,
      questionsAndAnswers,
      strategy
    });

    const result = await activeAI.generate({
      prompt: renderedPrompt,
      model: googleAI.model('gemini-1.5-pro-latest'),
      tools: [getTechnologyBriefTool],
      config: { responseMimeType: "application/json" },
    });

    // Extract feedback from result and calculate tokens
    return {
      feedback: this.extractFeedbackFromResult(result, input),
      tokensUsed: result.usage?.totalTokens || 0
    };
  }

  private async refineFeedback(
    draftFeedback: GenerateInterviewFeedbackOutput,
    input: GenerateInterviewFeedbackInputEnhanced,
    options?: { apiKey?: string }
  ): Promise<{ feedback: GenerateInterviewFeedbackOutput; tokensUsed: number }> {
    const refineInput: RefineInterviewFeedbackInput = {
      draftFeedback,
      interviewContext: {
        interviewType: input.interviewType,
        interviewStyle: input.interviewStyle,
        faangLevel: input.faangLevel,
        jobTitle: input.jobTitle,
        interviewFocus: input.interviewFocus,
        timeWasTracked: input.answers.some(a => a.timeTakenMs !== undefined && a.timeTakenMs > 0),
      },
    };

    const refinedOutput = await refineInterviewFeedback(refineInput, options);
    
    return {
      feedback: refinedOutput,
      tokensUsed: 0 // Would be tracked in the refine function
    };
  }

  private async getFallbackFeedback(
    input: GenerateInterviewFeedbackInputEnhanced
  ): Promise<GenerateInterviewFeedbackOutput> {
    // Simple fallback feedback generation
    const feedbackItems = input.questions.map(question => {
      const answer = input.answers.find(a => a.questionId === question.id);
      return {
        questionId: question.id,
        questionText: question.text,
        answerText: answer?.answerText || 'N/A',
        critique: 'Feedback generation temporarily unavailable. Please try again later.',
        strengths: ['Response provided'],
        areasForImprovement: ['Unable to analyze at this time'],
        specificSuggestions: ['Please retry feedback generation'],
        idealAnswerPointers: ['Feedback system will be restored shortly'],
        reflectionPrompts: ['Consider reviewing your response while we restore full feedback capabilities'],
        timeTakenMs: answer?.timeTakenMs,
        confidenceScore: answer?.confidenceScore,
      };
    });

    return {
      overallSummary: 'We apologize, but detailed feedback generation is temporarily unavailable. Your responses have been saved and you can request feedback again shortly.',
      feedbackItems
    };
  }

  private getPromptForStrategy(strategy: ReasoningStrategy): string {
    // Return strategy-specific prompts
    const prompts = {
      [ReasoningStrategy.LEAN]: loadPromptFile("feedback-lean.prompt"),
      [ReasoningStrategy.COT]: loadPromptFile("feedback-cot.prompt"),
      [ReasoningStrategy.STEP_BACK]: loadPromptFile("feedback-step-back.prompt")
    };
    
    return prompts[strategy] || prompts[ReasoningStrategy.LEAN];
  }

  private extractFeedbackFromResult(
    result: any,
    input: GenerateInterviewFeedbackInputEnhanced
  ): GenerateInterviewFeedbackOutput {
    // Extract and transform the AI result into our feedback format
    // This is a simplified implementation
    return {
      overallSummary: result.output?.overallSummary || 'Feedback generated successfully',
      feedbackItems: result.output?.feedbackItems || []
    };
  }
}

// Export the enhanced function
export async function generateInterviewFeedbackEnhanced(
  input: GenerateInterviewFeedbackInputEnhanced,
  options?: { apiKey?: string }
): Promise<GenerateInterviewFeedbackOutput> {
  const evaluatorAgent = new EvaluatorAgent();
  return evaluatorAgent.generateFeedback(input, options);
}

export type { GenerateInterviewFeedbackInputEnhanced };