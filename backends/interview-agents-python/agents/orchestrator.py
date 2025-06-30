"""Orchestrator Agent - Main coordination agent for interview sessions."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, field

import google.generativeai as genai
from google.cloud import aiplatform

from .base import BaseAgent, AgentMessage, MessageType, MessagePriority
from common.config import (
    AgentName, ComplexityLevel, ReasoningStrategy, 
    get_reasoning_strategy, settings
)
from common.telemetry import (
    SessionTracker, trace_agent_operation, record_state_transition,
    record_complexity_assessment, trace_ai_operation, calculate_ai_cost
)
from .prompt_portfolio import prompt_portfolio, PromptType

logger = logging.getLogger(__name__)


class InterviewState(str, Enum):
    """Interview session states."""
    CONFIGURING = "configuring"
    SCOPING = "scoping" 
    ANALYSIS = "analysis"
    SOLUTIONING = "solutioning"
    METRICS = "metrics"
    CHALLENGING = "challenging"
    REPORT_GENERATION = "report_generation"
    END = "end"


class InterventionType(str, Enum):
    """Types of interventions the orchestrator can make."""
    PREVENT_PREMATURE_SOLUTIONING = "prevent_premature_solutioning"
    ENSURE_USER_FOCUS = "ensure_user_focus"
    DEMAND_PRIORITIZATION_RATIONALE = "demand_prioritization_rationale"
    REQUIRE_MEASURABLE_METRICS = "require_measurable_metrics"
    HANDLE_SILENCE_OR_CONFUSION = "handle_silence_or_confusion"


@dataclass
class InterventionDirective:
    """Directive for agent intervention."""
    type: InterventionType
    message: str
    context: Dict[str, Any] = field(default_factory=dict)
    priority: MessagePriority = MessagePriority.HIGH
    triggered_at: datetime = field(default_factory=datetime.now)


@dataclass
class SessionContext:
    """Context information for an interview session."""
    session_id: str
    user_id: str
    interview_type: str
    faang_level: str
    resume: Optional[Dict[str, Any]] = None
    job_description: Optional[str] = None
    target_company: Optional[str] = None
    
    # Runtime context
    complexity: ComplexityLevel = ComplexityLevel.MEDIUM
    reasoning_strategy: ReasoningStrategy = ReasoningStrategy.COT
    current_state: InterviewState = InterviewState.CONFIGURING
    previous_state: Optional[InterviewState] = None
    
    # Timeline tracking
    start_time: datetime = field(default_factory=datetime.now)
    state_transitions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Performance tracking
    scores: Dict[str, float] = field(default_factory=dict)
    interventions: List[InterventionDirective] = field(default_factory=list)
    
    # User interaction
    last_user_response: Optional[str] = None
    last_response_timestamp: Optional[datetime] = None
    silence_duration: float = 0.0


class OrchestratorAgent(BaseAgent):
    """
    Orchestrator Agent for managing interview sessions.
    
    This agent coordinates all other agents and manages the interview flow,
    state transitions, and interventions based on user behavior and performance.
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.ORCHESTRATOR, session_tracker)
        
        # Session management
        self.active_sessions: Dict[str, SessionContext] = {}
        
        # State machine configuration
        self.state_transitions = self._setup_state_machine()
        
        # Intervention rules
        self.intervention_rules = self._setup_intervention_rules()
        
        # AI client setup
        self._setup_ai_client()
        
        logger.info("Orchestrator Agent initialized")
    
    def _setup_ai_client(self):
        """Set up Google AI client."""
        try:
            # Configure Vertex AI
            aiplatform.init(
                project=settings.gcp_project_id,
                location=settings.vertex_ai_location
            )
            
            # Configure Generative AI
            genai.configure(api_key=None)  # Will use Application Default Credentials
            
            self.model = genai.GenerativeModel(settings.default_model)
            
        except Exception as e:
            logger.error(f"Failed to setup AI client: {e}")
            self.model = None
    
    def _setup_state_machine(self) -> Dict[InterviewState, List[InterviewState]]:
        """Setup valid state transitions matching Phase 3 specifications."""
        return {
            # Primary flow
            InterviewState.CONFIGURING: [InterviewState.SCOPING],
            InterviewState.SCOPING: [InterviewState.ANALYSIS, InterviewState.CHALLENGING],
            InterviewState.ANALYSIS: [InterviewState.SOLUTIONING, InterviewState.CHALLENGING],
            InterviewState.SOLUTIONING: [InterviewState.METRICS, InterviewState.CHALLENGING],
            InterviewState.METRICS: [InterviewState.CHALLENGING, InterviewState.REPORT_GENERATION],
            InterviewState.CHALLENGING: [
                InterviewState.ANALYSIS,
                InterviewState.SOLUTIONING, 
                InterviewState.REPORT_GENERATION
            ],
            InterviewState.REPORT_GENERATION: [InterviewState.END],
            InterviewState.END: []
        }
    
    def _setup_intervention_rules(self) -> Dict[InterventionType, Dict[str, Any]]:
        """Setup intervention rules matching Phase 3 specifications exactly."""
        return {
            InterventionType.PREVENT_PREMATURE_SOLUTIONING: {
                "condition": "candidate is in SCOPING state AND response contains solution_keywords AND Evaluator score for 'Problem Definition & Structuring' < 3",
                "solution_keywords": ["solution", "implement", "build", "code", "develop", "my approach would be"],
                "directive": "The candidate is jumping to a solution too early. Gently guide them back. **Say this:** 'That's an interesting idea. Before we dive into solutions, could you first walk me through how you're structuring your overall approach to this problem?'",
                "states": [InterviewState.SCOPING]
            },
            InterventionType.ENSURE_USER_FOCUS: {
                "condition": "candidate is in ANALYSIS state AND has not mentioned user_keywords after several turns",
                "user_keywords": ["user", "customer", "persona", "audience", "stakeholder"],
                "directive": "The candidate's analysis is not user-centric. Prompt them to focus on the user. **Say this:** 'This is a good start. Could you tell me more about the specific users or customers you are designing this for?'",
                "states": [InterviewState.ANALYSIS]
            },
            InterventionType.DEMAND_PRIORITIZATION_RATIONALE: {
                "condition": "candidate is in SOLUTIONING state AND has proposed solution without explaining why they chose it",
                "directive": "The candidate has not justified their prioritization. Probe for their rationale. **Say this:** 'That sounds like a viable solution. Can you walk me through why you chose this particular solution over other alternatives you may have considered?'",
                "states": [InterviewState.SOLUTIONING]
            },
            InterventionType.REQUIRE_MEASURABLE_METRICS: {
                "condition": "candidate is in METRICS state AND has proposed vague metrics AND Evaluator score for 'Success Metrics' < 3",
                "vague_keywords": ["engagement", "success", "good", "better", "improvement"],
                "directive": "The candidate's metrics are too vague. Push for specificity. **Say this:** 'That makes sense. Could you define 'engagement' more specifically? What is the single most important metric you would track as your North Star?'",
                "states": [InterviewState.METRICS]
            },
            InterventionType.HANDLE_SILENCE_OR_CONFUSION: {
                "condition": "user has not responded for more than 15 seconds OR response contains confusion keywords",
                "confusion_keywords": ["I'm not sure", "I don't understand", "confused", "unclear"],
                "silence_threshold": 15,  # seconds
                "directive": "The candidate seems stuck. Offer a gentle nudge to help them proceed. **Say this:** 'This is a challenging problem. Why don't we start by identifying the main goal of the business in this scenario? What are they trying to achieve?'",
                "states": ["all"]
            }
        }
    
    async def initialize(self, session_id: str, **kwargs):
        """Initialize orchestrator for a new session."""
        await super().initialize(session_id, **kwargs)
        
        # Create session context
        context = SessionContext(
            session_id=session_id,
            user_id=kwargs.get("user_id", ""),
            interview_type=kwargs.get("interview_type", "technical"),
            faang_level=kwargs.get("faang_level", "L4"),
            resume=kwargs.get("resume"),
            job_description=kwargs.get("job_description"),
            target_company=kwargs.get("target_company")
        )
        
        self.active_sessions[session_id] = context
        
        logger.info(f"Orchestrator initialized for session {session_id}")
    
    @trace_agent_operation("process_request", AgentName.ORCHESTRATOR)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming requests."""
        request_type = request.get("type")
        session_id = request.get("session_id")
        
        if not session_id or session_id not in self.active_sessions:
            return {"error": "Invalid or missing session_id"}
        
        context = self.active_sessions[session_id]
        
        handlers = {
            "start_interview": self._start_interview,
            "user_response": self._handle_user_response,
            "state_transition": self._handle_state_transition,
            "get_status": self._get_session_status,
            "end_interview": self._end_interview
        }
        
        handler = handlers.get(request_type)
        if not handler:
            return {"error": f"Unknown request type: {request_type}"}
        
        try:
            return await handler(context, request)
        except Exception as e:
            logger.error(f"Error processing request {request_type}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.session_id not in self.active_sessions:
            logger.warning(f"Received message for unknown session: {message.session_id}")
            return None
        
        context = self.active_sessions[message.session_id]
        
        # Route message based on type and source agent
        if message.type == MessageType.RESPONSE:
            await self._handle_agent_response(context, message)
        elif message.type == MessageType.NOTIFICATION:
            await self._handle_agent_notification(context, message)
        elif message.type == MessageType.ERROR:
            await self._handle_agent_error(context, message)
        
        return None  # Orchestrator typically doesn't send immediate responses
    
    async def _start_interview(
        self, 
        context: SessionContext, 
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Start the interview process."""
        
        # Assess initial complexity
        complexity = await self._assess_complexity(context)
        context.complexity = complexity
        context.reasoning_strategy = get_reasoning_strategy(complexity)
        
        # Record complexity assessment
        record_complexity_assessment(
            complexity, 
            self._calculate_complexity_score(context),
            context.session_id
        )
        
        # Transition to scoping state
        await self._transition_state(
            context, 
            InterviewState.SCOPING, 
            "interview_start"
        )
        
        # Initialize other agents
        await self._initialize_agents(context)
        
        # Get initial question from Interviewer agent
        initial_question = await self._request_initial_question(context)
        
        return {
            "success": True,
            "session_id": context.session_id,
            "state": context.current_state.value,
            "complexity": context.complexity.value,
            "reasoning_strategy": context.reasoning_strategy.value,
            "initial_question": initial_question,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _handle_user_response(
        self, 
        context: SessionContext, 
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle user response and coordinate agent actions."""
        user_response = request.get("response", "")
        response_time = request.get("response_time", 0)
        
        # Update context
        context.last_user_response = user_response
        context.last_response_timestamp = datetime.now()
        context.silence_duration = 0.0
        
        # Check for interventions
        interventions = await self._check_interventions(context, user_response)
        
        if interventions:
            # Apply interventions
            for intervention in interventions:
                await self._apply_intervention(context, intervention)
            
            return {
                "success": True,
                "interventions": [
                    {
                        "type": i.type.value,
                        "message": i.message,
                        "priority": i.priority.value
                    } for i in interventions
                ],
                "state": context.current_state.value
            }
        
        # Normal processing flow
        tasks = []
        
        # Send to Context agent for context update
        tasks.append(self.send_message(
            AgentName.CONTEXT,
            MessageType.REQUEST,
            {
                "action": "update_context",
                "user_response": user_response,
                "response_time": response_time,
                "current_state": context.current_state.value
            }
        ))
        
        # Send to Evaluator for real-time assessment
        tasks.append(self.send_message(
            AgentName.EVALUATOR,
            MessageType.REQUEST,
            {
                "action": "evaluate_response",
                "user_response": user_response,
                "response_time": response_time,
                "context": {
                    "state": context.current_state.value,
                    "complexity": context.complexity.value,
                    "interview_type": context.interview_type
                }
            }
        ))
        
        # Send to Interviewer for next question
        tasks.append(self.send_message(
            AgentName.INTERVIEWER,
            MessageType.REQUEST,
            {
                "action": "generate_followup",
                "user_response": user_response,
                "context": {
                    "state": context.current_state.value,
                    "complexity": context.complexity.value,
                    "reasoning_strategy": context.reasoning_strategy.value
                }
            }
        ))
        
        # Execute all tasks concurrently
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check if state transition is needed
        next_state = await self._determine_next_state(context, user_response)
        if next_state and next_state != context.current_state:
            await self._transition_state(context, next_state, "semantic")
        
        return {
            "success": True,
            "state": context.current_state.value,
            "processing": "agents_notified",
            "timestamp": datetime.now().isoformat()
        }
    
    async def _assess_complexity(self, context: SessionContext) -> ComplexityLevel:
        """Assess interview complexity based on context."""
        
        # Factors for complexity assessment
        factors = {
            "faang_level": {
                "L3": 1, "L4": 2, "L5": 3, "L6": 4, "L7": 5
            },
            "interview_type": {
                "behavioral": 1,
                "technical": 2,
                "system design": 4,
                "leadership": 3
            }
        }
        
        # Calculate base score
        level_score = factors["faang_level"].get(context.faang_level, 2)
        type_score = factors["interview_type"].get(context.interview_type.lower(), 2)
        
        # Additional complexity from resume/job description
        context_score = 0
        if context.resume:
            # More experience = higher complexity expectations
            years_exp = context.resume.get("years_experience", 0)
            context_score += min(years_exp // 2, 2)
        
        total_score = level_score + type_score + context_score
        
        # Map to complexity levels
        if total_score <= 3:
            return ComplexityLevel.LOW
        elif total_score <= 5:
            return ComplexityLevel.MEDIUM
        elif total_score <= 7:
            return ComplexityLevel.HIGH
        else:
            return ComplexityLevel.VERY_HIGH
    
    def _calculate_complexity_score(self, context: SessionContext) -> float:
        """Calculate numerical complexity score for metrics."""
        factors = {
            "L3": 0.2, "L4": 0.4, "L5": 0.6, "L6": 0.8, "L7": 1.0
        }
        
        base_score = factors.get(context.faang_level, 0.4)
        
        # Adjust based on interview type
        type_multipliers = {
            "behavioral": 0.8,
            "technical": 1.0,
            "system design": 1.4,
            "leadership": 1.2
        }
        
        multiplier = type_multipliers.get(context.interview_type.lower(), 1.0)
        return min(base_score * multiplier, 1.0)
    
    async def _check_interventions(
        self, 
        context: SessionContext, 
        user_response: str
    ) -> List[InterventionDirective]:
        """Check if any interventions are needed."""
        interventions = []
        
        # Check silence/confusion
        if context.silence_duration > 30:
            interventions.append(InterventionDirective(
                type=InterventionType.HANDLE_SILENCE_OR_CONFUSION,
                message="I notice you've been quiet. Would you like me to clarify the question or provide a hint?"
            ))
        
        # Check for premature solutioning
        if context.current_state in [InterviewState.SCOPING, InterviewState.ANALYSIS]:
            premature_keywords = ["solution", "implement", "build", "code"]
            if any(keyword in user_response.lower() for keyword in premature_keywords):
                time_in_analysis = (datetime.now() - context.start_time).total_seconds()
                if time_in_analysis < 300:  # Less than 5 minutes
                    interventions.append(InterventionDirective(
                        type=InterventionType.PREVENT_PREMATURE_SOLUTIONING,
                        message="Let's take a step back. Before jumping to solutions, can you help me understand the problem requirements and constraints better?"
                    ))
        
        # Check for missing prioritization rationale
        if context.current_state == InterviewState.SOLUTIONING:
            priority_keywords = ["priority", "important", "first", "order"]
            if any(keyword in user_response.lower() for keyword in priority_keywords):
                if "because" not in user_response.lower() and "reason" not in user_response.lower():
                    interventions.append(InterventionDirective(
                        type=InterventionType.DEMAND_PRIORITIZATION_RATIONALE,
                        message="You mentioned priorities. Can you explain the reasoning behind this prioritization?"
                    ))
        
        return interventions
    
    async def _apply_intervention(
        self, 
        context: SessionContext, 
        intervention: InterventionDirective
    ):
        """Apply an intervention."""
        context.interventions.append(intervention)
        
        # Send intervention to Interviewer agent to incorporate into next question
        await self.send_message(
            AgentName.INTERVIEWER,
            MessageType.NOTIFICATION,
            {
                "intervention": {
                    "type": intervention.type.value,
                    "message": intervention.message,
                    "context": intervention.context
                }
            },
            priority=intervention.priority
        )
        
        logger.info(f"Applied intervention {intervention.type.value} for session {context.session_id}")
    
    async def _determine_next_state(
        self, 
        context: SessionContext, 
        user_response: str
    ) -> Optional[InterviewState]:
        """Determine if state transition is needed based on user response."""
        
        # Use AI to analyze response and determine appropriate next state
        if not self.model:
            return None
        
        try:
            with trace_ai_operation("state_analysis", settings.default_model, context.session_id) as span:
                prompt = self._create_state_analysis_prompt(context, user_response)
                
                response = await self.model.generate_content_async(prompt)
                result = response.text.strip().lower()
                
                # Parse AI response
                for state in InterviewState:
                    if state.value in result and state in self.state_transitions.get(context.current_state, []):
                        span.set_attribute("recommended_state", state.value)
                        return state
                
        except Exception as e:
            logger.error(f"Error in state analysis: {e}")
        
        return None
    
    def _create_state_analysis_prompt(self, context: SessionContext, user_response: str) -> str:
        """Create prompt for AI state analysis."""
        return f"""
        Analyze this interview response and recommend the next state.
        
        Current State: {context.current_state.value}
        Interview Type: {context.interview_type}
        FAANG Level: {context.faang_level}
        Complexity: {context.complexity.value}
        
        User Response: "{user_response}"
        
        Available next states: {[s.value for s in self.state_transitions.get(context.current_state, [])]}
        
        Respond with just the recommended state name, or "stay" to remain in current state.
        
        Guidelines:
        - Move to "analysis" if user shows good problem understanding
        - Move to "solutioning" if analysis is thorough
        - Move to "metrics" if solution approach is solid
        - Move to "challenging" if user needs deeper probing
        - Stay in current state if more exploration needed
        """
    
    async def _transition_state(
        self, 
        context: SessionContext, 
        new_state: InterviewState, 
        trigger: str
    ):
        """Transition to a new interview state."""
        old_state = context.current_state
        transition_time = datetime.now()
        
        # Validate transition
        if new_state not in self.state_transitions.get(old_state, []):
            logger.warning(f"Invalid state transition: {old_state.value} -> {new_state.value}")
            return
        
        # Update context
        context.previous_state = old_state
        context.current_state = new_state
        
        # Record transition
        context.state_transitions.append({
            "from_state": old_state.value,
            "to_state": new_state.value,
            "trigger": trigger,
            "timestamp": transition_time,
            "duration_in_previous": (transition_time - context.start_time).total_seconds()
        })
        
        # Record telemetry
        record_state_transition(
            old_state.value,
            new_state.value,
            trigger,
            context.session_id,
            (transition_time - context.start_time).total_seconds()
        )
        
        # Notify all agents of state change
        await self._notify_state_change(context, old_state, new_state)
        
        logger.info(f"State transition: {old_state.value} -> {new_state.value} (trigger: {trigger})")
    
    async def _notify_state_change(
        self, 
        context: SessionContext,
        old_state: InterviewState,
        new_state: InterviewState
    ):
        """Notify all agents of state change."""
        notification_payload = {
            "event": "state_change",
            "old_state": old_state.value,
            "new_state": new_state.value,
            "session_context": {
                "complexity": context.complexity.value,
                "reasoning_strategy": context.reasoning_strategy.value,
                "interview_type": context.interview_type,
                "faang_level": context.faang_level
            }
        }
        
        # Notify all other agents
        agents_to_notify = [
            AgentName.CONTEXT,
            AgentName.INTERVIEWER, 
            AgentName.EVALUATOR,
            AgentName.SYNTHESIS
        ]
        
        tasks = [
            self.send_message(
                agent,
                MessageType.NOTIFICATION,
                notification_payload,
                priority=MessagePriority.HIGH
            )
            for agent in agents_to_notify
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _initialize_agents(self, context: SessionContext):
        """Initialize all other agents for the session."""
        init_payload = {
            "action": "initialize_session",
            "session_context": {
                "session_id": context.session_id,
                "user_id": context.user_id,
                "interview_type": context.interview_type,
                "faang_level": context.faang_level,
                "complexity": context.complexity.value,
                "reasoning_strategy": context.reasoning_strategy.value,
                "resume": context.resume,
                "job_description": context.job_description
            }
        }
        
        agents_to_init = [
            AgentName.CONTEXT,
            AgentName.INTERVIEWER,
            AgentName.EVALUATOR,
            AgentName.SYNTHESIS
        ]
        
        tasks = [
            self.send_message(agent, MessageType.REQUEST, init_payload)
            for agent in agents_to_init
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _request_initial_question(self, context: SessionContext) -> str:
        """Request initial question from Interviewer agent."""
        # For now, return a placeholder - in production this would wait for Interviewer response
        return f"Let's start with a {context.interview_type} question appropriate for {context.faang_level} level. Tell me about a challenging project you've worked on recently."
    
    async def _handle_agent_response(self, context: SessionContext, message: AgentMessage):
        """Handle response from other agents."""
        from_agent = message.from_agent
        payload = message.payload
        
        if from_agent == AgentName.EVALUATOR:
            # Update scores from evaluator
            scores = payload.get("scores", {})
            context.scores.update(scores)
            
        elif from_agent == AgentName.CONTEXT:
            # Update context information
            context_updates = payload.get("context_updates", {})
            # Apply updates to context
            
        # Log agent response for monitoring
        logger.info(f"Received response from {from_agent.value}: {payload.get('action', 'unknown')}")
    
    async def _handle_agent_notification(self, context: SessionContext, message: AgentMessage):
        """Handle notification from other agents."""
        # Process notifications (e.g., agent status updates, warnings)
        logger.info(f"Notification from {message.from_agent.value}: {message.payload}")
    
    async def _handle_agent_error(self, context: SessionContext, message: AgentMessage):
        """Handle error from other agents."""
        error_info = message.payload
        logger.error(f"Error from {message.from_agent.value}: {error_info}")
        
        # Implement fallback strategies based on which agent failed
        # This could involve switching to degraded mode or alternative agents
    
    async def _get_session_status(
        self, 
        context: SessionContext, 
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get current session status."""
        return {
            "session_id": context.session_id,
            "current_state": context.current_state.value,
            "complexity": context.complexity.value,
            "reasoning_strategy": context.reasoning_strategy.value,
            "duration_seconds": (datetime.now() - context.start_time).total_seconds(),
            "state_transitions": len(context.state_transitions),
            "interventions": len(context.interventions),
            "scores": context.scores,
            "last_activity": context.last_response_timestamp.isoformat() if context.last_response_timestamp else None
        }
    
    async def _end_interview(
        self, 
        context: SessionContext, 
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """End the interview session."""
        # Transition to END state
        await self._transition_state(context, InterviewState.END, "user_action")
        
        # Request final report from Synthesis agent
        await self.send_message(
            AgentName.SYNTHESIS,
            MessageType.REQUEST,
            {
                "action": "generate_report",
                "session_context": {
                    "session_id": context.session_id,
                    "scores": context.scores,
                    "interventions": context.interventions,
                    "state_transitions": context.state_transitions,
                    "duration": (datetime.now() - context.start_time).total_seconds()
                }
            },
            priority=MessagePriority.HIGH
        )
        
        # Clean up session
        session_summary = {
            "session_id": context.session_id,
            "total_duration": (datetime.now() - context.start_time).total_seconds(),
            "final_scores": context.scores,
            "interventions_count": len(context.interventions),
            "state_transitions_count": len(context.state_transitions),
            "complexity": context.complexity.value,
            "reasoning_strategy": context.reasoning_strategy.value
        }
        
        # Keep session for a short while for final report generation
        # In production, this would be cleaned up after report is complete
        
        return {
            "success": True,
            "session_summary": session_summary,
            "message": "Interview completed. Generating final report..."
        }
    
    async def _route_with_adaptive_prompting(
        self, 
        target_agent: AgentName, 
        action: str, 
        payload: Dict[str, Any],
        complexity: ComplexityLevel,
        session_id: str
    ) -> Dict[str, Any]:
        """Route request to agent using complexity-appropriate prompt."""
        
        # Get appropriate prompt from portfolio
        prompt_variant = prompt_portfolio.get_prompt(target_agent, complexity, action)
        
        if prompt_variant:
            # Add prompt guidance to payload
            payload["prompt_variant"] = {
                "id": prompt_variant.id,
                "type": prompt_variant.prompt_type.value,
                "template": prompt_variant.template,
                "complexity": complexity.value
            }
            
            logger.info(f"Using {prompt_variant.prompt_type.value} prompt for {target_agent.value} at {complexity.value} complexity")
        
        # Send message with adaptive prompt guidance
        success = await self.send_message(
            target_agent,
            MessageType.REQUEST,
            payload,
            priority=MessagePriority.HIGH
        )
        
        return {
            "success": success,
            "prompt_used": prompt_variant.id if prompt_variant else "default",
            "routing_strategy": "adaptive_complexity"
        }
    
    async def _enhanced_agent_coordination(
        self, 
        context: SessionContext, 
        user_response: str
    ) -> Dict[str, Any]:
        """Enhanced agent coordination with adaptive prompting."""
        
        # Assess response complexity first
        response_complexity = await self._assess_response_complexity(user_response, context)
        
        # Update context complexity if needed
        if response_complexity != context.complexity:
            context.complexity = response_complexity
            context.reasoning_strategy = get_reasoning_strategy(response_complexity)
            
            logger.info(f"Complexity updated to {response_complexity.value}, strategy: {context.reasoning_strategy.value}")
        
        # Route to agents with appropriate prompts
        tasks = [
            self._route_with_adaptive_prompting(
                AgentName.CONTEXT,
                "update_context", 
                {
                    "user_response": user_response,
                    "current_state": context.current_state.value,
                    "session_context": context.__dict__
                },
                context.complexity,
                context.session_id
            ),
            self._route_with_adaptive_prompting(
                AgentName.EVALUATOR,
                "evaluate_response",
                {
                    "user_response": user_response,
                    "interview_context": {
                        "state": context.current_state.value,
                        "complexity": context.complexity.value,
                        "interview_type": context.interview_type,
                        "faang_level": context.faang_level
                    }
                },
                context.complexity,
                context.session_id
            )
        ]
        
        # Execute with adaptive prompting
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "adaptive_routing_used": True,
            "complexity_assessed": context.complexity.value,
            "reasoning_strategy": context.reasoning_strategy.value,
            "agent_responses": len([r for r in results if not isinstance(r, Exception)])
        }
    
    async def _assess_response_complexity(
        self, 
        user_response: str, 
        context: SessionContext
    ) -> ComplexityLevel:
        """Assess complexity of user response to adjust prompting strategy."""
        
        # Multi-factor complexity assessment
        factors = {
            "length": self._assess_response_length(user_response),
            "technical_depth": self._assess_technical_depth(user_response),
            "structure": self._assess_response_structure(user_response),
            "context_level": self._assess_context_complexity(context)
        }
        
        # Weighted scoring
        complexity_score = (
            factors["length"] * 0.2 +
            factors["technical_depth"] * 0.3 +
            factors["structure"] * 0.3 +
            factors["context_level"] * 0.2
        )
        
        # Map score to complexity level
        if complexity_score >= 0.8:
            return ComplexityLevel.VERY_HIGH
        elif complexity_score >= 0.6:
            return ComplexityLevel.HIGH
        elif complexity_score >= 0.4:
            return ComplexityLevel.MEDIUM
        else:
            return ComplexityLevel.LOW
    
    def _assess_response_length(self, response: str) -> float:
        """Assess complexity based on response length."""
        word_count = len(response.split())
        
        if word_count < 20:
            return 0.1
        elif word_count < 50:
            return 0.3
        elif word_count < 150:
            return 0.6
        elif word_count < 300:
            return 0.8
        else:
            return 1.0
    
    def _assess_technical_depth(self, response: str) -> float:
        """Assess technical depth of response."""
        technical_indicators = [
            "algorithm", "complexity", "scalability", "architecture", "database",
            "optimization", "performance", "trade-off", "bottleneck", "latency",
            "throughput", "concurrent", "distributed", "microservice", "api"
        ]
        
        response_lower = response.lower()
        technical_count = sum(1 for indicator in technical_indicators if indicator in response_lower)
        
        return min(technical_count / 5, 1.0)  # Normalize to 0-1
    
    def _assess_response_structure(self, response: str) -> float:
        """Assess structural sophistication of response."""
        structure_indicators = [
            "first", "second", "then", "next", "finally", "because", "therefore",
            "however", "additionally", "furthermore", "in contrast", "for example"
        ]
        
        sentences = response.split('.')
        paragraph_breaks = response.count('\n\n')
        structure_words = sum(1 for indicator in structure_indicators if indicator in response.lower())
        
        structure_score = (
            min(len(sentences) / 10, 0.4) +  # Sentence count
            min(paragraph_breaks / 3, 0.3) +  # Paragraph structure
            min(structure_words / 5, 0.3)     # Transition words
        )
        
        return min(structure_score, 1.0)
    
    def _assess_context_complexity(self, context: SessionContext) -> float:
        """Assess complexity based on interview context."""
        level_complexity = {
            "L3": 0.2,
            "L4": 0.4, 
            "L5": 0.6,
            "L6": 0.8,
            "L7": 1.0
        }
        
        type_complexity = {
            "behavioral": 0.3,
            "technical": 0.6,
            "system design": 1.0,
            "leadership": 0.8
        }
        
        level_score = level_complexity.get(context.faang_level, 0.4)
        type_score = type_complexity.get(context.interview_type.lower(), 0.6)
        
        return (level_score + type_score) / 2