"""
Middleware for FastAPI server to handle authentication and other cross-cutting concerns.
"""

import logging
from typing import Callable, Optional
from datetime import datetime

from fastapi import Request, Response, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..common.auth import FirebaseAuth
from ..common.telemetry import trace_ai_operation

logger = logging.getLogger(__name__)

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Middleware to handle Firebase authentication from Go gateway."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.firebase_auth = FirebaseAuth()
        self.exempt_paths = {"/health", "/docs", "/openapi.json", "/redoc"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with authentication."""
        
        # Skip auth for exempt paths
        if request.url.path in self.exempt_paths:
            return await call_next(request)
        
        # Get user ID from Go gateway header
        user_id = request.headers.get("X-User-ID")
        request_source = request.headers.get("X-Request-Source")
        
        # Validate request source
        if request_source != "go-gateway":
            logger.warning(f"Request from unknown source: {request_source}")
            # Allow for now, but could be more strict in production
        
        if not user_id:
            logger.error("User ID not found in request headers")
            raise HTTPException(
                status_code=401,
                detail="Authentication required - user ID not found"
            )
        
        # Add user context to request state
        request.state.user_id = user_id
        request.state.authenticated = True
        request.state.auth_source = "go-gateway"
        
        logger.debug(f"Authenticated request for user {user_id}")
        
        response = await call_next(request)
        return response


class TelemetryMiddleware(BaseHTTPMiddleware):
    """Middleware to add telemetry and monitoring."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with telemetry."""
        start_time = datetime.now()
        
        # Extract relevant information
        method = request.method
        path = request.url.path
        user_id = getattr(request.state, "user_id", "anonymous")
        
        logger.info(f"Request: {method} {path} - User: {user_id}")
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = (datetime.now() - start_time).total_seconds() * 1000  # ms
            
            # Log successful request
            logger.info(
                f"Response: {method} {path} - Status: {response.status_code} - "
                f"Duration: {duration:.2f}ms - User: {user_id}"
            )
            
            # Add response headers
            response.headers["X-Response-Time"] = f"{duration:.2f}ms"
            response.headers["X-Request-ID"] = getattr(request.state, "request_id", "unknown")
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration = (datetime.now() - start_time).total_seconds() * 1000  # ms
            
            # Log error
            logger.error(
                f"Error: {method} {path} - Duration: {duration:.2f}ms - "
                f"User: {user_id} - Error: {str(e)}"
            )
            
            raise


class CORSMiddleware(BaseHTTPMiddleware):
    """Custom CORS middleware for fine-grained control."""
    
    def __init__(self, app: ASGIApp, allowed_origins: list = None):
        super().__init__(app)
        self.allowed_origins = allowed_origins or ["*"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle CORS."""
        origin = request.headers.get("Origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            self._add_cors_headers(response, origin)
            return response
        
        response = await call_next(request)
        self._add_cors_headers(response, origin)
        return response
    
    def _add_cors_headers(self, response: Response, origin: Optional[str]):
        """Add CORS headers to response."""
        if origin and (origin in self.allowed_origins or "*" in self.allowed_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
        elif "*" in self.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = "*"
        
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Requested-With, X-User-ID, X-Request-Source"
        )
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "86400"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request IDs for tracing."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add request ID."""
        import uuid
        
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# Security helper for dependency injection
security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request) -> str:
    """Dependency to get current authenticated user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    return user_id

async def get_optional_user(request: Request) -> Optional[str]:
    """Dependency to get current user if authenticated."""
    return getattr(request.state, "user_id", None)