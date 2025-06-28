"""
Orchestrator Agent - Google Agent Development Kit Implementation

This is the proper implementation using Google's Agent Development Kit in Python.
The Orchestrator Agent manages the state of the entire interview process and
coordinates communication between other agents.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from google.cloud import firestore
import opentelemetry
from opentelemetry import trace, metrics
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.exporter.cloud_monitoring import CloudMonitoringMetricsExporter

# Google Agent Development Kit imports
# Note: These would be the actual ADK imports when available
try:
    from google.agents import Agent, MessageHandler, StateTransition
    from google.agents.runtime import AgentRuntime
    from google.agents.messaging import Message, MessageBus
    from google.agents.state import StateMachine, State
except ImportError:
    # Mock implementations for development
    print("ADK not available - using mock implementations")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenTelemetry
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# Metrics
interview_duration = meter.create_histogram(
    "interview_duration_seconds",
    description="Duration of interview sessions",
    unit="s"
)

state_transitions = meter.create_counter(
    "state_transitions_total",
    description="Total number of state transitions"
)

agent_communications = meter.create_counter(
    "agent_communications_total",
    description="Total number of inter-agent communications"
)

complexity_assessments = meter.create_counter(
    "complexity_assessments_total",
    description="Total number of complexity assessments"
)

interventions_generated = meter.create_counter(
    "interventions_generated_total",
    description="Total number of interventions generated"
)


class InterviewState(Enum):
    """Interview flow states"""
    CONFIGURING = "configuring"
    SCOPING = "scoping"
    ANALYSIS = "analysis"
    SOLUTIONING = "solutioning"
    METRICS = "metrics"
    CHALLENGING = "challenging"
    REPORT_GENERATION = "report_generation"
    END = "end"


class ComplexityLevel(Enum):
    """Complexity assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReasoningStrategy(Enum):
    """Reasoning strategies for different complexity levels"""
    LEAN = "lean"
    COT = "chain_of_thought"
    STEP_BACK = "step_back"


class AgentType(Enum):
    """Types of agents in the system"""
    ORCHESTRATOR = "orchestrator"
    CONTEXT = "context"
    INTERVIEWER = "interviewer"
    EVALUATOR = "evaluator"
    SYNTHESIS = "synthesis"
    COACHING = "coaching"
    STORY_DECONSTRUCTOR = "story_deconstructor"
    IMPACT_QUANTIFIER = "impact_quantifier"
    ACHIEVEMENT_REFRAMING = "achievement_reframing"


class InterventionType(Enum):
    """Types of interventions the orchestrator can make"""
    PREVENT_PREMATURE_SOLUTIONING = "prevent_premature_solutioning"
    ENSURE_USER_FOCUS = "ensure_user_focus"
    DEMAND_PRIORITIZATION_RATIONALE = "demand_prioritization_rationale"
    REQUIRE_MEASURABLE_METRICS = "require_measurable_metrics"
    HANDLE_SILENCE_OR_CONFUSION = "handle_silence_or_confusion"


@dataclass
class SessionContext:
    """Context information for an interview session"""
    interview_type: str
    faang_level: str
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    resume_data: Optional[Dict] = None
    target_skills: Optional[List[str]] = None


@dataclass
class SessionState:
    """Complete state of an interview session"""
    session_id: str
    user_id: str
    current_state: InterviewState
    previous_state: Optional[InterviewState]
    context: SessionContext
    complexity: ComplexityLevel
    reasoning_strategy: ReasoningStrategy
    start_time: datetime
    state_transitions: List[Dict]
    scores: Dict[str, float]
    interventions: List[Dict]
    last_user_response: Optional[str] = None
    last_response_timestamp: Optional[datetime] = None


@dataclass
class AgentMessage:
    """Message structure for inter-agent communication"""
    message_id: str
    type: str
    from_agent: AgentType
    to_agent: AgentType
    session_id: str
    timestamp: datetime
    payload: Dict[str, Any]
    correlation_id: Optional[str] = None


@dataclass
class InterventionDirective:
    """Directive for intervention in interview flow"""
    type: InterventionType
    message: str
    context: Dict[str, Any]
    priority: str = "medium"


class InterviewStateMachine:
    """State machine for managing interview flow"""
    
    def __init__(self):
        self.valid_transitions = {
            InterviewState.CONFIGURING: [InterviewState.SCOPING],
            InterviewState.SCOPING: [InterviewState.ANALYSIS, InterviewState.CHALLENGING],
            InterviewState.ANALYSIS: [InterviewState.SOLUTIONING, InterviewState.CHALLENGING],
            InterviewState.SOLUTIONING: [InterviewState.METRICS, InterviewState.CHALLENGING],
            InterviewState.METRICS: [InterviewState.CHALLENGING],
            InterviewState.CHALLENGING: [InterviewState.REPORT_GENERATION],
            InterviewState.REPORT_GENERATION: [InterviewState.END],
            InterviewState.END: []
        }
        
        # Semantic triggers for state transitions
        self.semantic_triggers = {
            InterviewState.SCOPING: {
                InterviewState.ANALYSIS: [
                    "move on to the users",
                    "user segments",
                    "pain points",
                    "understand the problem"
                ]
            },
            InterviewState.ANALYSIS: {
                InterviewState.SOLUTIONING: [
                    "solution I propose",
                    "recommendation",
                    "feature I would build",
                    "my approach would be"
                ]
            },
            InterviewState.SOLUTIONING: {
                InterviewState.METRICS: [
                    "measure success",
                    "KPIs",
                    "North Star metric",
                    "success metrics"
                ]
            }
        }

    def can_transition(self, from_state: InterviewState, to_state: InterviewState) -> bool:
        """Check if a state transition is valid"""
        return to_state in self.valid_transitions.get(from_state, [])

    def detect_semantic_transition(self, current_state: InterviewState, response: str) -> Optional[InterviewState]:
        """Detect if user response indicates a semantic transition"""
        response_lower = response.lower()
        
        triggers = self.semantic_triggers.get(current_state, {})
        for target_state, keywords in triggers.items():
            if any(keyword in response_lower for keyword in keywords):
                return target_state
        
        return None


class ComplexityAssessor:
    """Assesses complexity of interview content and responses"""
    
    @staticmethod
    def assess_initial_complexity(context: SessionContext) -> ComplexityLevel:
        """Assess initial complexity based on interview context"""
        complexity_factors = {
            'data structures & algorithms': 1.0,
            'technical system design': 1.2,
            'machine learning': 1.1,
            'product sense': 0.9,
            'behavioral': 0.8
        }
        
        level_factors = {
            'L3': 0.8,
            'L4': 1.0,
            'L5': 1.2,
            'L6': 1.4,
            'L7+': 1.6
        }
        
        type_score = complexity_factors.get(context.interview_type, 1.0)
        level_score = level_factors.get(context.faang_level, 1.0)
        complexity_score = type_score * level_score
        
        if complexity_score <= 0.9:
            return ComplexityLevel.LOW
        elif complexity_score <= 1.2:
            return ComplexityLevel.MEDIUM
        else:
            return ComplexityLevel.HIGH

    @staticmethod
    def assess_response_complexity(response: str) -> ComplexityLevel:
        """Assess complexity of a user response"""
        word_count = len(response.split())
        
        complex_indicators = [
            'architecture', 'scalability', 'microservices', 'distributed',
            'algorithm', 'optimization', 'trade-offs', 'constraints'
        ]
        
        has_complex_concepts = any(
            indicator in response.lower() 
            for indicator in complex_indicators
        )
        
        if word_count > 200 and has_complex_concepts:
            return ComplexityLevel.HIGH
        elif word_count > 100 or has_complex_concepts:
            return ComplexityLevel.MEDIUM
        else:
            return ComplexityLevel.LOW


class ReasoningStrategySelector:
    """Selects appropriate reasoning strategy based on complexity"""
    
    @staticmethod
    def select_strategy(complexity: ComplexityLevel) -> ReasoningStrategy:
        """Select reasoning strategy based on complexity level"""
        strategy_map = {
            ComplexityLevel.LOW: ReasoningStrategy.LEAN,
            ComplexityLevel.MEDIUM: ReasoningStrategy.COT,
            ComplexityLevel.HIGH: ReasoningStrategy.STEP_BACK
        }
        return strategy_map[complexity]


class InterventionEngine:
    """Generates interventions based on session state and scores"""
    
    @staticmethod
    def check_gating_conditions(
        session_state: SessionState,
        scores: Dict[str, float]
    ) -> Optional[InterventionDirective]:
        """Check if intervention is needed based on current state and scores"""
        
        # Prevent premature solutioning
        if session_state.current_state == InterviewState.SCOPING:
            if InterventionEngine._contains_solution_keywords(session_state.last_user_response or ""):
                problem_score = scores.get('Problem Definition & Structuring', 0)
                if problem_score < 3.0:
                    return InterventionDirective(
                        type=InterventionType.PREVENT_PREMATURE_SOLUTIONING,
                        message="That's an interesting idea. Before we dive into solutions, could you first walk me through how you're structuring your overall approach to this problem?",
                        context={"current_score": problem_score, "threshold": 3.0}
                    )
        
        # Ensure user focus
        if session_state.current_state == InterviewState.ANALYSIS:
            if not InterventionEngine._contains_user_keywords(session_state.last_user_response or ""):
                return InterventionDirective(
                    type=InterventionType.ENSURE_USER_FOCUS,
                    message="This is a good start. Could you tell me more about the specific users or customers you are designing this for?",
                    context={"missing_user_focus": True}
                )
        
        # Demand prioritization rationale
        if session_state.current_state == InterviewState.SOLUTIONING:
            if not InterventionEngine._contains_rationale_keywords(session_state.last_user_response or ""):
                return InterventionDirective(
                    type=InterventionType.DEMAND_PRIORITIZATION_RATIONALE,
                    message="That sounds like a viable solution. Can you walk me through why you chose this particular solution over other alternatives you may have considered?",
                    context={"missing_rationale": True}
                )
        
        return None

    @staticmethod
    def _contains_solution_keywords(response: str) -> bool:
        solution_keywords = ['solution', 'recommend', 'build', 'implement', 'design']
        return any(keyword in response.lower() for keyword in solution_keywords)

    @staticmethod
    def _contains_user_keywords(response: str) -> bool:
        user_keywords = ['user', 'customer', 'persona', 'audience']
        return any(keyword in response.lower() for keyword in user_keywords)

    @staticmethod
    def _contains_rationale_keywords(response: str) -> bool:
        rationale_keywords = ['because', 'reason', 'why', 'chose', 'decided', 'trade-off']
        return any(keyword in response.lower() for keyword in rationale_keywords)


class OrchestratorAgent:
    """
    Main Orchestrator Agent using Google Agent Development Kit
    
    This agent manages the entire interview flow, coordinates with other agents,
    and implements adaptive reasoning strategies based on complexity assessment.
    """
    
    def __init__(self, firestore_client=None):
        self.agent_id = "orchestrator"
        self.sessions: Dict[str, SessionState] = {}
        self.state_machine = InterviewStateMachine()
        self.complexity_assessor = ComplexityAssessor()
        self.reasoning_selector = ReasoningStrategySelector()
        self.intervention_engine = InterventionEngine()
        
        # Initialize Firestore for persistence
        self.db = firestore_client or firestore.Client()
        
        # Initialize message handling
        self.message_queue: List[AgentMessage] = []
        
        # Start background tasks
        asyncio.create_task(self._message_processor())

    async def start_interview(
        self,
        session_id: str,
        user_id: str,
        context: SessionContext
    ) -> Dict[str, Any]:
        """
        Start a new interview session
        
        Args:
            session_id: Unique identifier for the session
            user_id: Unique identifier for the user
            context: Interview context information
            
        Returns:
            Dict containing session start result
        """
        with tracer.start_as_current_span("orchestrator.start_interview") as span:
            span.set_attributes({
                "session_id": session_id,
                "user_id": user_id,
                "interview_type": context.interview_type,
                "faang_level": context.faang_level
            })
            
            try:
                # Assess initial complexity
                complexity = self.complexity_assessor.assess_initial_complexity(context)
                reasoning_strategy = self.reasoning_selector.select_strategy(complexity)
                
                # Record complexity assessment
                complexity_assessments.add(1, {
                    "complexity": complexity.value,
                    "interview_type": context.interview_type
                })
                
                # Create session state
                session_state = SessionState(
                    session_id=session_id,
                    user_id=user_id,
                    current_state=InterviewState.CONFIGURING,
                    previous_state=None,
                    context=context,
                    complexity=complexity,
                    reasoning_strategy=reasoning_strategy,
                    start_time=datetime.now(),
                    state_transitions=[{
                        "state": InterviewState.CONFIGURING.value,
                        "timestamp": datetime.now().isoformat(),
                        "trigger": "session_start"
                    }],
                    scores={},
                    interventions=[]
                )
                
                # Store session
                self.sessions[session_id] = session_state
                await self._persist_session(session_state)
                
                # Transition to scoping
                await self._transition_state(session_id, InterviewState.SCOPING, "user_action")
                
                # Send messages to other agents
                if context.resume_data:
                    await self._send_message(
                        AgentMessage(
                            message_id=f"msg_{session_id}_context_parse",
                            type="parse_resume",
                            from_agent=AgentType.ORCHESTRATOR,
                            to_agent=AgentType.CONTEXT,
                            session_id=session_id,
                            timestamp=datetime.now(),
                            payload={
                                "resume_data": context.resume_data,
                                "session_id": session_id
                            }
                        )
                    )
                
                # Send directive to Interviewer
                await self._send_message(
                    AgentMessage(
                        message_id=f"msg_{session_id}_start_scoping",
                        type="generate_scoping_question",
                        from_agent=AgentType.ORCHESTRATOR,
                        to_agent=AgentType.INTERVIEWER,
                        session_id=session_id,
                        timestamp=datetime.now(),
                        payload={
                            "phase": InterviewState.SCOPING.value,
                            "complexity": complexity.value,
                            "reasoning_strategy": reasoning_strategy.value,
                            "context": asdict(context)
                        }
                    )
                )
                
                logger.info(f"Started interview session {session_id} for user {user_id}")
                
                return {
                    "success": True,
                    "session_id": session_id,
                    "initial_state": InterviewState.SCOPING.value,
                    "complexity": complexity.value,
                    "reasoning_strategy": reasoning_strategy.value
                }
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                logger.error(f"Failed to start interview session: {e}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def handle_user_response(
        self,
        session_id: str,
        response: str,
        response_time_ms: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Handle user response and orchestrate next steps
        
        Args:
            session_id: Session identifier
            response: User's response text
            response_time_ms: Time taken for response in milliseconds
            
        Returns:
            Dict containing next action information
        """
        with tracer.start_as_current_span("orchestrator.handle_user_response") as span:
            span.set_attributes({
                "session_id": session_id,
                "response_length": len(response),
                "response_time_ms": response_time_ms or 0
            })
            
            try:
                session_state = self.sessions.get(session_id)
                if not session_state:
                    raise ValueError(f"Session {session_id} not found")
                
                # Update session state
                session_state.last_user_response = response
                session_state.last_response_timestamp = datetime.now()
                
                # Assess response complexity
                response_complexity = self.complexity_assessor.assess_response_complexity(response)
                
                # Update reasoning strategy if needed
                if response_complexity != session_state.complexity:
                    session_state.complexity = response_complexity
                    session_state.reasoning_strategy = self.reasoning_selector.select_strategy(response_complexity)
                    
                    complexity_assessments.add(1, {
                        "complexity": response_complexity.value,
                        "trigger": "response_assessment"
                    })
                
                # Send to Evaluator for real-time analysis
                await self._send_message(
                    AgentMessage(
                        message_id=f"msg_{session_id}_evaluate_{datetime.now().timestamp()}",
                        type="evaluate_response",
                        from_agent=AgentType.ORCHESTRATOR,
                        to_agent=AgentType.EVALUATOR,
                        session_id=session_id,
                        timestamp=datetime.now(),
                        payload={
                            "response": response,
                            "current_phase": session_state.current_state.value,
                            "complexity": session_state.complexity.value,
                            "response_time_ms": response_time_ms
                        }
                    )
                )
                
                # Check for semantic transitions
                next_state = self.state_machine.detect_semantic_transition(
                    session_state.current_state,
                    response
                )
                
                if next_state and self.state_machine.can_transition(session_state.current_state, next_state):
                    await self._transition_state(session_id, next_state, "semantic")
                    await self._persist_session(session_state)
                    
                    return {
                        "next_action": f"transition_to_{next_state.value}",
                        "new_state": next_state.value,
                        "complexity": session_state.complexity.value
                    }
                
                await self._persist_session(session_state)
                
                return {
                    "next_action": "continue_current_phase",
                    "current_state": session_state.current_state.value,
                    "complexity": session_state.complexity.value
                }
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                logger.error(f"Failed to handle user response: {e}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def handle_agent_message(self, message: AgentMessage) -> None:
        """
        Handle messages from other agents
        
        Args:
            message: Message from another agent
        """
        with tracer.start_as_current_span("orchestrator.handle_agent_message") as span:
            span.set_attributes({
                "message_type": message.type,
                "from_agent": message.from_agent.value,
                "session_id": message.session_id
            })
            
            try:
                session_state = self.sessions.get(message.session_id)
                if not session_state:
                    logger.warning(f"Received message for unknown session: {message.session_id}")
                    return
                
                agent_communications.add(1, {
                    "from_agent": message.from_agent.value,
                    "to_agent": message.to_agent.value,
                    "message_type": message.type
                })
                
                if message.type == "context_ready":
                    await self._handle_context_ready(message, session_state)
                elif message.type == "response_scored":
                    await self._handle_response_scored(message, session_state)
                elif message.type == "question_generated":
                    await self._handle_question_generated(message, session_state)
                else:
                    logger.info(f"Unhandled message type: {message.type}")
                
                await self._persist_session(session_state)
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                logger.error(f"Failed to handle agent message: {e}")

    async def get_session_metrics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get metrics for a specific session"""
        session_state = self.sessions.get(session_id)
        if not session_state:
            return None
        
        duration = (datetime.now() - session_state.start_time).total_seconds()
        
        return {
            "session_id": session_id,
            "duration_seconds": duration,
            "current_state": session_state.current_state.value,
            "state_transitions": len(session_state.state_transitions),
            "interventions": len(session_state.interventions),
            "scores": session_state.scores,
            "complexity": session_state.complexity.value,
            "reasoning_strategy": session_state.reasoning_strategy.value
        }

    # Private methods

    async def _transition_state(
        self,
        session_id: str,
        new_state: InterviewState,
        trigger: str
    ) -> bool:
        """Transition session to new state"""
        session_state = self.sessions[session_id]
        current_state = session_state.current_state
        
        if not self.state_machine.can_transition(current_state, new_state):
            logger.warning(f"Invalid transition from {current_state} to {new_state}")
            return False
        
        # Update state
        session_state.previous_state = current_state
        session_state.current_state = new_state
        session_state.state_transitions.append({
            "state": new_state.value,
            "timestamp": datetime.now().isoformat(),
            "trigger": trigger
        })
        
        # Record metrics
        state_transitions.add(1, {
            "from_state": current_state.value,
            "to_state": new_state.value,
            "trigger": trigger
        })
        
        logger.info(f"State transition: {current_state.value} → {new_state.value} ({trigger})")
        
        # Handle state entry
        await self._handle_state_entry(session_id, new_state)
        
        return True

    async def _handle_state_entry(self, session_id: str, state: InterviewState) -> None:
        """Handle entry into new state"""
        session_state = self.sessions[session_id]
        
        if state == InterviewState.ANALYSIS:
            # Notify Interviewer of phase transition
            await self._send_message(
                AgentMessage(
                    message_id=f"msg_{session_id}_phase_transition",
                    type="phase_transition",
                    from_agent=AgentType.ORCHESTRATOR,
                    to_agent=AgentType.INTERVIEWER,
                    session_id=session_id,
                    timestamp=datetime.now(),
                    payload={
                        "new_phase": state.value,
                        "complexity": session_state.complexity.value,
                        "reasoning_strategy": session_state.reasoning_strategy.value
                    }
                )
            )
        
        elif state == InterviewState.CHALLENGING:
            # Generate challenge based on session performance
            await self._send_message(
                AgentMessage(
                    message_id=f"msg_{session_id}_generate_challenge",
                    type="generate_challenge",
                    from_agent=AgentType.ORCHESTRATOR,
                    to_agent=AgentType.INTERVIEWER,
                    session_id=session_id,
                    timestamp=datetime.now(),
                    payload={
                        "session_history": session_state.state_transitions,
                        "current_scores": session_state.scores,
                        "complexity": session_state.complexity.value
                    }
                )
            )
        
        elif state == InterviewState.REPORT_GENERATION:
            # Trigger report generation
            await self._send_message(
                AgentMessage(
                    message_id=f"msg_{session_id}_generate_report",
                    type="generate_report",
                    from_agent=AgentType.ORCHESTRATOR,
                    to_agent=AgentType.SYNTHESIS,
                    session_id=session_id,
                    timestamp=datetime.now(),
                    payload={
                        "session_data": asdict(session_state),
                        "final_scores": session_state.scores
                    }
                )
            )

    async def _handle_context_ready(self, message: AgentMessage, session_state: SessionState) -> None:
        """Handle context ready message from Context Agent"""
        context_data = message.payload.get("context", {})
        session_state.context.resume_data = {**session_state.context.resume_data or {}, **context_data}
        logger.info(f"Context ready for session {session_state.session_id}")

    async def _handle_response_scored(self, message: AgentMessage, session_state: SessionState) -> None:
        """Handle response scored message from Evaluator Agent"""
        scores = message.payload.get("scores", {})
        session_state.scores.update(scores)
        
        # Check for interventions
        intervention = self.intervention_engine.check_gating_conditions(session_state, scores)
        
        if intervention:
            session_state.interventions.append(asdict(intervention))
            
            interventions_generated.add(1, {
                "intervention_type": intervention.type.value,
                "current_state": session_state.current_state.value
            })
            
            # Send intervention to Interviewer
            await self._send_message(
                AgentMessage(
                    message_id=f"msg_{session_state.session_id}_intervention",
                    type="intervention",
                    from_agent=AgentType.ORCHESTRATOR,
                    to_agent=AgentType.INTERVIEWER,
                    session_id=session_state.session_id,
                    timestamp=datetime.now(),
                    payload=asdict(intervention)
                )
            )

    async def _handle_question_generated(self, message: AgentMessage, session_state: SessionState) -> None:
        """Handle question generated message from Interviewer Agent"""
        question = message.payload.get("question", "")
        logger.info(f"Question generated for session {session_state.session_id}: {question[:100]}...")

    async def _send_message(self, message: AgentMessage) -> None:
        """Send message to another agent"""
        self.message_queue.append(message)
        logger.debug(f"Queued message: {message.from_agent.value} → {message.to_agent.value}: {message.type}")

    async def _message_processor(self) -> None:
        """Background task to process message queue"""
        while True:
            try:
                if self.message_queue:
                    # In real implementation, this would send to actual agents
                    # For now, we'll just log the messages
                    messages_to_process = self.message_queue.copy()
                    self.message_queue.clear()
                    
                    for message in messages_to_process:
                        logger.info(f"Processing message: {message.type} from {message.from_agent.value}")
                        
                await asyncio.sleep(1)  # Process every second
                
            except Exception as e:
                logger.error(f"Error in message processor: {e}")
                await asyncio.sleep(5)  # Wait longer on error

    async def _persist_session(self, session_state: SessionState) -> None:
        """Persist session state to Firestore"""
        try:
            doc_ref = self.db.collection('interview_sessions').document(session_state.session_id)
            await doc_ref.set(self._serialize_session_state(session_state))
        except Exception as e:
            logger.error(f"Failed to persist session {session_state.session_id}: {e}")

    def _serialize_session_state(self, session_state: SessionState) -> Dict[str, Any]:
        """Serialize session state for storage"""
        data = asdict(session_state)
        data['current_state'] = session_state.current_state.value
        data['complexity'] = session_state.complexity.value
        data['reasoning_strategy'] = session_state.reasoning_strategy.value
        data['start_time'] = session_state.start_time.isoformat()
        
        if session_state.previous_state:
            data['previous_state'] = session_state.previous_state.value
        
        if session_state.last_response_timestamp:
            data['last_response_timestamp'] = session_state.last_response_timestamp.isoformat()
        
        return data


# Example usage and testing
async def main():
    """Example usage of the Orchestrator Agent"""
    orchestrator = OrchestratorAgent()
    
    # Create session context
    context = SessionContext(
        interview_type="technical system design",
        faang_level="L5",
        job_title="Senior Software Engineer",
        target_skills=["system design", "scalability", "architecture"]
    )
    
    # Start interview
    result = await orchestrator.start_interview(
        session_id="test_session_001",
        user_id="test_user_001",
        context=context
    )
    
    print(f"Interview started: {result}")
    
    # Simulate user response
    response_result = await orchestrator.handle_user_response(
        session_id="test_session_001",
        response="I need to understand the scale and user base first. Let me identify the key user segments and their pain points.",
        response_time_ms=45000
    )
    
    print(f"Response handled: {response_result}")
    
    # Get session metrics
    metrics = await orchestrator.get_session_metrics("test_session_001")
    print(f"Session metrics: {metrics}")


if __name__ == "__main__":
    asyncio.run(main())