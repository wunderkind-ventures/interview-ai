"""OpenTelemetry instrumentation for ADK agents."""

import os
import time
import logging
from typing import Dict, Any, Optional, Callable
from functools import wraps
from contextlib import contextmanager

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.exporter.cloud_monitoring import CloudMonitoringMetricsExporter as GoogleCloudMonitoringMetricsExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.grpc import GrpcInstrumentorClient
from opentelemetry.trace import Status, StatusCode
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry import trace

from .config import settings, AgentName, ComplexityLevel

# Setup logging
logger = logging.getLogger(__name__)

# Initialize telemetry
def init_telemetry():
    """Initialize OpenTelemetry tracing and metrics."""
    if not settings.enable_telemetry:
        logger.info("Telemetry disabled by configuration")
        return
    
    try:
        # Setup tracing
        trace_provider = TracerProvider()
        trace.set_tracer_provider(trace_provider)
        
        # Setup GCP trace exporter
        cloud_trace_exporter = CloudTraceSpanExporter(
            project_id=settings.gcp_project_id
        )
        trace_provider.add_span_processor(
            BatchSpanProcessor(cloud_trace_exporter)
        )
        
        # Setup metrics
        metrics_exporter = GoogleCloudMonitoringMetricsExporter(
            project_id=settings.gcp_project_id
        )
        metrics_reader = PeriodicExportingMetricReader(
            exporter=metrics_exporter,
            export_interval_millis=30000  # Export every 30 seconds
        )
        metrics_provider = MeterProvider(metric_readers=[metrics_reader])
        metrics.set_meter_provider(metrics_provider)
        
        # Auto-instrument common libraries
        RequestsInstrumentor().instrument()
        GrpcInstrumentorClient().instrument()
        
        logger.info("OpenTelemetry initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize telemetry: {e}")


# Get tracer and meter
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# Create metrics matching TypeScript patterns
class AgentMetrics:
    """Agent metrics container matching TypeScript implementation."""
    
    def __init__(self, meter):
        # Performance metrics
        self.agent_latency = meter.create_histogram(
            name="agent_latency_ms",
            description="Latency of agent operations in milliseconds",
            unit="ms"
        )
        
        self.token_usage = meter.create_counter(
            name="agent_token_usage",
            description="Number of tokens used by agent operations"
        )
        
        self.operation_success = meter.create_counter(
            name="agent_operation_success",
            description="Number of successful agent operations"
        )
        
        self.operation_failure = meter.create_counter(
            name="agent_operation_failure",
            description="Number of failed agent operations"
        )
        
        # Business metrics
        self.complexity_distribution = meter.create_counter(
            name="complexity_assessment",
            description="Distribution of complexity assessments"
        )
        
        self.state_transitions = meter.create_counter(
            name="state_transitions",
            description="Number of state transitions by type"
        )
        
        self.fallback_usage = meter.create_counter(
            name="fallback_usage",
            description="Number of times fallback strategies were used"
        )
        
        # Cost metrics
        self.operation_cost = meter.create_histogram(
            name="operation_cost_usd",
            description="Cost of operations in USD",
            unit="USD"
        )
        
        # Additional metrics for Python agents
        self.prompt_variant_usage = meter.create_counter(
            name="prompt_variant_usage",
            description="Usage count by prompt variant"
        )
        
        self.reasoning_strategy_distribution = meter.create_counter(
            name="reasoning_strategy_distribution", 
            description="Distribution of reasoning strategies used"
        )

# Global metrics instance
agent_metrics = AgentMetrics(meter)


class SessionTracker:
    """Track metrics for an agent session - matches TypeScript SessionTracker."""
    
    def __init__(self, session_id: str, user_id: str):
        self.session_id = session_id
        self.user_id = user_id
        self.start_time = time.time()
        self.operations: Dict[str, Any] = {}
        self.total_tokens = 0
        self.total_cost = 0.0
        self.session_span = tracer.start_span(
            'interview_session',
            attributes={
                'session.id': session_id,
                'user.id': user_id,
                'session.type': 'interview'
            }
        )
        
    def record_operation(
        self,
        operation_name: str,
        agent_name: AgentName,
        duration: float,
        success: bool = True,
        **kwargs
    ):
        """Record an agent operation using global metrics."""
        attributes = {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "agent_name": agent_name.value,
            "operation": operation_name
        }
        
        # Record using global metrics
        agent_metrics.agent_latency.record(duration, attributes=attributes)
        
        if success:
            agent_metrics.operation_success.add(1, attributes=attributes)
        else:
            agent_metrics.operation_failure.add(1, attributes={
                **attributes,
                "error_type": kwargs.get("error", "unknown")
            })
        
        # Store operation details
        self.operations[f"{agent_name.value}_{operation_name}"] = {
            "duration": duration,
            "success": success,
            "timestamp": time.time(),
            **kwargs
        }
    
    def record_token_usage(self, tokens: int, model: str, operation: str):
        """Record token usage using global metrics."""
        self.total_tokens += tokens
        agent_metrics.token_usage.add(
            tokens,
            attributes={
                "session_id": self.session_id,
                "model": model,
                "operation": operation
            }
        )
    
    def record_cost(self, cost_usd: float, operation: str):
        """Record operation cost using global metrics."""
        self.total_cost += cost_usd
        agent_metrics.operation_cost.record(
            cost_usd,
            attributes={
                "session_id": self.session_id,
                "operation": operation
            }
        )
    
    def create_agent_operation_span(
        self,
        agent_name: AgentName,
        operation: str,
        attributes: Optional[Dict[str, Any]] = None
    ):
        """Create agent operation span - matches TypeScript pattern."""
        return tracer.start_span(
            f"{agent_name.value}.{operation}",
            parent=self.session_span,
            attributes={
                'agent.name': agent_name.value,
                'agent.operation': operation,
                'session.id': self.session_id,
                'user.id': self.user_id,
                **(attributes or {})
            }
        )
    
    def end_session(self, outcome: str = 'completed'):
        """End session span - matches TypeScript pattern."""
        self.session_span.set_attributes({
            'session.outcome': outcome,
            'session.end_time': time.time()
        })
        self.session_span.end()
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Get session performance summary."""
        duration = time.time() - self.start_time
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "total_duration": duration,
            "total_operations": len(self.operations),
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "operations": self.operations,
            "success_rate": sum(
                1 for op in self.operations.values() if op["success"]
            ) / len(self.operations) if self.operations else 0.0
        }


def trace_agent_operation(
    operation_name: str,
    agent_name: AgentName,
    session_tracker: Optional[SessionTracker] = None
):
    """Decorator to trace agent operations - matches TypeScript pattern."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            
            with tracer.start_as_current_span(
                f"{agent_name.value}_{operation_name}",
                attributes={
                    "agent.name": agent_name.value,
                    "operation.name": operation_name,
                    "session.id": kwargs.get("session_id", "unknown"),
                }
            ) as span:
                try:
                    # Add function arguments as span attributes
                    if "user_id" in kwargs:
                        span.set_attribute("user.id", kwargs["user_id"])
                    if "complexity" in kwargs:
                        span.set_attribute("complexity.level", kwargs["complexity"])
                    
                    # Execute the function
                    result = await func(*args, **kwargs)
                    
                    # Mark as successful
                    span.set_status(Status(StatusCode.OK))
                    
                    # Record metrics using global metrics (matching TypeScript)
                    duration = time.time() - start_time
                    latency_ms = duration * 1000  # Convert to milliseconds
                    
                    # Record using agent_metrics like TypeScript
                    agent_metrics.agent_latency.record(latency_ms, attributes={
                        "agent_name": agent_name.value,
                        "operation": operation_name
                    })
                    
                    agent_metrics.operation_success.add(1, attributes={
                        "agent_name": agent_name.value,
                        "operation": operation_name
                    })
                    
                    span.set_attributes({
                        "operation.duration_ms": latency_ms,
                        "operation.success": True
                    })
                    
                    # Also record in session tracker if provided
                    if session_tracker:
                        session_tracker.record_operation(
                            operation_name,
                            agent_name,
                            duration,
                            success=True
                        )
                    
                    return result
                    
                except Exception as e:
                    # Record error
                    span.record_exception(e)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    
                    # Record metrics
                    duration = time.time() - start_time
                    latency_ms = duration * 1000
                    
                    agent_metrics.operation_failure.add(1, attributes={
                        "agent_name": agent_name.value,
                        "operation": operation_name,
                        "error_type": e.__class__.__name__
                    })
                    
                    span.set_attributes({
                        "operation.error": True,
                        "error.type": e.__class__.__name__,
                        "error.message": str(e)
                    })
                    
                    if session_tracker:
                        session_tracker.record_operation(
                            operation_name,
                            agent_name,
                            duration,
                            success=False,
                            error=str(e)
                        )
                    
                    raise
        
        return wrapper
    return decorator


def record_complexity_assessment(complexity: ComplexityLevel, score: float, session_id: str):
    """Record complexity assessment metrics."""
    agent_metrics.complexity_distribution.add(1, attributes={
        "complexity_level": complexity.value,
        "session_id": session_id
    })


def record_state_transition(
    from_state: str,
    to_state: str,
    trigger: str,
    session_id: str,
    duration: Optional[float] = None
):
    """Record state transition metrics."""
    attributes = {
        "from_state": from_state,
        "to_state": to_state,
        "session_id": session_id
    }
    
    with tracer.start_as_current_span("state_transition", attributes=attributes) as span:
        if duration:
            span.set_attribute("transition.duration", duration)
        
        agent_metrics.state_transitions.add(1, attributes=attributes)


@contextmanager
def trace_ai_operation(operation: str, model: str, session_id: str):
    """Context manager for tracing AI operations."""
    start_time = time.time()
    
    with tracer.start_as_current_span(
        f"ai_{operation}",
        attributes={
            "ai.operation": operation,
            "ai.model": model,
            "session.id": session_id
        }
    ) as span:
        try:
            yield span
            span.set_status(Status(StatusCode.OK))
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise
        finally:
            duration = time.time() - start_time
            span.set_attribute("ai.duration", duration)


def calculate_ai_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated AI operation cost."""
    # Pricing per 1K tokens (as of 2024)
    pricing = {
        "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
        "gemini-1.5-flash": {"input": 0.000125, "output": 0.0005},
        "text-embedding-004": {"input": 0.000025, "output": 0.0},
    }
    
    model_pricing = pricing.get(model, {"input": 0.001, "output": 0.002})
    
    input_cost = (input_tokens / 1000) * model_pricing["input"]
    output_cost = (output_tokens / 1000) * model_pricing["output"]
    
    return input_cost + output_cost


# TypeScript-style metric recording functions
def record_agent_metrics(
    agent_name: AgentName,
    operation: str,
    metrics_data: Dict[str, Any]
) -> None:
    """Record agent performance metrics - matches TypeScript recordAgentMetrics."""
    common_attributes = {
        "agent_name": agent_name.value,
        "operation": operation
    }
    
    # Record latency
    if "latency" in metrics_data:
        agent_metrics.agent_latency.record(metrics_data["latency"], attributes=common_attributes)
    
    # Record token usage
    if "tokensUsed" in metrics_data:
        agent_metrics.token_usage.add(metrics_data["tokensUsed"], attributes=common_attributes)
    
    # Record cost
    if "cost" in metrics_data:
        agent_metrics.operation_cost.record(metrics_data["cost"], attributes=common_attributes)
    
    # Record success/failure
    if metrics_data.get("success", True):
        agent_metrics.operation_success.add(1, attributes=common_attributes)
    else:
        agent_metrics.operation_failure.add(1, attributes={
            **common_attributes,
            "error_type": metrics_data.get("errorType", "unknown")
        })
    
    # Record fallback usage
    if metrics_data.get("fallbackUsed", False):
        agent_metrics.fallback_usage.add(1, attributes=common_attributes)


def record_agent_error(
    agent_name: AgentName,
    operation: str,
    error: Exception,
    context: Optional[Dict[str, Any]] = None
) -> None:
    """Enhanced error tracking with context - matches TypeScript pattern."""
    span = trace.get_active_span()
    
    if span:
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR, str(error)))
        
        # Add context attributes
        if context:
            for key, value in context.items():
                span.set_attribute(f"error.context.{key}", str(value))
    
    # Record error metrics
    agent_metrics.operation_failure.add(1, attributes={
        "agent_name": agent_name.value,
        "operation": operation,
        "error_type": error.__class__.__name__
    })


def calculate_operation_cost(
    tokens_used: int,
    model_name: str = "gemini-1.5-pro"
) -> float:
    """Calculate estimated AI operation cost - matches TypeScript function."""
    # Pricing per 1K tokens (as of 2024) - matching TypeScript pricing
    pricing = {
        "gemini-1.5-pro": 0.00125,  # $1.25 per 1M tokens
        "gemini-1.5-flash": 0.000075,  # $0.075 per 1M tokens
        "gemini-pro-1.5": 0.00125,  # Alias for consistency
        "gemini-flash": 0.000075   # Alias for consistency
    }
    
    price_per_token = pricing.get(model_name, pricing["gemini-1.5-pro"])
    return tokens_used * price_per_token


# Initialize telemetry on module import
init_telemetry()