"""Main entry point for Python ADK agents."""

import os
import logging
import uvicorn
from api_server import app
from common.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def main():
    """Main function to start the ADK agents server."""
    logger.info("Starting Interview AI - Python ADK Agents")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Project: {settings.gcp_project_id}")
    logger.info(f"Region: {settings.gcp_region}")
    
    # Get host and port from environment or defaults
    # Cloud Run/GCF Gen2 sets the PORT environment variable.
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", settings.api_port)) # Use PORT from env, fallback to config default

    # Determine if running in a deployed (Cloud Run/GCF Gen2) environment
    # K_SERVICE is an environment variable set by Cloud Run.
    is_deployed_env = os.getenv("K_SERVICE") is not None
    
    # Enable reload only in local development, not in deployed environments
    enable_reload = settings.environment.value == "development" and not is_deployed_env

    logger.info(f"Starting server on {host}:{port}, reload: {enable_reload}")
    
    # Run the FastAPI application
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=enable_reload,
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    main()
