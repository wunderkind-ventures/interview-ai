"""
Configuration management for ADK agents.
Includes TypeScript-style config management patterns with feature flags and adaptive configuration.
"""

import os
import json
import hashlib
from enum import Enum
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr, BaseModel
import asyncio
import logging


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class AgentName(str, Enum):
    ORCHESTRATOR = "orchestrator"
    CONTEXT = "context"
    INTERVIEWER = "interviewer"
    EVALUATOR = "evaluator"
    SYNTHESIS = "synthesis"


class ComplexityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class ReasoningStrategy(str, Enum):
    STANDARD = "standard"
    COT = "chain_of_thought"
    STEP_BACK = "step_back"
    SELF_REFLECTION = "self_reflection"
    MULTI_AGENT = "multi_agent"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment
    environment: Environment = Field(
        default=Environment.DEVELOPMENT,
        description="Current environment"
    )
    
    # Google Cloud
    gcp_project_id: str = Field(
        default="wkv-interviewai-dev",
        description="Google Cloud Project ID"
    )
    gcp_region: str = Field(
        default="us-central1",
        description="Google Cloud Region"
    )
    
    # Firebase
    firebase_credentials_path: Optional[str] = Field(
        default=None,
        description="Path to Firebase service account credentials"
    )
    
    # AI Models
    vertex_ai_location: str = Field(
        default="us-central1",
        description="Vertex AI location"
    )
    default_model: str = Field(
        default="gemini-1.5-pro",
        description="Default AI model"
    )
    embedding_model: str = Field(
        default="text-embedding-004",
        description="Embedding model for RAG"
    )
    
    # Agent Configuration
    agent_timeout_seconds: int = Field(
        default=30,
        description="Default timeout for agent operations"
    )
    max_retries: int = Field(
        default=3,
        description="Maximum number of retries for agent operations"
    )
    
    # Telemetry
    enable_telemetry: bool = Field(
        default=True,
        description="Enable OpenTelemetry tracing"
    )
    otlp_endpoint: Optional[str] = Field(
        default=None,
        description="OpenTelemetry collector endpoint"
    )
    
    # API Configuration
    api_port: int = Field(
        default=8080,
        description="Port for API server"
    )
    api_host: str = Field(
        default="0.0.0.0",
        description="Host for API server"
    )
    
    # Feature Flags
    enable_adaptive_reasoning: bool = Field(
        default=True,
        description="Enable adaptive reasoning strategies"
    )
    enable_circuit_breaker: bool = Field(
        default=True,
        description="Enable circuit breaker pattern"
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Agent-specific configurations
AGENT_CONFIGS: Dict[AgentName, Dict[str, Any]] = {
    AgentName.ORCHESTRATOR: {
        "timeout_seconds": 60,
        "max_session_duration": 3600,  # 1 hour
        "state_transition_timeout": 300,  # 5 minutes
        "intervention_thresholds": {
            "silence_duration": 30,  # seconds
            "low_score_threshold": 0.4,
            "premature_solution_keywords": ["solution", "implement", "build"],
        },
    },
    AgentName.CONTEXT: {
        "timeout_seconds": 30,
        "max_resume_size_mb": 10,
        "supported_formats": [".pdf", ".docx", ".txt"],
        "extraction_confidence_threshold": 0.7,
    },
    AgentName.INTERVIEWER: {
        "timeout_seconds": 20,
        "question_complexity_levels": {
            "L3": {"min": 1, "max": 3},
            "L4": {"min": 2, "max": 4},
            "L5": {"min": 3, "max": 5},
            "L6": {"min": 4, "max": 5},
        },
        "follow_up_depth": 3,
    },
    AgentName.EVALUATOR: {
        "timeout_seconds": 25,
        "scoring_dimensions": [
            "problem_understanding",
            "solution_approach",
            "technical_depth",
            "communication_clarity",
            "scalability_consideration",
        ],
        "feedback_detail_level": "detailed",
    },
    AgentName.SYNTHESIS: {
        "timeout_seconds": 45,
        "report_sections": [
            "executive_summary",
            "detailed_performance",
            "strengths",
            "areas_for_improvement",
            "recommendations",
        ],
        "include_transcript": True,
    },
}


# Reasoning strategy configurations
REASONING_CONFIGS: Dict[ComplexityLevel, ReasoningStrategy] = {
    ComplexityLevel.LOW: ReasoningStrategy.STANDARD,
    ComplexityLevel.MEDIUM: ReasoningStrategy.COT,
    ComplexityLevel.HIGH: ReasoningStrategy.STEP_BACK,
    ComplexityLevel.VERY_HIGH: ReasoningStrategy.MULTI_AGENT,
}


# Circuit breaker configurations
CIRCUIT_BREAKER_CONFIG = {
    "failure_threshold": 5,
    "recovery_timeout": 60,  # seconds
    "expected_exception": Exception,
    "fallback_strategies": {
        AgentName.ORCHESTRATOR: "graceful_degradation",
        AgentName.CONTEXT: "cached_response",
        AgentName.INTERVIEWER: "template_question",
        AgentName.EVALUATOR: "basic_scoring",
        AgentName.SYNTHESIS: "simple_summary",
    },
}


# Load settings
settings = Settings()


def get_agent_config(agent_name: AgentName) -> Dict[str, Any]:
    """Get configuration for a specific agent."""
    base_config = AGENT_CONFIGS.get(agent_name, {})
    
    # Override with environment-specific settings
    if settings.environment == Environment.PRODUCTION:
        base_config["timeout_seconds"] = base_config.get("timeout_seconds", 30) * 2
        
    return base_config


def get_reasoning_strategy(complexity: ComplexityLevel) -> ReasoningStrategy:
    """Get appropriate reasoning strategy based on complexity."""
    if not settings.enable_adaptive_reasoning:
        return ReasoningStrategy.STANDARD
        
    return REASONING_CONFIGS.get(complexity, ReasoningStrategy.COT)


# TypeScript-style configuration management classes

class ModelConfig(BaseModel):
    """Model configuration."""
    provider: str = "Google"
    model_name: str = "gemini-1.5-pro-latest"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = 2048
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class RuntimeConfig(BaseModel):
    """Runtime configuration."""
    timeout: int = 30000  # milliseconds
    retries: int = 3
    max_concurrency: int = 5
    memory_limit: str = "1Gi"


class PromptsConfig(BaseModel):
    """Prompts configuration."""
    default_variant: str = "v1"
    fallback_variant: str = "fallback"
    ab_test_enabled: bool = False
    variants: List[str] = []
    traffic_split: List[float] = []


class MonitoringConfig(BaseModel):
    """Monitoring configuration."""
    metrics_enabled: bool = True
    tracing_enabled: bool = True
    log_level: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARN|ERROR)$")


class AgentConfig(BaseModel):
    """Complete agent configuration - matches TypeScript AgentConfig."""
    name: AgentName
    version: str = "1.0.0"
    
    runtime: RuntimeConfig = RuntimeConfig()
    model: ModelConfig = ModelConfig()
    prompts: PromptsConfig = PromptsConfig()
    monitoring: MonitoringConfig = MonitoringConfig()


class FeatureFlagTargeting(BaseModel):
    """Feature flag targeting configuration."""
    percentage: int = Field(default=0, ge=0, le=100)
    user_segments: Optional[List[str]] = None
    environment_filter: Optional[List[Environment]] = None


class FeatureFlagMetadata(BaseModel):
    """Feature flag metadata."""
    created_at: datetime
    created_by: str
    expires_at: Optional[datetime] = None


class FeatureFlag(BaseModel):
    """Feature flag definition - matches TypeScript FeatureFlag."""
    name: str
    description: str
    enabled: bool
    
    targeting: FeatureFlagTargeting = FeatureFlagTargeting()
    variants: Optional[Dict[str, Any]] = None
    metadata: FeatureFlagMetadata


class EvaluationContext(BaseModel):
    """Feature flag evaluation context."""
    user_id: str
    session_id: str
    environment: Environment
    user_segments: Optional[List[str]] = None
    agent_name: Optional[AgentName] = None


class EnvironmentApiConfig(BaseModel):
    """Environment API configuration."""
    base_url: str
    rate_limits: Dict[str, int] = {
        "requests_per_minute": 60,
        "requests_per_hour": 1000,
        "concurrent_sessions": 10
    }


class EnvironmentLLMConfig(BaseModel):
    """Environment LLM configuration."""
    default_model: str
    max_tokens_per_request: int = 4096
    cost_limits: Dict[str, float] = {
        "per_user": 1.00,
        "per_session": 0.50
    }


class EnvironmentSecurityConfig(BaseModel):
    """Environment security configuration."""
    encryption: Dict[str, Any] = {
        "enabled": True,
        "key_rotation_days": 90
    }
    data_retention: Dict[str, int] = {
        "user_data_days": 730,
        "logs_days": 90,
        "metrics_days": 365
    }


class EnvironmentConfig(BaseModel):
    """Environment-specific configuration - matches TypeScript EnvironmentConfig."""
    environment: Environment
    api: EnvironmentApiConfig
    llm: EnvironmentLLMConfig
    security: EnvironmentSecurityConfig


class ConfigManager:
    """
    Configuration Manager - matches TypeScript ConfigManager.
    Handles loading, caching, and dynamic updating of configurations.
    """
    
    def __init__(self, environment: Environment = Environment.DEVELOPMENT):
        self.environment = environment
        self.agent_configs: Dict[AgentName, AgentConfig] = {}
        self.feature_flags: Dict[str, FeatureFlag] = {}
        self.environment_config: Optional[EnvironmentConfig] = None
        self.last_update = datetime.now() - timedelta(days=1)  # Force initial load
        self.update_interval = timedelta(minutes=5)
        self.logger = logging.getLogger(__name__)
        
        # Start periodic updates
        self._start_periodic_updates()
    
    async def get_agent_config(self, agent_name: AgentName) -> AgentConfig:
        """Get agent configuration with environment and feature flag overrides."""
        await self._ensure_configs_loaded()
        
        config = self.agent_configs.get(agent_name)
        if not config:
            config = self._get_default_agent_config(agent_name)
            self.agent_configs[agent_name] = config
        
        # Apply environment-specific overrides
        env_config = await self.get_environment_config()
        config = self._apply_environment_overrides(config, env_config)
        
        # Apply feature flag overrides
        context = EvaluationContext(
            user_id="system",
            session_id="config",
            environment=self.environment,
            agent_name=agent_name
        )
        config = await self._apply_feature_flag_overrides(config, context)
        
        return config
    
    async def evaluate_feature_flag(
        self,
        flag_name: str,
        context: EvaluationContext
    ) -> Dict[str, Any]:
        """Evaluate feature flag for given context."""
        await self._ensure_configs_loaded()
        
        flag = self.feature_flags.get(flag_name)
        if not flag:
            return {"enabled": False}
        
        # Check if flag is globally enabled
        if not flag.enabled:
            return {"enabled": False, "variant": "control"}
        
        # Check expiration
        if flag.metadata.expires_at and flag.metadata.expires_at < datetime.now():
            return {"enabled": False, "variant": "expired"}
        
        # Check environment filter
        if (flag.targeting.environment_filter and 
            context.environment not in flag.targeting.environment_filter):
            return {"enabled": False, "variant": "environment_filtered"}
        
        # Check user segment targeting
        if flag.targeting.user_segments and context.user_segments:
            has_matching_segment = any(
                segment in context.user_segments
                for segment in flag.targeting.user_segments
            )
            if not has_matching_segment:
                return {"enabled": False, "variant": "segment_filtered"}
        
        # Check percentage rollout
        if not self._is_in_percentage_rollout(context.user_id, flag.targeting.percentage):
            return {"enabled": False, "variant": "percentage_filtered"}
        
        # Determine variant
        variant = self._select_variant(context.user_id, flag.variants)
        value = flag.variants.get(variant, True) if flag.variants else True
        
        return {"enabled": True, "variant": variant, "value": value}
    
    async def get_environment_config(self) -> EnvironmentConfig:
        """Get environment-specific configuration."""
        if not self.environment_config:
            self.environment_config = await self._load_environment_config()
        return self.environment_config
    
    async def get_adaptive_config(
        self,
        agent_name: AgentName,
        complexity: ComplexityLevel,
        system_load: float
    ) -> Dict[str, Any]:
        """Get adaptive configuration based on system performance."""
        base_config = await self.get_agent_config(agent_name)
        adaptations: List[str] = []
        
        # Adapt based on system load
        if system_load > 0.8:
            base_config.runtime.timeout = max(int(base_config.runtime.timeout * 0.7), 10000)
            base_config.model.max_tokens = max(int(base_config.model.max_tokens * 0.8), 1024)
            adaptations.append("reduced_timeout_and_tokens_due_to_high_load")
        
        # Adapt based on complexity
        if complexity == ComplexityLevel.LOW:
            base_config.model.temperature = min(base_config.model.temperature * 0.8, 0.5)
            adaptations.append("reduced_temperature_for_low_complexity")
        elif complexity == ComplexityLevel.HIGH:
            base_config.runtime.timeout = min(int(base_config.runtime.timeout * 1.5), 60000)
            base_config.model.max_tokens = min(int(base_config.model.max_tokens * 1.5), 8192)
            adaptations.append("increased_timeout_and_tokens_for_high_complexity")
        
        return {
            **base_config.dict(),
            "adaptations": adaptations
        }
    
    async def set_feature_flag(self, flag_name: str, flag_data: Dict[str, Any]) -> None:
        """Create or update feature flag."""
        flag = FeatureFlag(
            name=flag_name,
            description=flag_data.get("description", ""),
            enabled=flag_data.get("enabled", False),
            targeting=FeatureFlagTargeting(**flag_data.get("targeting", {})),
            variants=flag_data.get("variants"),
            metadata=FeatureFlagMetadata(
                created_at=datetime.now(),
                created_by=flag_data.get("created_by", "system"),
                expires_at=flag_data.get("expires_at")
            )
        )
        
        self.feature_flags[flag_name] = flag
        await self._persist_feature_flag(flag_name, flag)
        self.logger.info(f"Feature flag {flag_name} updated")
    
    # Private methods
    async def _ensure_configs_loaded(self) -> None:
        """Ensure configurations are loaded and up to date."""
        now = datetime.now()
        if now - self.last_update > self.update_interval:
            await self._load_all_configurations()
            self.last_update = now
    
    async def _load_all_configurations(self) -> None:
        """Load all configurations."""
        # Load agent configurations
        for agent_name in AgentName:
            if agent_name not in self.agent_configs:
                self.agent_configs[agent_name] = self._get_default_agent_config(agent_name)
        
        # Load feature flags
        await self._load_feature_flags()
        
        # Load environment config
        self.environment_config = await self._load_environment_config()
    
    def _get_default_agent_config(self, agent_name: AgentName) -> AgentConfig:
        """Get default configuration for an agent."""
        base_config = AgentConfig(name=agent_name)
        
        # Agent-specific customizations
        if agent_name == AgentName.EVALUATOR:
            base_config.runtime.timeout = 45000
            base_config.model.max_tokens = 4096
        elif agent_name == AgentName.CONTEXT:
            base_config.runtime.timeout = 20000
            base_config.model.max_tokens = 1024
        elif agent_name == AgentName.ORCHESTRATOR:
            base_config.runtime.timeout = 15000
            base_config.model.max_tokens = 512
        
        return base_config
    
    async def _load_feature_flags(self) -> None:
        """Load default feature flags."""
        default_flags = [
            {
                "name": "adaptive_reasoning",
                "description": "Enable adaptive reasoning complexity selection",
                "enabled": True,
                "targeting": {"percentage": 100}
            },
            {
                "name": "enhanced_telemetry", 
                "description": "Enable enhanced telemetry and monitoring",
                "enabled": True,
                "targeting": {"percentage": 50}
            },
            {
                "name": "circuit_breaker",
                "description": "Enable circuit breaker for agent resilience",
                "enabled": True,
                "targeting": {
                    "percentage": 100,
                    "environment_filter": [Environment.STAGING, Environment.PRODUCTION]
                }
            }
        ]
        
        for flag_data in default_flags:
            flag_name = flag_data["name"]
            if flag_name not in self.feature_flags:
                await self.set_feature_flag(flag_name, flag_data)
    
    async def _load_environment_config(self) -> EnvironmentConfig:
        """Load environment-specific configuration."""
        configs = {
            Environment.DEVELOPMENT: EnvironmentConfig(
                environment=Environment.DEVELOPMENT,
                api=EnvironmentApiConfig(
                    base_url="http://localhost:9002",
                    rate_limits={
                        "requests_per_minute": 120,
                        "requests_per_hour": 2000,
                        "concurrent_sessions": 20
                    }
                ),
                llm=EnvironmentLLMConfig(
                    default_model="gemini-1.5-pro-latest",
                    max_tokens_per_request=8192,
                    cost_limits={"per_user": 5.00, "per_session": 2.00}
                ),
                security=EnvironmentSecurityConfig(
                    encryption={"enabled": False, "key_rotation_days": 365},
                    data_retention={"user_data_days": 30, "logs_days": 7, "metrics_days": 30}
                )
            ),
            Environment.STAGING: EnvironmentConfig(
                environment=Environment.STAGING,
                api=EnvironmentApiConfig(
                    base_url="https://staging-api.interview-ai.com",
                    rate_limits={
                        "requests_per_minute": 100,
                        "requests_per_hour": 1500,
                        "concurrent_sessions": 15
                    }
                ),
                llm=EnvironmentLLMConfig(
                    default_model="gemini-1.5-pro-latest",
                    max_tokens_per_request=4096,
                    cost_limits={"per_user": 2.00, "per_session": 1.00}
                ),
                security=EnvironmentSecurityConfig()
            ),
            Environment.PRODUCTION: EnvironmentConfig(
                environment=Environment.PRODUCTION,
                api=EnvironmentApiConfig(
                    base_url="https://api.interview-ai.com",
                    rate_limits={
                        "requests_per_minute": 60,
                        "requests_per_hour": 1000,
                        "concurrent_sessions": 10
                    }
                ),
                llm=EnvironmentLLMConfig(
                    default_model="gemini-1.5-pro-latest",
                    max_tokens_per_request=4096,
                    cost_limits={"per_user": 1.00, "per_session": 0.50}
                ),
                security=EnvironmentSecurityConfig()
            )
        }
        
        return configs[self.environment]
    
    def _apply_environment_overrides(
        self,
        config: AgentConfig,
        env_config: EnvironmentConfig
    ) -> AgentConfig:
        """Apply environment-specific overrides."""
        config.model.model_name = env_config.llm.default_model
        config.model.max_tokens = min(
            config.model.max_tokens,
            env_config.llm.max_tokens_per_request
        )
        return config
    
    async def _apply_feature_flag_overrides(
        self,
        config: AgentConfig,
        context: EvaluationContext
    ) -> AgentConfig:
        """Apply feature flag-based configuration changes."""
        enhanced_telemetry = await self.evaluate_feature_flag("enhanced_telemetry", context)
        if not enhanced_telemetry["enabled"]:
            config.monitoring.tracing_enabled = False
        
        return config
    
    def _is_in_percentage_rollout(self, user_id: str, percentage: int) -> bool:
        """Check if user is in percentage rollout."""
        if percentage >= 100:
            return True
        if percentage <= 0:
            return False
        
        # Use consistent hash of user_id for deterministic rollout
        hash_value = self._hash_string(user_id)
        return (hash_value % 100) < percentage
    
    def _select_variant(self, user_id: str, variants: Optional[Dict[str, Any]]) -> str:
        """Select variant for user."""
        if not variants or not variants:
            return "default"
        
        variant_names = list(variants.keys())
        hash_value = self._hash_string(user_id)
        index = hash_value % len(variant_names)
        
        return variant_names[index]
    
    def _hash_string(self, s: str) -> int:
        """Hash string to integer."""
        return int(hashlib.md5(s.encode()).hexdigest(), 16)
    
    async def _persist_feature_flag(self, name: str, flag: FeatureFlag) -> None:
        """Persist feature flag to storage."""
        # In production, this would persist to database/file system
        self.logger.info(f"Persisting feature flag: {name}")
    
    def _start_periodic_updates(self) -> None:
        """Start periodic configuration updates."""
        # In a real implementation, this would use asyncio.create_task
        # with proper task management
        self.logger.info("Configuration manager initialized with periodic updates")


# Singleton instance
config_manager = ConfigManager(settings.environment)