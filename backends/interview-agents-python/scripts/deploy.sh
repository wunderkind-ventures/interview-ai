#!/bin/bash

# Deployment script for Python ADK Agent service
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="python-agents"
CONTAINER_NAME="interview-ai-python-agents"
IMAGE_NAME="interview-ai/python-agents"
ENVIRONMENT="${ENVIRONMENT:-development}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Function to build the Docker image
build_image() {
    log_info "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    # Build the image
    docker build -f docker/Dockerfile -t "$IMAGE_NAME:latest" .
    
    # Tag with environment
    docker tag "$IMAGE_NAME:latest" "$IMAGE_NAME:$ENVIRONMENT"
    
    log_info "Docker image built successfully"
}

# Function to stop existing containers
stop_existing() {
    log_info "Stopping existing containers..."
    
    # Stop and remove existing container
    if docker ps -a --format 'table {{.Names}}' | grep -q "$CONTAINER_NAME"; then
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
        log_info "Existing container stopped and removed"
    else
        log_info "No existing container found"
    fi
}

# Function to start the service
start_service() {
    log_info "Starting Python ADK Agent service..."
    
    cd "$PROJECT_ROOT"
    
    # Start with Docker Compose
    docker-compose -f docker/docker-compose.yml up -d
    
    log_info "Service started successfully"
}

# Function to check service health
check_health() {
    log_info "Checking service health..."
    
    local max_attempts=30
    local attempt=1
    local health_url="http://localhost:8080/health"
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log_info "Service is healthy and ready"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Service failed to become healthy after $max_attempts attempts"
            return 1
        fi
        
        sleep 2
        ((attempt++))
    done
}

# Function to show service status
show_status() {
    log_info "Service status:"
    docker-compose -f "$PROJECT_ROOT/docker/docker-compose.yml" ps
    
    log_info "Service logs (last 20 lines):"
    docker-compose -f "$PROJECT_ROOT/docker/docker-compose.yml" logs --tail=20 python-agents
}

# Function to clean up
cleanup() {
    log_info "Cleaning up..."
    
    cd "$PROJECT_ROOT"
    
    # Stop services
    docker-compose -f docker/docker-compose.yml down
    
    # Remove unused images (optional)
    if [ "$1" == "--clean-images" ]; then
        docker image prune -f
        log_info "Unused images cleaned"
    fi
    
    log_info "Cleanup completed"
}

# Main deployment function
deploy() {
    log_info "Starting deployment of Python ADK Agent service..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Project root: $PROJECT_ROOT"
    
    check_prerequisites
    stop_existing
    build_image
    start_service
    
    if check_health; then
        show_status
        log_info "Deployment completed successfully!"
        log_info "Service is available at http://localhost:8080"
        log_info "Health endpoint: http://localhost:8080/health"
    else
        log_error "Deployment failed - service is not healthy"
        show_status
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy          Deploy the Python ADK Agent service (default)"
    echo "  build           Build the Docker image only"
    echo "  start           Start the service (assumes image exists)"
    echo "  stop            Stop the service"
    echo "  restart         Restart the service"
    echo "  status          Show service status"
    echo "  logs            Show service logs"
    echo "  health          Check service health"
    echo "  cleanup         Stop and clean up resources"
    echo "  help            Show this help message"
    echo ""
    echo "Options:"
    echo "  --clean-images  Remove unused Docker images during cleanup"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT     Deployment environment (default: development)"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    build)
        check_prerequisites
        build_image
        ;;
    start)
        check_prerequisites
        start_service
        check_health
        ;;
    stop)
        cd "$PROJECT_ROOT"
        log_info "Stopping service..."
        docker-compose -f docker/docker-compose.yml down
        log_info "Service stopped"
        ;;
    restart)
        cd "$PROJECT_ROOT"
        log_info "Restarting service..."
        docker-compose -f docker/docker-compose.yml restart
        check_health
        ;;
    status)
        show_status
        ;;
    logs)
        cd "$PROJECT_ROOT"
        docker-compose -f docker/docker-compose.yml logs -f python-agents
        ;;
    health)
        check_health
        ;;
    cleanup)
        cleanup "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac