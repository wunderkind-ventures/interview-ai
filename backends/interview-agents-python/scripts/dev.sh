#!/bin/bash

# Development script for fast iteration on Python ADK agents
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
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

# Function to start development environment
start_dev() {
    log_info "Starting Python ADK development environment..."
    log_info "Using compose file: $COMPOSE_FILE"
    
    cd "$PROJECT_ROOT"
    
    # Start the development services
    docker-compose -f "$COMPOSE_FILE" up -d python-agents-dev redis-dev
    
    log_info "Development environment started"
    log_info "Python agents available at: http://localhost:8080"
    log_info "Health check: http://localhost:8080/health"
    log_info ""
    log_info "Use 'dev logs' to view logs"
    log_info "Use 'dev stop' to stop the environment"
}

# Function to start with Firebase emulators
start_with_emulators() {
    log_info "Starting Python ADK development environment with Firebase emulators..."
    
    cd "$PROJECT_ROOT"
    
    # Start all services including Firebase emulators
    docker-compose -f "$COMPOSE_FILE" --profile with-emulators up -d
    
    log_info "Development environment started with emulators"
    log_info "Python agents: http://localhost:8080"
    log_info "Firebase emulator UI: http://localhost:4000"
    log_info "Auth emulator: http://localhost:9099"
    log_info "Firestore emulator: http://localhost:8088"
}

# Function to stop development environment
stop_dev() {
    log_info "Stopping development environment..."
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down
    
    log_info "Development environment stopped"
}

# Function to restart development environment
restart_dev() {
    log_info "Restarting development environment..."
    stop_dev
    sleep 2
    start_dev
}

# Function to view logs
show_logs() {
    cd "$PROJECT_ROOT"
    if [ "$1" == "--follow" ] || [ "$1" == "-f" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f python-agents-dev
    else
        docker-compose -f "$COMPOSE_FILE" logs --tail=50 python-agents-dev
    fi
}

# Function to show status
show_status() {
    log_info "Development environment status:"
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Service health:"
    
    # Check Python service health
    if curl -f -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "Python agents: ${GREEN}HEALTHY${NC}"
    else
        echo -e "Python agents: ${RED}UNHEALTHY or NOT RUNNING${NC}"
    fi
    
    # Check Redis
    if docker-compose -f "$COMPOSE_FILE" ps redis-dev | grep -q "Up"; then
        echo -e "Redis: ${GREEN}RUNNING${NC}"
    else
        echo -e "Redis: ${RED}NOT RUNNING${NC}"
    fi
}

# Function to run Python shell in container
shell() {
    log_info "Opening shell in Python agents container..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" exec python-agents-dev bash
}

# Function to run tests in container
test() {
    log_info "Running tests in Python agents container..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" exec python-agents-dev python -m pytest tests/ -v
}

# Function to rebuild container
rebuild() {
    log_info "Rebuilding Python agents container..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" build --no-cache python-agents-dev
    restart_dev
}

# Function to clean up development environment
cleanup() {
    log_info "Cleaning up development environment..."
    cd "$PROJECT_ROOT"
    
    # Stop and remove containers
    docker-compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
    
    # Remove development images
    if [ "$1" == "--images" ]; then
        docker image prune -f
        log_info "Development images cleaned"
    fi
    
    log_info "Development environment cleaned up"
}

# Function to monitor file changes
watch() {
    log_info "Watching for file changes... (Python service has hot reload enabled)"
    log_info "Press Ctrl+C to stop watching"
    
    # Show logs in follow mode
    show_logs --follow
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Development commands for Python ADK agents:"
    echo ""
    echo "  start           Start development environment (default)"
    echo "  start-emulators Start with Firebase emulators"
    echo "  stop            Stop development environment"
    echo "  restart         Restart development environment"
    echo "  status          Show service status"
    echo "  logs            Show service logs"
    echo "  logs -f         Follow service logs"
    echo "  shell           Open shell in Python container"
    echo "  test            Run tests"
    echo "  rebuild         Rebuild container and restart"
    echo "  watch           Watch logs and file changes"
    echo "  cleanup         Clean up development environment"
    echo "  cleanup --images Clean up including Docker images"
    echo "  help            Show this help message"
    echo ""
    echo "Development URLs:"
    echo "  Python agents:     http://localhost:8080"
    echo "  Health check:      http://localhost:8080/health"
    echo "  Redis:             localhost:6379"
    echo "  Firebase UI:       http://localhost:4000 (with emulators)"
    echo ""
    echo "Note: The Python service has hot reload enabled, so code changes"
    echo "will be automatically reflected without restarting the container."
}

# Parse command line arguments
case "${1:-start}" in
    start)
        check_prerequisites
        start_dev
        ;;
    start-emulators)
        check_prerequisites
        start_with_emulators
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    shell)
        shell
        ;;
    test)
        test
        ;;
    rebuild)
        check_prerequisites
        rebuild
        ;;
    watch)
        watch
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