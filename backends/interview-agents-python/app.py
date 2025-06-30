"""Cloud Functions Gen2 entry point for the FastAPI application.

This module exports the FastAPI app for use with functions-framework.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path to ensure imports work
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import and expose the FastAPI app
from api_server import app

# Functions Framework will automatically detect and serve this app
# when deployed to Cloud Functions Gen2