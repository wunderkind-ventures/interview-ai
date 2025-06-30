"""Cloud Functions Gen2 entry point for FastAPI application.

This module provides a wrapper to run FastAPI apps on Cloud Functions Gen2.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# For Cloud Functions Gen2 with Python, we need to start the server differently
# The runtime will call the specified function entry point

def start_server(request=None):
    """Entry point for Cloud Functions Gen2.
    
    This function is called by Cloud Functions runtime to start the application.
    For Gen2 functions, this will start the FastAPI server using uvicorn.
    """
    import uvicorn
    from api_server import app
    from common.config import settings
    
    # Get port from environment (Cloud Functions sets this)
    port = int(os.environ.get("PORT", 8080))
    
    # Start the FastAPI server
    # Note: This will block and run the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
        # Don't use reload in production
        reload=False
    )