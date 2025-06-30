"""Google Cloud Functions Gen2 entry point for Python ADK agents.

This module provides the entry point for deploying the FastAPI app
as a Cloud Function Gen2.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import the main function that starts the server
from main import main

def start_server(request=None):
    """Entry point for Cloud Functions Gen2.
    
    This function is called by the Cloud Functions runtime.
    For Gen2 functions deployed with Python runtime, this will
    start the uvicorn server on the PORT provided by Cloud Functions.
    """
    # Cloud Functions Gen2 will set the PORT environment variable
    # The main() function already handles reading PORT from environment
    main()
    
    # This line will never be reached as uvicorn.run() blocks
    # but we return something for compatibility
    return "Server started", 200


# For direct execution (testing)
if __name__ == "__main__":
    start_server()