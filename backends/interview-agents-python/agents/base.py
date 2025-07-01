"""Base agent class for Google Agent Development Kit integration."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from enum import Enum
import asyncio
import logging
from dataclasses import dataclass
from tenacity import retry, stop_after_attempt, wait_exponential

from common.config import AgentName, get_agent_config, settings
from common.telemetry import SessionTracker, trace_agent_operation, trace_ai_operation
from common.auth import FirestoreClient
from common.circuit_breaker import CircuitBreakerManager, CircuitBreakerConfig, with_circuit_breaker
from common.analytics import get_analytics_client

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """Types of messages between agents."""
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


class MessagePriority(str, Enum):
    """Message priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class AgentMessage:
    """Message structure for inter-agent communication."""
    id: str
    type: MessageType
    from_agent: AgentName
    to_agent: AgentName
    session_id: str
    timestamp: datetime
    priority: MessagePriority
    payload: Dict[str, Any]
    correlation_id: Optional[str] = None
    ttl_seconds: Optional[int] = 300  # 5 minutes default TTL


@dataclass
class AgentState:
    """Current state of an agent."""
    agent_name: AgentName
    session_id: str
    status: str
    last_activity: datetime
    current_task: Optional[str] = None
    metadata: Dict[str, Any] = None


# Circuit breaker functionality moved to common/circuit_breaker.py


class BaseAgent(ABC):
    """Base class for all ADK agents."""
    
    def __init__(
        self,
        agent_name: AgentName,
        session_tracker: Optional[SessionTracker] = None
    ):
        self.agent_name = agent_name
        self.session_tracker = session_tracker
        self.config = get_agent_config(agent_name)
        self.firestore_client = FirestoreClient()
        
        # Circuit breaker manager for this agent
        self.circuit_breaker_manager = CircuitBreakerManager()
        
        # Get circuit breaker config from agent config
        circuit_config = CircuitBreakerConfig(
            failure_threshold=self.config.get("failure_threshold", 5),
            reset_timeout=self.config.get("recovery_timeout", 60) * 1000,  # Convert to ms
            half_open_requests=self.config.get("half_open_requests", 3),
            monitoring_window=self.config.get("monitoring_window", 300) * 1000  # Convert to ms
        )
        
        # Message queue for inter-agent communication
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.message_handlers: Dict[MessageType, callable] = {}
        
        # Agent state
        self.state = AgentState(
            agent_name=agent_name,
            session_id="",
            status="initialized",
            last_activity=datetime.now(),
            metadata={}
        )
        
        logger.info(f"Initialized {agent_name.value} agent")
    
    @abstractmethod
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process a request. Must be implemented by subclasses."""
        pass
    
    @abstractmethod
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages. Must be implemented by subclasses."""
        pass
    
    async def initialize(self, session_id: str, **kwargs):
        """Initialize the agent for a session."""
        self.state.session_id = session_id
        self.state.status = "active"
        self.state.last_activity = datetime.now()
        
        logger.info(f"Agent {self.agent_name.value} initialized for session {session_id}")
    
    async def shutdown(self):
        """Shutdown the agent gracefully."""
        self.state.status = "shutdown"
        logger.info(f"Agent {self.agent_name.value} shutdown")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def send_message(
        self,
        to_agent: AgentName,
        message_type: MessageType,
        payload: Dict[str, Any],
        priority: MessagePriority = MessagePriority.NORMAL,
        correlation_id: Optional[str] = None
    ) -> bool:
        """Send a message to another agent."""
        message = AgentMessage(
            id=f"{self.agent_name.value}_{datetime.now().timestamp()}",
            type=message_type,
            from_agent=self.agent_name,
            to_agent=to_agent,
            session_id=self.state.session_id,
            timestamp=datetime.now(),
            priority=priority,
            payload=payload,
            correlation_id=correlation_id
        )
        
        try:
            start_time = datetime.now()
            
            # Store message in Firestore for inter-agent communication
            await self._store_message(message)
            
            # Calculate processing time
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log to BigQuery analytics
            analytics = get_analytics_client()
            if analytics:
                analytics.log_agent_interaction(
                    session_id=self.state.session_id,
                    source_agent=self.agent_name.value,
                    target_agent=to_agent.value,
                    interaction_type=message_type.value,
                    content=str(payload),
                    processing_time_ms=processing_time_ms,
                    success=True,
                    metadata={
                        "priority": priority.value,
                        "correlation_id": correlation_id
                    }
                )
            
            logger.debug(
                f"Message sent from {self.agent_name.value} to {to_agent.value}: {message_type.value}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            
            # Log failure to BigQuery
            analytics = get_analytics_client()
            if analytics:
                analytics.log_agent_interaction(
                    session_id=self.state.session_id,
                    source_agent=self.agent_name.value,
                    target_agent=to_agent.value,
                    interaction_type=message_type.value,
                    success=False,
                    error_message=str(e)
                )
            
            return False
    
    async def receive_messages(self) -> List[AgentMessage]:
        """Receive messages addressed to this agent."""
        try:
            messages = await self._fetch_messages()
            return messages
        except Exception as e:
            logger.error(f"Failed to receive messages: {e}")
            return []
    
    async def _store_message(self, message: AgentMessage):
        """Store message in Firestore."""
        collection_path = f"agent_messages/{self.state.session_id}/messages"
        
        doc_data = {
            "id": message.id,
            "type": message.type.value,
            "from_agent": message.from_agent.value,
            "to_agent": message.to_agent.value,
            "session_id": message.session_id,
            "timestamp": message.timestamp,
            "priority": message.priority.value,
            "payload": message.payload,
            "correlation_id": message.correlation_id,
            "ttl_seconds": message.ttl_seconds,
            "processed": False
        }
        
        self.firestore_client.collection(collection_path).add(doc_data)
    
    async def _fetch_messages(self) -> List[AgentMessage]:
        """Fetch unprocessed messages for this agent."""
        collection_path = f"agent_messages/{self.state.session_id}/messages"
        
        # Query for unprocessed messages addressed to this agent
        query = (
            self.firestore_client.collection(collection_path)
            .where("to_agent", "==", self.agent_name.value)
            .where("processed", "==", False)
            .order_by("timestamp")
            .limit(10)
        )
        
        messages = []
        docs = query.stream()
        
        for doc in docs:
            data = doc.to_dict()
            message = AgentMessage(
                id=data["id"],
                type=MessageType(data["type"]),
                from_agent=AgentName(data["from_agent"]),
                to_agent=AgentName(data["to_agent"]),
                session_id=data["session_id"],
                timestamp=data["timestamp"],
                priority=MessagePriority(data["priority"]),
                payload=data["payload"],
                correlation_id=data.get("correlation_id"),
                ttl_seconds=data.get("ttl_seconds")
            )
            messages.append(message)
            
            # Mark as processed
            doc.reference.update({"processed": True})
        
        return messages
    
    async def update_state(self, **kwargs):
        """Update the agent's state."""
        self.state.last_activity = datetime.now()
        
        for key, value in kwargs.items():
            if hasattr(self.state, key):
                setattr(self.state, key, value)
            else:
                if not self.state.metadata:
                    self.state.metadata = {}
                self.state.metadata[key] = value
    
    async def get_state(self) -> Dict[str, Any]:
        """Get current agent state."""
        return {
            "agent_name": self.state.agent_name.value,
            "session_id": self.state.session_id,
            "status": self.state.status,
            "last_activity": self.state.last_activity.isoformat(),
            "current_task": self.state.current_task,
            "metadata": self.state.metadata or {}
        }
    
    async def healthcheck(self) -> Dict[str, Any]:
        """Perform health check."""
        # Get circuit breaker health summary
        cb_health = self.circuit_breaker_manager.get_health_summary()
        
        return {
            "agent_name": self.agent_name.value,
            "status": self.state.status,
            "circuit_breaker_health": cb_health,
            "last_activity": self.state.last_activity.isoformat(),
            "uptime_seconds": (datetime.now() - self.state.last_activity).total_seconds(),
            "message_queue_size": self.message_queue.qsize(),
        }
    
    def get_circuit_breaker(self, operation: str):
        """Get circuit breaker for a specific operation."""
        return self.circuit_breaker_manager.get_circuit_breaker(
            self.agent_name,
            operation
        )
    
    @trace_agent_operation("heartbeat", AgentName.ORCHESTRATOR)  # Will be overridden
    async def heartbeat(self) -> Dict[str, Any]:
        """Send heartbeat to indicate agent is alive."""
        self.state.last_activity = datetime.now()
        
        return {
            "agent_name": self.agent_name.value,
            "timestamp": datetime.now().isoformat(),
            "status": self.state.status,
            "session_id": self.state.session_id
        }
    
    async def _log_operation(self, operation: str, success: bool, duration: float, **kwargs):
        """Log operation for monitoring."""
        if self.session_tracker:
            self.session_tracker.record_operation(
                operation,
                self.agent_name,
                duration,
                success,
                **kwargs
            )
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(agent_name={self.agent_name.value}, status={self.state.status})>"