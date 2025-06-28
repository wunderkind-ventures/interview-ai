/**
 * Circuit Breaker implementation for agent error handling and fallback strategies
 * Provides resilience patterns for multi-agent system reliability
 */

import { recordAgentError, AgentName } from './telemetry';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, calls fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  resetTimeout: number;        // Time to wait before trying half-open (ms)
  halfOpenRequests: number;    // Number of requests to test in half-open
  monitoringWindow: number;    // Time window for failure counting (ms)
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successRequests: number;
  failureRequests: number;
  timeouts: number;
  circuitOpenTime?: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCount: number = 0;
  private metrics: CircuitBreakerMetrics;
  private failureWindow: number[] = [];

  constructor(
    private name: string,
    private agentName: AgentName,
    private config: CircuitBreakerConfig
  ) {
    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failureRequests: 0,
      timeouts: 0,
      consecutiveFailures: 0
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
    timeout?: number
  ): Promise<T> {
    this.metrics.totalRequests++;

    // Fail fast if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCount = 0;
      } else {
        console.log(`Circuit breaker ${this.name} is OPEN - using fallback`);
        return this.executeFallback(fallback);
      }
    }

    try {
      const result = timeout 
        ? await this.executeWithTimeout(operation, timeout)
        : await operation();

      this.onSuccess();
      return result;

    } catch (error: any) {
      this.onFailure(error);

      // In half-open state, fall back immediately on failure
      if (this.state === CircuitState.OPEN) {
        return this.executeFallback(fallback);
      }

      throw error;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeFallback<T>(fallback: () => T | Promise<T>): Promise<T> {
    try {
      return await fallback();
    } catch (fallbackError: any) {
      recordAgentError(this.agentName, 'fallback_execution', fallbackError, {
        circuitBreakerName: this.name,
        circuitState: this.state
      });
      throw new Error(`Both primary operation and fallback failed: ${fallbackError.message}`);
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.metrics.successRequests++;
    this.metrics.consecutiveFailures = 0;
    this.cleanFailureWindow();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCount++;
      
      if (this.halfOpenCount >= this.config.halfOpenRequests) {
        this.reset();
      }
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.metrics.failureRequests++;
    this.metrics.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.failureWindow.push(this.lastFailureTime);

    recordAgentError(this.agentName, 'circuit_breaker_failure', error, {
      circuitBreakerName: this.name,
      consecutiveFailures: this.metrics.consecutiveFailures,
      circuitState: this.state
    });

    this.cleanFailureWindow();

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.openCircuit();
    }
  }

  private shouldOpenCircuit(): boolean {
    // Open if we have too many failures in the monitoring window
    const recentFailures = this.failureWindow.length;
    const consecutiveFailures = this.metrics.consecutiveFailures;

    return (
      consecutiveFailures >= this.config.failureThreshold ||
      recentFailures >= this.config.failureThreshold
    );
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.metrics.circuitOpenTime = Date.now();
    this.halfOpenCount = 0;

    console.warn(`Circuit breaker ${this.name} opened due to failures`, {
      consecutiveFailures: this.metrics.consecutiveFailures,
      recentFailures: this.failureWindow.length,
      agentName: this.agentName
    });
  }

  private shouldAttemptReset(): boolean {
    const timeSinceOpen = Date.now() - (this.metrics.circuitOpenTime || 0);
    return timeSinceOpen >= this.config.resetTimeout;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenCount = 0;
    this.failureWindow = [];
    this.metrics.consecutiveFailures = 0;
    delete this.metrics.circuitOpenTime;

    console.info(`Circuit breaker ${this.name} reset to CLOSED state`);
  }

  private cleanFailureWindow(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureWindow = this.failureWindow.filter(time => time > cutoff);
  }

  // Public methods for monitoring
  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics & { 
    state: CircuitState;
    recentFailures: number;
    failureRate: number;
  } {
    const totalInWindow = this.metrics.totalRequests > 0 ? this.metrics.totalRequests : 1;
    
    return {
      ...this.metrics,
      state: this.state,
      recentFailures: this.failureWindow.length,
      failureRate: this.metrics.failureRequests / totalInWindow
    };
  }

  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.metrics.circuitOpenTime = Date.now();
    console.warn(`Circuit breaker ${this.name} manually forced open`);
  }

  forceClose(): void {
    this.reset();
    console.info(`Circuit breaker ${this.name} manually forced closed`);
  }
}

/**
 * Circuit Breaker Manager for all agents
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenRequests: 3,
    monitoringWindow: 300000 // 5 minutes
  };

  getCircuitBreaker(
    agentName: AgentName,
    operation: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const key = `${agentName}-${operation}`;
    
    if (!this.breakers.has(key)) {
      const breakerConfig = { ...this.defaultConfig, ...config };
      const breaker = new CircuitBreaker(key, agentName, breakerConfig);
      this.breakers.set(key, breaker);
    }

    return this.breakers.get(key)!;
  }

  getAllMetrics(): Map<string, any> {
    const allMetrics = new Map();
    
    for (const [key, breaker] of this.breakers) {
      allMetrics.set(key, breaker.getMetrics());
    }

    return allMetrics;
  }

  getHealthSummary(): {
    healthy: string[];
    degraded: string[];
    failed: string[];
  } {
    const summary = {
      healthy: [] as string[],
      degraded: [] as string[],
      failed: [] as string[]
    };

    for (const [key, breaker] of this.breakers) {
      const metrics = breaker.getMetrics();
      
      if (metrics.state === CircuitState.OPEN) {
        summary.failed.push(key);
      } else if (metrics.state === CircuitState.HALF_OPEN || metrics.failureRate > 0.1) {
        summary.degraded.push(key);
      } else {
        summary.healthy.push(key);
      }
    }

    return summary;
  }

  // Emergency controls
  openAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceOpen();
    }
  }

  closeAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
  }
}

// Singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Decorator for automatic circuit breaker protection
 */
export function withCircuitBreaker(
  agentName: AgentName,
  operation: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(
        agentName,
        operation,
        config
      );

      // Define fallback function (should be customized per use case)
      const fallback = () => {
        throw new Error(`Service ${agentName} is temporarily unavailable`);
      };

      return circuitBreaker.execute(
        () => originalMethod.apply(this, args),
        fallback,
        config?.resetTimeout
      );
    };

    return descriptor;
  };
}

export default {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  withCircuitBreaker,
  CircuitState
};