/**
 * Configuration Management Service
 * Centralized configuration management with feature flags and environment-specific settings
 */

import { z } from 'zod';
import { AgentName, ComplexityLevel, ReasoningStrategy } from './telemetry';

// Configuration Schemas
const AgentConfigSchema = z.object({
  name: z.nativeEnum(AgentName),
  version: z.string(),
  
  runtime: z.object({
    timeout: z.number().default(30000),
    retries: z.number().default(3),
    maxConcurrency: z.number().default(5),
    memoryLimit: z.string().default('1Gi')
  }),
  
  model: z.object({
    provider: z.enum(['Google', 'OpenAI', 'Anthropic']).default('Google'),
    modelName: z.string().default('gemini-1.5-pro-latest'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().default(2048),
    topP: z.number().min(0).max(1).optional()
  }),
  
  prompts: z.object({
    defaultVariant: z.string(),
    fallbackVariant: z.string(),
    abTestConfig: z.object({
      enabled: z.boolean().default(false),
      variants: z.array(z.string()).default([]),
      trafficSplit: z.array(z.number()).default([])
    }).optional()
  }),
  
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    tracingEnabled: z.boolean().default(true),
    logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO')
  })
});

const FeatureFlagSchema = z.object({
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  
  targeting: z.object({
    percentage: z.number().min(0).max(100).default(0),
    userSegments: z.array(z.string()).optional(),
    environmentFilter: z.array(z.enum(['development', 'staging', 'production'])).optional()
  }),
  
  variants: z.record(z.any()).optional(),
  
  metadata: z.object({
    createdAt: z.date(),
    createdBy: z.string(),
    expiresAt: z.date().optional()
  })
});

const EnvironmentConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  
  api: z.object({
    baseUrl: z.string().url(),
    rateLimits: z.object({
      requestsPerMinute: z.number().default(60),
      requestsPerHour: z.number().default(1000),
      concurrentSessions: z.number().default(10)
    })
  }),
  
  llm: z.object({
    defaultModel: z.string(),
    maxTokensPerRequest: z.number().default(4096),
    costLimits: z.object({
      perUser: z.number().default(1.00),
      perSession: z.number().default(0.50)
    })
  }),
  
  security: z.object({
    encryption: z.object({
      enabled: z.boolean().default(true),
      keyRotationDays: z.number().default(90)
    }),
    
    dataRetention: z.object({
      userDataDays: z.number().default(730),
      logsDays: z.number().default(90),
      metricsDays: z.number().default(365)
    })
  })
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

export interface EvaluationContext {
  userId: string;
  sessionId: string;
  environment: 'development' | 'staging' | 'production';
  userSegments?: string[];
  agentName?: AgentName;
}

/**
 * Configuration Manager
 * Handles loading, caching, and dynamic updating of configurations
 */
export class ConfigManager {
  private agentConfigs = new Map<AgentName, AgentConfig>();
  private featureFlags = new Map<string, FeatureFlag>();
  private environmentConfig: EnvironmentConfig | null = null;
  private lastUpdate: Date = new Date(0);
  private updateInterval = 300000; // 5 minutes

  constructor(
    private environment: 'development' | 'staging' | 'production' = 'development'
  ) {
    this.startPeriodicUpdates();
  }

  /**
   * Get agent configuration with environment and feature flag overrides
   */
  async getAgentConfig(agentName: AgentName): Promise<AgentConfig> {
    await this.ensureConfigsLoaded();
    
    let config = this.agentConfigs.get(agentName);
    if (!config) {
      config = this.getDefaultAgentConfig(agentName);
      this.agentConfigs.set(agentName, config);
    }

    // Apply environment-specific overrides
    const envConfig = await this.getEnvironmentConfig();
    config = this.applyEnvironmentOverrides(config, envConfig);

    // Apply feature flag overrides
    config = await this.applyFeatureFlagOverrides(config, {
      userId: 'system',
      sessionId: 'config',
      environment: this.environment,
      agentName
    });

    return config;
  }

  /**
   * Evaluate feature flag for given context
   */
  async evaluateFeatureFlag(
    flagName: string,
    context: EvaluationContext
  ): Promise<{ enabled: boolean; variant?: string; value?: any }> {
    await this.ensureConfigsLoaded();
    
    const flag = this.featureFlags.get(flagName);
    if (!flag) {
      return { enabled: false };
    }

    // Check if flag is globally enabled
    if (!flag.enabled) {
      return { enabled: false, variant: 'control' };
    }

    // Check expiration
    if (flag.metadata.expiresAt && flag.metadata.expiresAt < new Date()) {
      return { enabled: false, variant: 'expired' };
    }

    // Check environment filter
    if (flag.targeting.environmentFilter && 
        !flag.targeting.environmentFilter.includes(context.environment)) {
      return { enabled: false, variant: 'environment_filtered' };
    }

    // Check user segment targeting
    if (flag.targeting.userSegments && context.userSegments) {
      const hasMatchingSegment = flag.targeting.userSegments.some(segment =>
        context.userSegments!.includes(segment)
      );
      if (!hasMatchingSegment) {
        return { enabled: false, variant: 'segment_filtered' };
      }
    }

    // Check percentage rollout
    if (!this.isInPercentageRollout(context.userId, flag.targeting.percentage)) {
      return { enabled: false, variant: 'percentage_filtered' };
    }

    // Determine variant
    const variant = this.selectVariant(context.userId, flag.variants);
    const value = flag.variants ? flag.variants[variant] : true;

    return { enabled: true, variant, value };
  }

  /**
   * Get environment-specific configuration
   */
  async getEnvironmentConfig(): Promise<EnvironmentConfig> {
    if (!this.environmentConfig) {
      this.environmentConfig = await this.loadEnvironmentConfig();
    }
    return this.environmentConfig;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(agentName: AgentName, updates: Partial<AgentConfig>): Promise<void> {
    const currentConfig = await this.getAgentConfig(agentName);
    const updatedConfig = { ...currentConfig, ...updates };
    
    // Validate configuration
    const validatedConfig = AgentConfigSchema.parse(updatedConfig);
    
    // Apply with gradual rollout
    await this.gradualConfigRollout(agentName, validatedConfig);
    
    // Update cache
    this.agentConfigs.set(agentName, validatedConfig);
    
    console.log(`Updated configuration for agent ${agentName}`);
  }

  /**
   * Create or update feature flag
   */
  async setFeatureFlag(flagName: string, flag: Omit<FeatureFlag, 'metadata'>): Promise<void> {
    const completeFlag: FeatureFlag = {
      ...flag,
      metadata: {
        createdAt: new Date(),
        createdBy: 'system',
        ...flag.metadata
      }
    };

    // Validate flag
    const validatedFlag = FeatureFlagSchema.parse(completeFlag);
    
    // Store flag
    this.featureFlags.set(flagName, validatedFlag);
    
    // Persist to storage
    await this.persistFeatureFlag(flagName, validatedFlag);
    
    console.log(`Feature flag ${flagName} updated`);
  }

  /**
   * Get all feature flags and their current state
   */
  async getAllFeatureFlags(): Promise<Map<string, FeatureFlag & { status: string }>> {
    await this.ensureConfigsLoaded();
    
    const flagsWithStatus = new Map();
    
    for (const [name, flag] of this.featureFlags) {
      const status = this.getFlagStatus(flag);
      flagsWithStatus.set(name, { ...flag, status });
    }

    return flagsWithStatus;
  }

  /**
   * Adaptive configuration based on system performance
   */
  async getAdaptiveConfig(
    agentName: AgentName,
    complexity: ComplexityLevel,
    systemLoad: number
  ): Promise<AgentConfig & { adaptations: string[] }> {
    const baseConfig = await this.getAgentConfig(agentName);
    const adaptations: string[] = [];

    // Adapt based on system load
    if (systemLoad > 0.8) {
      baseConfig.runtime.timeout = Math.max(baseConfig.runtime.timeout * 0.7, 10000);
      baseConfig.model.maxTokens = Math.max(baseConfig.model.maxTokens * 0.8, 1024);
      adaptations.push('reduced_timeout_and_tokens_due_to_high_load');
    }

    // Adapt based on complexity
    switch (complexity) {
      case ComplexityLevel.LOW:
        baseConfig.model.temperature = Math.min(baseConfig.model.temperature * 0.8, 0.5);
        adaptations.push('reduced_temperature_for_low_complexity');
        break;
        
      case ComplexityLevel.HIGH:
        baseConfig.runtime.timeout = Math.min(baseConfig.runtime.timeout * 1.5, 60000);
        baseConfig.model.maxTokens = Math.min(baseConfig.model.maxTokens * 1.5, 8192);
        adaptations.push('increased_timeout_and_tokens_for_high_complexity');
        break;
    }

    return { ...baseConfig, adaptations };
  }

  // Private methods
  private async ensureConfigsLoaded(): Promise<void> {
    const now = new Date();
    if (now.getTime() - this.lastUpdate.getTime() > this.updateInterval) {
      await this.loadAllConfigurations();
      this.lastUpdate = now;
    }
  }

  private async loadAllConfigurations(): Promise<void> {
    // In production, this would load from database/external service
    // For now, using defaults and local storage

    // Load agent configurations
    for (const agentName of Object.values(AgentName)) {
      if (!this.agentConfigs.has(agentName)) {
        this.agentConfigs.set(agentName, this.getDefaultAgentConfig(agentName));
      }
    }

    // Load feature flags
    await this.loadFeatureFlags();

    // Load environment config
    this.environmentConfig = await this.loadEnvironmentConfig();
  }

  private getDefaultAgentConfig(agentName: AgentName): AgentConfig {
    const baseConfig = {
      name: agentName,
      version: '1.0.0',
      
      runtime: {
        timeout: 30000,
        retries: 3,
        maxConcurrency: 5,
        memoryLimit: '1Gi'
      },
      
      model: {
        provider: 'Google' as const,
        modelName: 'gemini-1.5-pro-latest',
        temperature: 0.7,
        maxTokens: 2048
      },
      
      prompts: {
        defaultVariant: 'v1',
        fallbackVariant: 'fallback'
      },
      
      monitoring: {
        metricsEnabled: true,
        tracingEnabled: true,
        logLevel: 'INFO' as const
      }
    };

    // Agent-specific customizations
    switch (agentName) {
      case AgentName.EVALUATOR:
        baseConfig.runtime.timeout = 45000;
        baseConfig.model.maxTokens = 4096;
        break;
        
      case AgentName.CONTEXT:
        baseConfig.runtime.timeout = 20000;
        baseConfig.model.maxTokens = 1024;
        break;
        
      case AgentName.ORCHESTRATOR:
        baseConfig.runtime.timeout = 15000;
        baseConfig.model.maxTokens = 512;
        break;
    }

    return baseConfig;
  }

  private async loadFeatureFlags(): Promise<void> {
    // Load default feature flags
    const defaultFlags = [
      {
        name: 'adaptive_reasoning',
        description: 'Enable adaptive reasoning complexity selection',
        enabled: true,
        targeting: { percentage: 100 }
      },
      {
        name: 'enhanced_telemetry',
        description: 'Enable enhanced telemetry and monitoring',
        enabled: true,
        targeting: { percentage: 50 }
      },
      {
        name: 'circuit_breaker',
        description: 'Enable circuit breaker for agent resilience',
        enabled: true,
        targeting: { percentage: 100, environmentFilter: ['staging', 'production'] }
      }
    ];

    for (const flag of defaultFlags) {
      if (!this.featureFlags.has(flag.name)) {
        this.featureFlags.set(flag.name, {
          ...flag,
          metadata: {
            createdAt: new Date(),
            createdBy: 'system'
          }
        });
      }
    }
  }

  private async loadEnvironmentConfig(): Promise<EnvironmentConfig> {
    const configs = {
      development: {
        environment: 'development' as const,
        api: {
          baseUrl: 'http://localhost:9002',
          rateLimits: {
            requestsPerMinute: 120,
            requestsPerHour: 2000,
            concurrentSessions: 20
          }
        },
        llm: {
          defaultModel: 'gemini-1.5-pro-latest',
          maxTokensPerRequest: 8192,
          costLimits: {
            perUser: 5.00,
            perSession: 2.00
          }
        },
        security: {
          encryption: { enabled: false, keyRotationDays: 365 },
          dataRetention: { userDataDays: 30, logsDays: 7, metricsDays: 30 }
        }
      },
      
      staging: {
        environment: 'staging' as const,
        api: {
          baseUrl: 'https://staging-api.interview-ai.com',
          rateLimits: {
            requestsPerMinute: 100,
            requestsPerHour: 1500,
            concurrentSessions: 15
          }
        },
        llm: {
          defaultModel: 'gemini-1.5-pro-latest',
          maxTokensPerRequest: 4096,
          costLimits: {
            perUser: 2.00,
            perSession: 1.00
          }
        },
        security: {
          encryption: { enabled: true, keyRotationDays: 90 },
          dataRetention: { userDataDays: 365, logsDays: 30, metricsDays: 180 }
        }
      },
      
      production: {
        environment: 'production' as const,
        api: {
          baseUrl: 'https://api.interview-ai.com',
          rateLimits: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            concurrentSessions: 10
          }
        },
        llm: {
          defaultModel: 'gemini-1.5-pro-latest',
          maxTokensPerRequest: 4096,
          costLimits: {
            perUser: 1.00,
            perSession: 0.50
          }
        },
        security: {
          encryption: { enabled: true, keyRotationDays: 90 },
          dataRetention: { userDataDays: 730, logsDays: 90, metricsDays: 365 }
        }
      }
    };

    return configs[this.environment];
  }

  private applyEnvironmentOverrides(config: AgentConfig, envConfig: EnvironmentConfig): AgentConfig {
    return {
      ...config,
      model: {
        ...config.model,
        modelName: envConfig.llm.defaultModel,
        maxTokens: Math.min(config.model.maxTokens, envConfig.llm.maxTokensPerRequest)
      }
    };
  }

  private async applyFeatureFlagOverrides(
    config: AgentConfig,
    context: EvaluationContext
  ): Promise<AgentConfig> {
    // Apply feature flag-based configuration changes
    const enhancedTelemetry = await this.evaluateFeatureFlag('enhanced_telemetry', context);
    if (!enhancedTelemetry.enabled) {
      config.monitoring.tracingEnabled = false;
    }

    return config;
  }

  private isInPercentageRollout(userId: string, percentage: number): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    // Use consistent hash of userId for deterministic rollout
    const hash = this.hashString(userId);
    return (hash % 100) < percentage;
  }

  private selectVariant(userId: string, variants?: Record<string, any>): string {
    if (!variants || Object.keys(variants).length === 0) {
      return 'default';
    }

    const variantNames = Object.keys(variants);
    const hash = this.hashString(userId);
    const index = hash % variantNames.length;
    
    return variantNames[index];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getFlagStatus(flag: FeatureFlag): string {
    if (!flag.enabled) return 'disabled';
    if (flag.metadata.expiresAt && flag.metadata.expiresAt < new Date()) return 'expired';
    if (flag.targeting.percentage < 100) return `rollout_${flag.targeting.percentage}%`;
    return 'enabled';
  }

  private async gradualConfigRollout(agentName: AgentName, config: AgentConfig): Promise<void> {
    // Implement gradual rollout logic
    console.log(`Gradually rolling out config for ${agentName}`);
  }

  private async persistFeatureFlag(name: string, flag: FeatureFlag): Promise<void> {
    // Persist to storage (database, file system, etc.)
    console.log(`Persisting feature flag: ${name}`);
  }

  private startPeriodicUpdates(): void {
    setInterval(async () => {
      try {
        await this.loadAllConfigurations();
      } catch (error) {
        console.error('Failed to update configurations:', error);
      }
    }, this.updateInterval);
  }
}

// Singleton instance
export const configManager = new ConfigManager(
  (process.env.NODE_ENV as any) || 'development'
);

export default configManager;