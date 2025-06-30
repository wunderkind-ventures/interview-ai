"""Cloud Functions Gen2 entry point for Python ADK agents."""

import os
from typing import Any
import functions_framework
from api_server import app


# For HTTP-triggered functions
@functions_framework.http
def start_server(request):
    """Cloud Function entry point that delegates to FastAPI app."""
    # This is a wrapper that allows FastAPI to work within Cloud Functions
    # However, for a proper deployment, we should use Cloud Run instead
    return app(request.scope, request.receive, request.send)


# Alternative: For better compatibility, expose the app directly
# This allows the Functions Framework to handle the ASGI app
app_asgi = app