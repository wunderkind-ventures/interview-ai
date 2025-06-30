#!/usr/bin/env python3
"""
Startup script for Python ADK Agent API Server.
"""

import os
import sys
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

import uvicorn
from api.server import app
from common.config import settings

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger = logging.getLogger(__name__)
    
    # Get configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"Starting Python ADK Agent API Server")
    logger.info(f"Environment: {settings.environment.value}")
    logger.info(f"Host: {host}")
    logger.info(f"Port: {port}")
    logger.info(f"Workers: {workers}")
    
    # Start the server
    uvicorn.run(
        app,
        host=host,
        port=port,
        workers=workers,
        log_level="info",
        reload=settings.environment.value == "development",
        access_log=True
    )