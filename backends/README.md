# Backend Services Architecture

This directory contains all backend services for the Interview AI platform, organized by function and implementation language.

## Directory Structure

```
backends/
├── interview-agents-python/      # Current production multi-agent system (Python/FastAPI)
├── interview-agents-go/          # Future high-performance agent system (Go) - PLANNED
├── prompt-optimization-python/   # Offline prompt optimization system (Python) - PLANNED
├── catalyst-interviewai/         # Core backend services (Go)
└── catalyst-rs/                  # ML/AI services (Rust)
```

## Architectural Overview

### Current Production Architecture
- **interview-agents-python**: FastAPI-based multi-agent system handling all interview logic
- **catalyst-interviewai**: Go microservices for supporting functions (auth, storage, etc.)
- **catalyst-rs**: Rust-based ML services for specialized AI tasks

### Future Hybrid Architecture

The system is evolving towards a hybrid architecture that leverages the strengths of different languages:

#### Online Serving (Low Latency)
- **Language**: Go
- **Location**: `interview-agents-go/`
- **Purpose**: Real-time interview interactions
- **Benefits**: 10-50x performance improvement, better resource efficiency

#### Offline Optimization (ML-Heavy)
- **Language**: Python
- **Location**: `prompt-optimization-python/`
- **Purpose**: Prompt evolution and optimization
- **Benefits**: Access to ML ecosystem, research flexibility

## Service Descriptions

### interview-agents-python (Production)
Current production multi-agent system featuring:
- Orchestrator, Context, Evaluator, and Synthesis agents
- Specialized agents for story analysis and achievement reframing
- RESTful API with Firebase authentication
- Deployed as Cloud Run service

### catalyst-interviewai
Core Go backend services:
- Authentication and API key management
- Document parsing and content scraping
- Gateway functions for agent integration
- Vector search and RAG system components

### catalyst-rs
Rust-based ML services:
- Candle framework for efficient ML inference
- Whisper model integration
- Quantized model support

## Migration Path

1. **Current State**: Python agents in production
2. **Phase 1**: Implement prompt optimization system
3. **Phase 2**: Prototype Go agents with performance benchmarks
4. **Phase 3**: Gradual migration to Go for online serving
5. **End State**: Hybrid architecture with optimal language choices

## Development Guidelines

- **Python Services**: Use for ML-heavy, research-oriented components
- **Go Services**: Use for high-performance, low-latency requirements
- **Rust Services**: Use for specialized ML inference with efficiency needs

## Integration Points

All services integrate through:
- **API Gateway**: Centralized routing and authentication
- **Shared Storage**: GCS and Firestore for data persistence
- **Message Queue**: Pub/Sub for async communication
- **Monitoring**: Unified telemetry with OpenTelemetry