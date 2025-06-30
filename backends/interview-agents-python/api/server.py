"""
FastAPI server for Python ADK agents.
Provides HTTP endpoints that integrate with Go gateway functions.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

from ..agents.orchestrator import OrchestratorAgent
from ..agents.context import ContextAgent  
from ..agents.evaluator import EvaluatorAgent
from ..agents.synthesis import SynthesisAgent
from ..common.config import AgentName, settings, config_manager
from ..common.telemetry import SessionTracker, init_telemetry
from ..common.auth import FirestoreClient
from .middleware import (
    AuthenticationMiddleware,
    TelemetryMiddleware,
    RequestIDMiddleware,
    get_current_user
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global agent instances
agents: Dict[AgentName, Any] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("Starting Python ADK Agent API Server")
    
    # Initialize telemetry
    init_telemetry()
    
    # Initialize agents
    try:
        agents[AgentName.ORCHESTRATOR] = OrchestratorAgent()
        agents[AgentName.CONTEXT] = ContextAgent()
        agents[AgentName.EVALUATOR] = EvaluatorAgent()
        agents[AgentName.SYNTHESIS] = SynthesisAgent()
        
        logger.info("All agents initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize agents: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down Python ADK Agent API Server")
    for agent in agents.values():
        try:
            await agent.shutdown()
        except Exception as e:
            logger.error(f"Error shutting down agent: {e}")

# Create FastAPI app
app = FastAPI(
    title="InterviewAI Python Agent API",
    description="API server for Python ADK agents with Go gateway integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add custom middleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(TelemetryMiddleware)
app.add_middleware(AuthenticationMiddleware)

# CORS middleware (add last to ensure it runs first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class StartInterviewRequest(BaseModel):
    """Request model for starting an interview."""
    interviewType: str = Field(..., description="Type of interview")
    faangLevel: str = Field(..., description="Target FAANG level") 
    resume: Optional[Dict[str, Any]] = Field(None, description="Parsed resume data")
    jobDescription: Optional[str] = Field(None, description="Job description")
    targetCompany: Optional[str] = Field(None, description="Target company")
    user_id: str = Field(..., description="User ID from authentication")
    type: str = Field(default="start_interview")

class InterviewResponseRequest(BaseModel):
    """Request model for interview responses."""
    response: str = Field(..., description="User's interview response")
    responseTime: Optional[float] = Field(None, description="Response time in seconds")
    session_id: str = Field(..., description="Session ID")
    user_id: str = Field(..., description="User ID")
    type: str = Field(default="user_response")

# Use the middleware-based authentication
def get_user_id(request: Request) -> str:
    """Extract user ID from request state (set by middleware)."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in request state")
    return user_id

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    try:
        # Check agent health
        agent_health = {}
        for agent_name, agent in agents.items():
            health_info = await agent.healthcheck()
            agent_health[agent_name.value] = health_info
        
        # Determine overall status
        all_healthy = all(
            health.get("status") == "active" 
            for health in agent_health.values()
        )
        
        status = "healthy" if all_healthy else "degraded"
        
        return {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "agents": agent_health,
            "infrastructure": {
                "telemetry": settings.enable_telemetry,
                "circuitBreakers": "enabled" if settings.enable_circuit_breaker else "disabled",
                "database": "firestore"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

# Interview endpoints
@app.post("/interview/start")
async def start_interview(
    request: StartInterviewRequest,
    user_id: str = Depends(get_user_id)
):
    """Start a new interview session."""
    try:
        logger.info(f"Starting interview for user {user_id}")
        
        orchestrator = agents[AgentName.ORCHESTRATOR]
        
        # Generate session ID
        session_id = f"session_{user_id}_{int(datetime.now().timestamp())}"
        
        # Initialize session
        await orchestrator.initialize(
            session_id=session_id,
            user_id=user_id,
            interview_type=request.interviewType,
            faang_level=request.faangLevel,
            resume=request.resume,
            job_description=request.jobDescription,
            target_company=request.targetCompany
        )
        
        # Start interview
        result = await orchestrator.process_request({
            "type": "start_interview",
            "session_id": session_id,
            "user_id": user_id,
            "interview_type": request.interviewType,
            "faang_level": request.faangLevel,
            "resume": request.resume,
            "job_description": request.jobDescription,
            "target_company": request.targetCompany
        })
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        logger.info(f"Interview started successfully for user {user_id}, session {session_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start interview for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")

@app.post("/interview/{session_id}/respond")
async def submit_interview_response(
    session_id: str,
    request: InterviewResponseRequest,
    user_id: str = Depends(get_user_id)
):
    """Submit a user response to the interview."""
    try:
        logger.info(f"Processing response for user {user_id}, session {session_id}")
        
        orchestrator = agents[AgentName.ORCHESTRATOR]
        
        # Process the response
        result = await orchestrator.process_request({
            "type": "user_response",
            "session_id": session_id,
            "user_id": user_id,
            "response": request.response,
            "response_time": request.responseTime
        })
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        logger.info(f"Response processed successfully for session {session_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process response for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process response: {str(e)}")

@app.get("/interview/{session_id}/status")
async def get_interview_status(
    session_id: str,
    user_id: str = Depends(get_user_id)
):
    """Get current status of an interview session."""
    try:
        logger.info(f"Getting status for user {user_id}, session {session_id}")
        
        orchestrator = agents[AgentName.ORCHESTRATOR]
        
        # Get session status
        result = await orchestrator.process_request({
            "type": "get_status",
            "session_id": session_id,
            "user_id": user_id
        })
        
        if "error" in result:
            if "Invalid or missing session_id" in result["error"]:
                raise HTTPException(status_code=404, detail="Session not found")
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get status for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@app.post("/interview/{session_id}/end")
async def end_interview(
    session_id: str,
    user_id: str = Depends(get_user_id)
):
    """End an interview session."""
    try:
        logger.info(f"Ending interview for user {user_id}, session {session_id}")
        
        orchestrator = agents[AgentName.ORCHESTRATOR]
        
        # End the interview
        result = await orchestrator.process_request({
            "type": "end_interview",
            "session_id": session_id,
            "user_id": user_id
        })
        
        if "error" in result:
            if "Invalid or missing session_id" in result["error"]:
                raise HTTPException(status_code=404, detail="Session not found")
            raise HTTPException(status_code=500, detail=result["error"])
        
        logger.info(f"Interview ended successfully for session {session_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to end interview for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to end interview: {str(e)}")

@app.get("/report/{session_id}")
async def get_interview_report(
    session_id: str,
    format: str = "json",
    user_id: str = Depends(get_user_id)
):
    """Get final interview report."""
    try:
        logger.info(f"Getting report for user {user_id}, session {session_id}, format {format}")
        
        synthesis_agent = agents[AgentName.SYNTHESIS]
        
        # Get the report
        result = await synthesis_agent.process_request({
            "type": "get_report",
            "session_id": session_id,
            "user_id": user_id,
            "format": format
        })
        
        if "error" in result:
            if "not found" in result["error"].lower():
                raise HTTPException(status_code=404, detail="Report not found")
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get report for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": exc.status_code,
            "success": False
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "code": 500,
            "success": False
        }
    )

# Development server
if __name__ == "__main__":
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        reload=True if settings.environment.value == "development" else False,
        log_level="info"
    )