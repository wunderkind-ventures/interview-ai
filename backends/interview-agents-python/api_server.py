"""FastAPI server for Python ADK agents."""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from common.config import settings, AgentName
from common.auth import get_current_user, require_auth
from common.telemetry import SessionTracker, init_telemetry
from agents.orchestrator import OrchestratorAgent
from agents.context import ContextAgent  
from agents.evaluator import EvaluatorAgent
from agents.story_deconstructor import StoryDeconstructorAgent
from agents.impact_quantifier import ImpactQuantifierAgent
from agents.achievement_reframing import AchievementReframingAgent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global agent instances
agents: Dict[AgentName, Any] = {}
session_trackers: Dict[str, SessionTracker] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting ADK Agent Server")
    
    # Initialize telemetry
    init_telemetry()
    
    # Initialize agents
    agents[AgentName.ORCHESTRATOR] = OrchestratorAgent()
    agents[AgentName.CONTEXT] = ContextAgent()
    agents[AgentName.EVALUATOR] = EvaluatorAgent()
    
    # Initialize Narrative Refinement Module agents
    agents["story_deconstructor"] = StoryDeconstructorAgent()
    agents["impact_quantifier"] = ImpactQuantifierAgent()
    agents["achievement_reframing"] = AchievementReframingAgent()
    
    logger.info("All agents initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down agents")
    for agent in agents.values():
        await agent.shutdown()


# FastAPI app
app = FastAPI(
    title="Interview AI - ADK Agents",
    description="Python-based ADK agents for interview coaching",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class AgentRequest(BaseModel):
    """Base request model for agent interactions."""
    action: str
    session_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    """Base response model for agent interactions."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class SessionInitRequest(BaseModel):
    """Request to initialize a new session."""
    user_id: str
    interview_type: str = "technical"
    faang_level: str = "L4"
    resume: Optional[Dict[str, Any]] = None
    job_description: Optional[str] = None
    target_company: Optional[str] = None


class UserResponseRequest(BaseModel):
    """Request to handle user response."""
    session_id: str
    response: str
    response_time: float = 0.0


class StateTransitionRequest(BaseModel):
    """Request to transition interview state."""
    session_id: str
    new_state: str
    trigger: str = "manual"


# Narrative Refinement Module request models
class StorySubmissionRequest(BaseModel):
    """Request to submit a story for deconstruction."""
    story_text: str
    user_id: str


class StoryRefinementRequest(BaseModel):
    """Request to refine a story with additional information."""
    session_id: str
    additional_info: str


class STARReframingRequest(BaseModel):
    """Request to reframe a complete STAR story."""
    situation: str
    task: str
    action: str
    result: str
    target_company: Optional[str] = None
    job_description_snippet: Optional[str] = None
    target_role: Optional[str] = None


# Helper functions
def get_session_tracker(session_id: str, user_id: str) -> SessionTracker:
    """Get or create session tracker."""
    if session_id not in session_trackers:
        session_trackers[session_id] = SessionTracker(session_id, user_id)
    return session_trackers[session_id]


async def send_to_agent(
    agent_name: AgentName, 
    request: AgentRequest,
    user_claims: Optional[Dict[str, Any]] = None
) -> AgentResponse:
    """Send request to specific agent."""
    try:
        agent = agents.get(agent_name)
        if not agent:
            raise HTTPException(status_code=500, detail=f"Agent {agent_name.value} not available")
        
        # Add user context if available
        if user_claims and request.session_id:
            tracker = get_session_tracker(request.session_id, user_claims.get("uid", ""))
            agent.session_tracker = tracker
        
        # Process request
        result = await agent.process_request({
            "action": request.action,
            "session_id": request.session_id,
            **request.payload
        })
        
        if "error" in result:
            return AgentResponse(success=False, error=result["error"])
        
        return AgentResponse(success=True, data=result)
        
    except Exception as e:
        logger.error(f"Error sending request to {agent_name.value}: {e}")
        return AgentResponse(success=False, error=str(e))


# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    agent_status = {}
    for name, agent in agents.items():
        try:
            status = await agent.healthcheck()
            agent_status[name] = status
        except Exception as e:
            agent_status[name] = {"status": "error", "error": str(e)}
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agents": agent_status
    }


@app.post("/api/sessions/initialize")
@require_auth
async def initialize_session(
    request: SessionInitRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Initialize a new interview session."""
    session_id = f"session_{user_claims['uid']}_{int(datetime.now().timestamp())}"
    
    # Create session tracker
    tracker = get_session_tracker(session_id, user_claims["uid"])
    
    # Initialize orchestrator
    orchestrator = agents[AgentName.ORCHESTRATOR]
    orchestrator.session_tracker = tracker
    
    await orchestrator.initialize(
        session_id=session_id,
        user_id=user_claims["uid"],
        interview_type=request.interview_type,
        faang_level=request.faang_level,
        resume=request.resume,
        job_description=request.job_description,
        target_company=request.target_company
    )
    
    # Start the interview
    result = await orchestrator.process_request({
        "type": "start_interview",
        "session_id": session_id,
        "user_id": user_claims["uid"],
        "interview_type": request.interview_type,
        "faang_level": request.faang_level,
        "resume": request.resume,
        "job_description": request.job_description,
        "target_company": request.target_company
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.post("/api/sessions/{session_id}/response")
@require_auth
async def handle_user_response(
    session_id: str,
    request: UserResponseRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Handle user response in interview session."""
    # Get session tracker
    tracker = get_session_tracker(session_id, user_claims["uid"])
    
    # Send to orchestrator
    orchestrator = agents[AgentName.ORCHESTRATOR]
    orchestrator.session_tracker = tracker
    
    result = await orchestrator.process_request({
        "type": "user_response",
        "session_id": session_id,
        "response": request.response,
        "response_time": request.response_time
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.post("/api/sessions/{session_id}/state")
@require_auth
async def transition_state(
    session_id: str,
    request: StateTransitionRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Manually transition interview state."""
    tracker = get_session_tracker(session_id, user_claims["uid"])
    
    orchestrator = agents[AgentName.ORCHESTRATOR]
    orchestrator.session_tracker = tracker
    
    result = await orchestrator.process_request({
        "type": "state_transition",
        "session_id": session_id,
        "new_state": request.new_state,
        "trigger": request.trigger
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.get("/api/sessions/{session_id}/status")
@require_auth
async def get_session_status(
    session_id: str,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Get current session status."""
    tracker = get_session_tracker(session_id, user_claims["uid"])
    
    orchestrator = agents[AgentName.ORCHESTRATOR]
    orchestrator.session_tracker = tracker
    
    result = await orchestrator.process_request({
        "type": "get_status",
        "session_id": session_id
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.post("/api/sessions/{session_id}/end")
@require_auth
async def end_session(
    session_id: str,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """End interview session."""
    tracker = get_session_tracker(session_id, user_claims["uid"])
    
    orchestrator = agents[AgentName.ORCHESTRATOR]
    orchestrator.session_tracker = tracker
    
    result = await orchestrator.process_request({
        "type": "end_interview",
        "session_id": session_id
    })
    
    # Clean up session tracker
    if session_id in session_trackers:
        del session_trackers[session_id]
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


# Agent-specific endpoints
@app.post("/api/agents/orchestrator")
@require_auth
async def orchestrator_request(
    request: AgentRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Send request to Orchestrator agent."""
    return await send_to_agent(AgentName.ORCHESTRATOR, request, user_claims)


@app.post("/api/agents/context")
@require_auth
async def context_request(
    request: AgentRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Send request to Context agent."""
    return await send_to_agent(AgentName.CONTEXT, request, user_claims)


@app.post("/api/agents/evaluator")
@require_auth
async def evaluator_request(
    request: AgentRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Send request to Evaluator agent."""
    return await send_to_agent(AgentName.EVALUATOR, request, user_claims)


# Narrative Refinement Module endpoints
@app.post("/api/narrative/story/submit")
@require_auth
async def submit_story(
    request: StorySubmissionRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Submit a story for STAR deconstruction."""
    
    # Generate session ID for story refinement
    story_session_id = f"story_{user_claims['uid']}_{int(datetime.now().timestamp())}"
    
    # Send to Story Deconstructor
    agent = agents.get("story_deconstructor")
    if not agent:
        raise HTTPException(status_code=500, detail="Story Deconstructor agent not available")
    
    result = await agent.process_request({
        "action": "deconstruct_story",
        "story_text": request.story_text,
        "session_id": story_session_id
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Add session ID to response
    result["session_id"] = story_session_id
    
    return AgentResponse(success=True, data=result)


@app.post("/api/narrative/story/{session_id}/clarify")
@require_auth
async def clarify_story(
    session_id: str,
    request: StoryRefinementRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Provide additional clarification for story deconstruction."""
    
    agent = agents.get("story_deconstructor")
    if not agent:
        raise HTTPException(status_code=500, detail="Story Deconstructor agent not available")
    
    # For now, re-run deconstruction with additional info
    # In a production system, you'd append to the original story
    result = await agent.process_request({
        "action": "deconstruct_story",
        "story_text": request.additional_info,
        "session_id": session_id
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.post("/api/narrative/impact/analyze")
@require_auth
async def analyze_impact_quantification(
    request: Dict[str, Any],
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Analyze the result component for quantification."""
    
    result_text = request.get("result_text", "")
    if not result_text:
        raise HTTPException(status_code=400, detail="result_text is required")
    
    agent = agents.get("impact_quantifier")
    if not agent:
        raise HTTPException(status_code=500, detail="Impact Quantifier agent not available")
    
    result = await agent.process_request({
        "action": "analyze_quantification",
        "result_text": result_text
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.post("/api/narrative/reframe")
@require_auth
async def reframe_achievement(
    request: STARReframingRequest,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Reframe a complete STAR story into optimized formats."""
    
    agent = agents.get("achievement_reframing")
    if not agent:
        raise HTTPException(status_code=500, detail="Achievement Reframing agent not available")
    
    result = await agent.process_request({
        "action": "reframe_achievement",
        "situation": request.situation,
        "task": request.task,
        "action": request.action,
        "result": request.result,
        "target_company": request.target_company,
        "job_description_snippet": request.job_description_snippet,
        "target_role": request.target_role
    })
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return AgentResponse(success=True, data=result)


@app.get("/api/narrative/story/{session_id}/status")
@require_auth
async def get_story_status(
    session_id: str,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> AgentResponse:
    """Get the current status of a story refinement session."""
    
    # This would typically fetch from a session store
    # For now, return a simple status
    return AgentResponse(success=True, data={
        "session_id": session_id,
        "status": "active",
        "current_stage": "deconstruction"  # Could be: deconstruction, quantification, reframing, complete
    })


# Monitoring endpoints
@app.get("/api/metrics/session/{session_id}")
@require_auth
async def get_session_metrics(
    session_id: str,
    user_claims: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get session metrics and performance data."""
    if session_id not in session_trackers:
        raise HTTPException(status_code=404, detail="Session not found")
    
    tracker = session_trackers[session_id]
    return tracker.get_session_summary()


@app.get("/api/metrics/agents")
async def get_agent_metrics() -> Dict[str, Any]:
    """Get agent performance metrics."""
    metrics = {}
    
    for name, agent in agents.items():
        try:
            health = await agent.healthcheck()
            metrics[name.value] = health
        except Exception as e:
            metrics[name.value] = {"error": str(e)}
    
    return metrics


# Development/testing endpoints (remove in production)
@app.post("/api/test/message")
async def test_inter_agent_message(
    from_agent: str,
    to_agent: str,
    message_type: str,
    payload: Dict[str, Any]
):
    """Test inter-agent messaging (development only)."""
    if not settings.environment.value == "development":
        raise HTTPException(status_code=403, detail="Test endpoints only available in development")
    
    try:
        from_agent_enum = AgentName(from_agent)
        to_agent_enum = AgentName(to_agent)
        message_type_enum = MessageType(message_type)
        
        sender = agents.get(from_agent_enum)
        if not sender:
            raise HTTPException(status_code=400, detail=f"Agent {from_agent} not found")
        
        success = await sender.send_message(
            to_agent_enum,
            message_type_enum,
            payload,
            MessagePriority.NORMAL
        )
        
        return {"success": success, "message": "Message sent"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid enum value: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment.value == "development",
        log_level="info"
    )