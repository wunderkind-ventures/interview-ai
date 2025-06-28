/**
 * Automated Testing Framework for AI Agents
 * Provides comprehensive testing infrastructure for prompt evolution and agent performance
 */

import { z } from 'zod';
import { AgentName, ComplexityLevel, recordAgentMetrics, calculateOperationCost } from '@/lib/telemetry';

// Test Data Schemas
export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  category: z.enum(['unit', 'integration', 'e2e', 'performance', 'adversarial']),
  
  input: z.any(),
  expectedOutput: z.any().optional(),
  validationRules: z.array(z.object({
    type: z.enum(['exact_match', 'fuzzy_match', 'schema_match', 'custom_rule']),
    threshold: z.number().optional(),
    validator: z.function().optional()
  })).optional(),
  
  timeout: z.number().default(30000),
  retries: z.number().default(0),
  
  metadata: z.object({
    createdAt: z.date(),
    createdBy: z.string(),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
  })
});

export const TestSuiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agentName: z.nativeEnum(AgentName),
  
  testCases: z.array(TestCaseSchema),
  
  configuration: z.object({
    parallel: z.boolean().default(false),
    maxConcurrency: z.number().default(5),
    stopOnFirstFailure: z.boolean().default(false),
    reportFormat: z.enum(['json', 'html', 'markdown']).default('json')
  })
});

export const TestResultSchema = z.object({
  testCaseId: z.string(),
  passed: z.boolean(),
  
  performance: z.object({
    latency: z.number(),
    tokensUsed: z.number(),
    cost: z.number()
  }),
  
  accuracy: z.object({
    score: z.number().min(0).max(1),
    errors: z.array(z.string())
  }).optional(),
  
  output: z.any().optional(),
  error: z.string().optional(),
  errorType: z.string().optional(),
  
  metadata: z.object({
    startTime: z.date(),
    endTime: z.date(),
    environment: z.string(),
    agentVersion: z.string()
  })
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Agent Test Harness - Executes tests against individual agents
 */
export class AgentTestHarness {
  constructor(
    private agentName: AgentName,
    private agentFunction: Function,
    private config: {
      timeout: number;
      retries: number;
      recordMetrics: boolean;
    } = {
      timeout: 30000,
      retries: 3,
      recordMetrics: true
    }
  ) {}

  async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = new Date();
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= this.config.retries) {
      attempts++;
      
      try {
        const result = await this.executeTestCase(testCase, startTime);
        
        if (this.config.recordMetrics) {
          recordAgentMetrics(this.agentName, 'test_execution', {
            latency: result.performance.latency,
            tokensUsed: result.performance.tokensUsed,
            cost: result.performance.cost,
            success: result.passed
          });
        }

        return result;

      } catch (error: any) {
        lastError = error;
        
        if (attempts <= this.config.retries) {
          console.warn(`Test ${testCase.id} failed, retrying (attempt ${attempts}/${this.config.retries + 1})`);
          await this.delay(Math.pow(2, attempts) * 1000); // Exponential backoff
        }
      }
    }

    // All retries exhausted
    return {
      testCaseId: testCase.id,
      passed: false,
      performance: {
        latency: Date.now() - startTime.getTime(),
        tokensUsed: 0,
        cost: 0
      },
      error: lastError?.message || 'Unknown error',
      errorType: lastError?.constructor.name || 'UnknownError',
      metadata: {
        startTime,
        endTime: new Date(),
        environment: process.env.NODE_ENV || 'development',
        agentVersion: '1.0.0'
      }
    };
  }

  private async executeTestCase(testCase: TestCase, startTime: Date): Promise<TestResult> {
    const timeoutMs = testCase.timeout || this.config.timeout;
    
    // Execute with timeout
    const executionPromise = this.agentFunction(testCase.input);
    const timeoutPromise = this.createTimeout(timeoutMs);
    
    const executionStart = Date.now();
    const output = await Promise.race([executionPromise, timeoutPromise]);
    const latency = Date.now() - executionStart;

    // Validate output
    const validation = await this.validateOutput(
      output,
      testCase.expectedOutput,
      testCase.validationRules || []
    );

    // Calculate metrics
    const tokensUsed = this.extractTokenUsage(output);
    const cost = calculateOperationCost(tokensUsed);

    return {
      testCaseId: testCase.id,
      passed: validation.passed,
      
      performance: {
        latency,
        tokensUsed,
        cost
      },
      
      accuracy: {
        score: validation.score,
        errors: validation.errors
      },
      
      output,
      
      metadata: {
        startTime,
        endTime: new Date(),
        environment: process.env.NODE_ENV || 'development',
        agentVersion: '1.0.0'
      }
    };
  }

  private async validateOutput(
    actual: any,
    expected: any,
    rules: TestCase['validationRules']
  ): Promise<{ passed: boolean; score: number; errors: string[] }> {
    if (!rules || rules.length === 0) {
      // Default validation - exact match
      const passed = JSON.stringify(actual) === JSON.stringify(expected);
      return {
        passed,
        score: passed ? 1 : 0,
        errors: passed ? [] : ['Output does not match expected result']
      };
    }

    const results: boolean[] = [];
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        let ruleResult = false;

        switch (rule.type) {
          case 'exact_match':
            ruleResult = JSON.stringify(actual) === JSON.stringify(expected);
            break;
            
          case 'fuzzy_match':
            ruleResult = this.calculateSimilarity(actual, expected) >= (rule.threshold || 0.8);
            break;
            
          case 'schema_match':
            ruleResult = this.validateSchema(actual, expected);
            break;
            
          case 'custom_rule':
            if (rule.validator) {
              ruleResult = await rule.validator(actual, expected);
            }
            break;
        }

        results.push(ruleResult);
        
        if (!ruleResult) {
          errors.push(`Validation rule '${rule.type}' failed`);
        }

      } catch (error: any) {
        results.push(false);
        errors.push(`Validation rule '${rule.type}' threw error: ${error.message}`);
      }
    }

    const score = results.filter(r => r).length / results.length;
    const passed = score >= 0.8; // 80% of rules must pass

    return { passed, score, errors };
  }

  private calculateSimilarity(a: any, b: any): number {
    // Simple string similarity for now
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    
    const longer = strA.length > strB.length ? strA : strB;
    const shorter = strA.length > strB.length ? strB : strA;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private validateSchema(actual: any, schema: any): boolean {
    // Basic schema validation - can be extended with libraries like Zod
    try {
      if (typeof schema === 'object' && schema !== null) {
        for (const key in schema) {
          if (!(key in actual)) return false;
          if (typeof actual[key] !== typeof schema[key]) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private extractTokenUsage(output: any): number {
    // Extract token usage from various output formats
    if (typeof output === 'object' && output !== null) {
      return output.tokensUsed || output.usage?.totalTokens || 0;
    }
    return 0;
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Test Suite Runner - Orchestrates multiple test cases
 */
export class TestSuiteRunner {
  constructor(private config: {
    maxConcurrency: number;
    stopOnFirstFailure: boolean;
    reportFormat: 'json' | 'html' | 'markdown';
  } = {
    maxConcurrency: 5,
    stopOnFirstFailure: false,
    reportFormat: 'json'
  }) {}

  async runSuite(testSuite: TestSuite, agentFunction: Function): Promise<{
    results: TestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      passRate: number;
      avgLatency: number;
      totalCost: number;
    };
  }> {
    const harness = new AgentTestHarness(testSuite.agentName, agentFunction);
    const results: TestResult[] = [];

    if (testSuite.configuration.parallel) {
      // Run tests in parallel with concurrency limit
      const batches = this.createBatches(
        testSuite.testCases,
        this.config.maxConcurrency
      );

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(testCase => harness.runTest(testCase))
        );
        
        results.push(...batchResults);

        // Check for early termination
        if (this.config.stopOnFirstFailure && batchResults.some(r => !r.passed)) {
          break;
        }
      }
    } else {
      // Run tests sequentially
      for (const testCase of testSuite.testCases) {
        const result = await harness.runTest(testCase);
        results.push(result);

        if (this.config.stopOnFirstFailure && !result.passed) {
          break;
        }
      }
    }

    const summary = this.calculateSummary(results);
    return { results, summary };
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private calculateSummary(results: TestResult[]) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? passed / total : 0;
    
    const avgLatency = results.reduce((sum, r) => sum + r.performance.latency, 0) / total;
    const totalCost = results.reduce((sum, r) => sum + r.performance.cost, 0);

    return {
      total,
      passed,
      failed,
      passRate,
      avgLatency,
      totalCost
    };
  }
}

/**
 * Golden Set Repository - Manages test data
 */
export class GoldenSetRepository {
  private testData = new Map<string, TestCase[]>();

  async loadGoldenSet(agentName: AgentName, complexity: ComplexityLevel): Promise<TestCase[]> {
    const key = `${agentName}-${complexity}`;
    
    if (!this.testData.has(key)) {
      const testCases = await this.loadTestCasesFromFile(agentName, complexity);
      this.testData.set(key, testCases);
    }

    return this.testData.get(key) || [];
  }

  private async loadTestCasesFromFile(
    agentName: AgentName,
    complexity: ComplexityLevel
  ): Promise<TestCase[]> {
    // Load test cases from files or database
    // For now, return sample data
    return [
      {
        id: `${agentName}-${complexity}-001`,
        name: `Sample ${complexity} test for ${agentName}`,
        description: `Test case for ${agentName} agent with ${complexity} complexity`,
        complexity,
        category: 'unit',
        input: { test: 'data' },
        expectedOutput: { result: 'expected' },
        timeout: 30000,
        retries: 0,
        metadata: {
          createdAt: new Date(),
          createdBy: 'system',
          priority: 'medium'
        }
      }
    ];
  }

  async saveTestCase(testCase: TestCase): Promise<void> {
    // Save test case to persistent storage
    console.log('Saving test case:', testCase.id);
  }

  async getTestCasesByCategory(category: TestCase['category']): Promise<TestCase[]> {
    const allTests: TestCase[] = [];
    for (const tests of this.testData.values()) {
      allTests.push(...tests.filter(t => t.category === category));
    }
    return allTests;
  }
}

// Export singleton instances
export const goldenSetRepository = new GoldenSetRepository();
export const testSuiteRunner = new TestSuiteRunner();

export default {
  AgentTestHarness,
  TestSuiteRunner,
  GoldenSetRepository,
  goldenSetRepository,
  testSuiteRunner
};