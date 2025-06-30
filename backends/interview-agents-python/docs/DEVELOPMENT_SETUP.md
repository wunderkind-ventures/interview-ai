# Python ADK Development Setup

This document explains how to set up and use the Python ADK agents for local development and cloud deployment.

## Overview

The Python ADK agent service can run in two modes:
1. **Local Development**: Fast iteration with Docker Compose
2. **Cloud Development**: Full integration testing with Cloud Run

## Environment Variables

### Core Configuration

- `PYTHON_AGENT_BASE_URL`: Explicit Python agent service URL (highest priority)
- `ENVIRONMENT`: Deployment environment (`development`, `staging`, `production`)
- `GCP_PROJECT_ID`: Google Cloud Project ID
- `GCP_REGION`: Google Cloud region (default: `us-central1`)

### Alternative URL Configuration

The system checks these environment variables in order:
1. `PYTHON_AGENT_BASE_URL`
2. `PYTHON_AGENT_SERVICE_URL` 
3. `PYTHON_ADK_AGENT_SERVICE_URL`
4. `ADK_AGENT_URL`

If none are set, it falls back to environment-specific defaults.

### Local Development Override

- `LOCAL_PYTHON_AGENT_URL`: Override for local development URL (default: `http://localhost:8080`)

## Development Workflows

### Option 1: Local Development (Fast Iteration)

Best for: Rapid Python agent development and testing

```bash
# Start local development environment
cd backends/interview-agents-python
./scripts/dev.sh start

# Available services:
# - Python agents: http://localhost:8080
# - Redis: localhost:6379
# - Health check: http://localhost:8080/health

# View logs
./scripts/dev.sh logs -f

# Stop environment
./scripts/dev.sh stop
```

### Option 2: Cloud Development (Integration Testing)

Best for: End-to-end testing with full Firebase/GCP integration

```bash
# Deploy to dev stack
cd pulumi-gcp-catalyst/pulumi-gcp-interviewai
pulumi up --stack catalyst-dev

# Access via tunnel
# URL will be provided in Pulumi outputs
```

### Option 3: Hybrid Development

Use local Python service with cloud Go functions:

```bash
# 1. Start local Python service
cd backends/interview-agents-python
./scripts/dev.sh start

# 2. Set environment variable for Go functions
export PYTHON_AGENT_BASE_URL="http://localhost:8080"

# 3. Deploy Go functions to cloud
cd pulumi-gcp-catalyst/pulumi-gcp-interviewai
pulumi up --stack catalyst-dev
```

## Configuration Examples

### Local Development
```bash
export ENVIRONMENT=development
export PYTHON_AGENT_BASE_URL=http://localhost:8080
# Go functions will connect to local Python service
```

### Cloud Development
```bash
export ENVIRONMENT=development
export GCP_PROJECT_ID=your-project-id
export PYTHON_AGENT_BASE_URL=https://pythonagents-dev-us-central1.a.run.app
# Go functions will connect to Cloud Run service
```

### Automatic Cloud Run Detection
```bash
export ENVIRONMENT=development
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
# System will automatically construct Cloud Run URL
```

## Service Discovery

The Go gateway functions automatically detect the Python service location based on:

1. **Explicit URLs**: Environment variables with full URLs
2. **Cloud Patterns**: Constructed URLs based on project/region
3. **Local Fallback**: Default to localhost for development

## Docker Compose Services

### Python Agents (`python-agents-dev`)
- Port: 8080
- Hot reload enabled
- Volume mounts for code changes
- Debug logging

### Redis (`redis-dev`)
- Port: 6379
- Persistent data volume
- Used for session storage

### Firebase Emulators (`firebase-emulator`) - Optional
- Auth emulator: 9099
- Firestore emulator: 8088
- Emulator UI: 4000
- Start with: `./scripts/dev.sh start-emulators`

## Development Commands

```bash
# Quick reference
./scripts/dev.sh start           # Start development environment
./scripts/dev.sh stop            # Stop environment
./scripts/dev.sh restart         # Restart environment
./scripts/dev.sh logs            # View logs
./scripts/dev.sh logs -f         # Follow logs
./scripts/dev.sh status          # Check service status
./scripts/dev.sh shell           # Open shell in container
./scripts/dev.sh test            # Run tests
./scripts/dev.sh rebuild         # Rebuild and restart
./scripts/dev.sh cleanup         # Clean up environment
```

## Troubleshooting

### Connection Issues

1. **Check service URLs**:
   ```bash
   curl http://localhost:8080/health  # Local service
   curl $PYTHON_AGENT_BASE_URL/health # Configured service
   ```

2. **Verify environment variables**:
   ```bash
   echo $PYTHON_AGENT_BASE_URL
   echo $ENVIRONMENT
   echo $GCP_PROJECT_ID
   ```

3. **Check Docker services**:
   ```bash
   ./scripts/dev.sh status
   docker-compose -f docker/docker-compose.dev.yml ps
   ```

### Authentication Issues

- Local development uses mock authentication
- Cloud development requires proper Firebase configuration
- Check `X-User-ID` headers in Go gateway functions

### Performance

- Local development: ~100ms response times
- Cloud development: ~500-1000ms response times (cold start)
- Use local for rapid iteration, cloud for integration testing

## Integration with Go Functions

The Go gateway functions in `backends/catalyst-interviewai/functions/pythonagentgateway/` automatically:

1. Load service configuration from environment
2. Route requests to appropriate Python service
3. Handle authentication and error responses
4. Provide fallback behavior for local development

No code changes needed when switching between local and cloud Python services.