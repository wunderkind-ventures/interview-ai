# Interview Agents - Go Implementation

This directory contains the high-performance Go implementation of the interview agent system for online serving.

## Overview

This is a planned reimplementation of the current Python-based interview agents in Go, designed for:
- **Low-latency response times** (< 100ms)
- **High concurrency** handling multiple interview sessions
- **Efficient resource usage** for cost-effective scaling
- **Direct integration** with existing Go backend infrastructure

## Architecture

```
interview-agents-go/
├── orchestrator/     # Session coordination and state management
├── interviewer/      # Question generation and interview flow
├── evaluator/        # Real-time response evaluation
├── gateway/          # API gateway and routing
└── common/           # Shared utilities and interfaces
```

## Design Principles

1. **Performance First**: Optimized for real-time interview interactions
2. **Stateless Design**: Session state stored in Redis/Firestore for horizontal scaling
3. **Prompt Consumption**: Uses optimized prompts from the Python optimization system
4. **Unified Telemetry**: Integrated with existing monitoring infrastructure

## Integration Points

- **Prompt Storage**: Fetches optimized prompts from GCS/Firestore
- **Session State**: Redis for fast access, Firestore for persistence
- **API Gateway**: Integrates with existing `catalyst-interviewai` gateway
- **Telemetry**: OpenTelemetry for distributed tracing

## Migration Strategy

1. Implement core agent interfaces
2. Port orchestrator logic from Python
3. Create performance benchmarks
4. Gradual rollout with feature flags
5. Full migration once performance targets are met

## Performance Targets

- Response latency: < 100ms (p99)
- Concurrent sessions: 1000+ per instance
- Memory usage: < 500MB per instance
- CPU efficiency: 10x improvement over Python

## Status

**Current**: Planning phase
**Next Steps**: 
1. Define agent interfaces
2. Implement orchestrator prototype
3. Benchmark against Python implementation