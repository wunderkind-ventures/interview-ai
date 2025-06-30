"""
Circuit Breaker implementation for agent error handling and fallback strategies.
Provides resilience patterns for multi-agent system reliability.
Ported from TypeScript implementation in src/lib/circuit-breaker.ts
"""

import asyncio
import time
import logging
from typing import Dict, Any, List, Optional, Callable, TypeVar, Union
from enum import Enum
from dataclasses import dataclass, field

from .config import AgentName
from .telemetry import record_agent_error, agent_metrics

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "CLOSED"      # Normal operation
    OPEN = "OPEN"          # Circuit is open, calls fail fast
    HALF_OPEN = "HALF_OPEN"  # Testing if service has recovered


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration."""
    failure_threshold: int = 5           # Number of failures before opening
    reset_timeout: int = 60000          # Time to wait before trying half-open (ms)
    half_open_requests: int = 3         # Number of requests to test in half-open
    monitoring_window: int = 300000     # Time window for failure counting (ms)


@dataclass
class CircuitBreakerMetrics:
    """Circuit breaker metrics."""
    total_requests: int = 0
    success_requests: int = 0
    failure_requests: int = 0
    timeouts: int = 0
    circuit_open_time: Optional[int] = None
    last_failure_time: Optional[int] = None
    consecutive_failures: int = 0


class CircuitBreaker:
    """Circuit breaker for agent operations - matches TypeScript implementation."""
    
    def __init__(
        self,
        name: str,
        agent_name: AgentName,
        config: CircuitBreakerConfig
    ):
        self.name = name
        self.agent_name = agent_name
        self.config = config
        
        self.state = CircuitState.CLOSED
        self.failures = 0
        self.last_failure_time = 0
        self.half_open_count = 0
        self.failure_window: List[int] = []
        
        self.metrics = CircuitBreakerMetrics()
    
    async def execute(
        self,
        operation: Callable[[], T],
        fallback: Callable[[], Union[T, Callable[[], T]]],
        timeout: Optional[int] = None
    ) -> T:
        """Execute operation with circuit breaker protection."""
        self.metrics.total_requests += 1
        
        # Fail fast if circuit is open
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.half_open_count = 0
            else:
                logger.info(f"Circuit breaker {self.name} is OPEN - using fallback")
                return await self._execute_fallback(fallback)
        
        try:
            if timeout:
                result = await self._execute_with_timeout(operation, timeout)
            else:
                # Handle both sync and async operations
                if asyncio.iscoroutinefunction(operation):
                    result = await operation()
                else:
                    result = operation()
            
            self._on_success()
            return result
            
        except Exception as error:
            self._on_failure(error)
            
            # In half-open state, fall back immediately on failure
            if self.state == CircuitState.OPEN:
                return await self._execute_fallback(fallback)
            
            raise error
    
    async def _execute_with_timeout(self, operation: Callable[[], T], timeout_ms: int) -> T:
        """Execute operation with timeout."""
        try:
            if asyncio.iscoroutinefunction(operation):
                result = await asyncio.wait_for(operation(), timeout=timeout_ms / 1000.0)
            else:
                # For sync operations, run in executor with timeout
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, operation),
                    timeout=timeout_ms / 1000.0
                )
            return result
        except asyncio.TimeoutError:
            self.metrics.timeouts += 1
            raise Exception(f"Operation timed out after {timeout_ms}ms")
    
    async def _execute_fallback(self, fallback: Callable[[], Union[T, Callable[[], T]]]) -> T:
        """Execute fallback function."""
        try:
            if asyncio.iscoroutinefunction(fallback):
                return await fallback()
            else:
                return fallback()
        except Exception as fallback_error:
            record_agent_error(
                self.agent_name,
                'fallback_execution',
                fallback_error,
                {
                    'circuit_breaker_name': self.name,
                    'circuit_state': self.state.value
                }
            )
            raise Exception(f"Both primary operation and fallback failed: {fallback_error}")
    
    def _on_success(self) -> None:
        """Handle successful operation."""
        self.failures = 0
        self.metrics.success_requests += 1
        self.metrics.consecutive_failures = 0
        self._clean_failure_window()
        
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_count += 1
            
            if self.half_open_count >= self.config.half_open_requests:
                self._reset()
    
    def _on_failure(self, error: Exception) -> None:
        """Handle failed operation."""
        self.failures += 1
        self.metrics.failure_requests += 1
        self.metrics.consecutive_failures += 1
        self.last_failure_time = int(time.time() * 1000)  # Convert to milliseconds
        self.failure_window.append(self.last_failure_time)
        
        record_agent_error(
            self.agent_name,
            'circuit_breaker_failure',
            error,
            {
                'circuit_breaker_name': self.name,
                'consecutive_failures': self.metrics.consecutive_failures,
                'circuit_state': self.state.value
            }
        )
        
        self._clean_failure_window()
        
        # Check if we should open the circuit
        if self._should_open_circuit():
            self._open_circuit()
    
    def _should_open_circuit(self) -> bool:
        """Check if circuit should be opened."""
        recent_failures = len(self.failure_window)
        consecutive_failures = self.metrics.consecutive_failures
        
        return (
            consecutive_failures >= self.config.failure_threshold or
            recent_failures >= self.config.failure_threshold
        )
    
    def _open_circuit(self) -> None:
        """Open the circuit."""
        self.state = CircuitState.OPEN
        self.metrics.circuit_open_time = int(time.time() * 1000)
        self.half_open_count = 0
        
        logger.warning(
            f"Circuit breaker {self.name} opened due to failures",
            extra={
                'consecutive_failures': self.metrics.consecutive_failures,
                'recent_failures': len(self.failure_window),
                'agent_name': self.agent_name.value
            }
        )
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit should attempt reset."""
        if not self.metrics.circuit_open_time:
            return False
        
        time_since_open = int(time.time() * 1000) - self.metrics.circuit_open_time
        return time_since_open >= self.config.reset_timeout
    
    def _reset(self) -> None:
        """Reset circuit to closed state."""
        self.state = CircuitState.CLOSED
        self.failures = 0
        self.half_open_count = 0
        self.failure_window = []
        self.metrics.consecutive_failures = 0
        self.metrics.circuit_open_time = None
        
        logger.info(f"Circuit breaker {self.name} reset to CLOSED state")
    
    def _clean_failure_window(self) -> None:
        """Clean old failures from window."""
        cutoff = int(time.time() * 1000) - self.config.monitoring_window
        self.failure_window = [t for t in self.failure_window if t > cutoff]
    
    # Public methods for monitoring
    def get_state(self) -> CircuitState:
        """Get current circuit state."""
        return self.state
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get circuit breaker metrics."""
        total_in_window = max(self.metrics.total_requests, 1)
        
        return {
            **self.metrics.__dict__,
            'state': self.state.value,
            'recent_failures': len(self.failure_window),
            'failure_rate': self.metrics.failure_requests / total_in_window
        }
    
    def force_open(self) -> None:
        """Manually force circuit open."""
        self.state = CircuitState.OPEN
        self.metrics.circuit_open_time = int(time.time() * 1000)
        logger.warning(f"Circuit breaker {self.name} manually forced open")
    
    def force_close(self) -> None:
        """Manually force circuit closed."""
        self._reset()
        logger.info(f"Circuit breaker {self.name} manually forced closed")


class CircuitBreakerManager:
    """Circuit Breaker Manager for all agents - matches TypeScript implementation."""
    
    def __init__(self):
        self.breakers: Dict[str, CircuitBreaker] = {}
        self.default_config = CircuitBreakerConfig(
            failure_threshold=5,
            reset_timeout=60000,  # 1 minute
            half_open_requests=3,
            monitoring_window=300000  # 5 minutes
        )
    
    def get_circuit_breaker(
        self,
        agent_name: AgentName,
        operation: str,
        config: Optional[CircuitBreakerConfig] = None
    ) -> CircuitBreaker:
        """Get or create circuit breaker for agent operation."""
        key = f"{agent_name.value}-{operation}"
        
        if key not in self.breakers:
            breaker_config = config or self.default_config
            breaker = CircuitBreaker(key, agent_name, breaker_config)
            self.breakers[key] = breaker
        
        return self.breakers[key]
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """Get metrics for all circuit breakers."""
        return {key: breaker.get_metrics() for key, breaker in self.breakers.items()}
    
    def get_health_summary(self) -> Dict[str, List[str]]:
        """Get health summary of all circuit breakers."""
        summary = {
            'healthy': [],
            'degraded': [],
            'failed': []
        }
        
        for key, breaker in self.breakers.items():
            metrics = breaker.get_metrics()
            
            if metrics['state'] == CircuitState.OPEN.value:
                summary['failed'].append(key)
            elif metrics['state'] == CircuitState.HALF_OPEN.value or metrics['failure_rate'] > 0.1:
                summary['degraded'].append(key)
            else:
                summary['healthy'].append(key)
        
        return summary
    
    # Emergency controls
    def open_all(self) -> None:
        """Force open all circuit breakers."""
        for breaker in self.breakers.values():
            breaker.force_open()
    
    def close_all(self) -> None:
        """Force close all circuit breakers."""
        for breaker in self.breakers.values():
            breaker.force_close()


# Singleton instance
circuit_breaker_manager = CircuitBreakerManager()


def with_circuit_breaker(
    agent_name: AgentName,
    operation: str,
    config: Optional[CircuitBreakerConfig] = None
):
    """Decorator for automatic circuit breaker protection - matches TypeScript."""
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            circuit_breaker = circuit_breaker_manager.get_circuit_breaker(
                agent_name,
                operation,
                config
            )
            
            # Define fallback function (should be customized per use case)
            def fallback():
                raise Exception(f"Service {agent_name.value} is temporarily unavailable")
            
            return await circuit_breaker.execute(
                lambda: func(*args, **kwargs),
                fallback,
                config.reset_timeout if config else None
            )
        
        return wrapper
    return decorator