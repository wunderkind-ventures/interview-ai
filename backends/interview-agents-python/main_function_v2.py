"""Cloud Functions Gen2 entry point for Python ADK agents using functions-framework.

This module provides the proper entry point for Google Cloud Functions Gen2
to run a FastAPI application.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set the PORT environment variable if not already set
# Cloud Functions sets this, but we'll provide a default for local testing
if "PORT" not in os.environ:
    os.environ["PORT"] = "8080"

# Import functions_framework before other imports
import functions_framework

# Now we can import our FastAPI app
from api_server import app

# The functions-framework will automatically detect and serve the FastAPI app
# when the module is imported. The app variable needs to be at module level.

# For Cloud Functions Gen2, we don't need an explicit handler function
# The framework will handle the ASGI app automatically