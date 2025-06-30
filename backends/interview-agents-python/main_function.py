"""Entry point for Google Cloud Functions Gen2.

This module provides a Functions Framework compatible entry point.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

import functions_framework
from api_server import app

# For Cloud Functions Gen2, we need to expose the ASGI app
# Functions Framework will handle starting the server
functions_framework.create_app(app)