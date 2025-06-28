# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## Overview

This repository contains a Next.js frontend, a multi-agent AI system using Google Genkit, and a backend built with Go, Python, and Rust microservices. The infrastructure is managed with Pulumi on Google Cloud Platform (GCP).

## Commands

### Development

- `npm run dev`: Starts the Next.js development server on port 9002 with Turbopack.
- `npm run genkit:dev`: Starts the Genkit development server for AI flows.
- `npm run genkit:watch`: Starts the Genkit development server with hot-reloading.
- `npm run build`: Builds the Next.js application.
- `npm run lint`: Runs ESLint to check for code quality.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.

### Infrastructure (via `justfile`)

- `just pulumi-up`: Deploys the infrastructure using Pulumi.
- `just pulumi-down`: Destroys the infrastructure using Pulumi.
- `just pulumi-refresh`: Refreshes the Pulumi stack.
- `just ngrok-start`: Starts an ngrok tunnel to `interview-ai.ngrok.app`.
- `just ngrok-stop`: Stops the ngrok tunnel.
- `just git-clean`: Cleans up merged git branches.
- `just logs-all`: Views logs for all backend functions.
- `just deploy-all`: Deploys all backend functions.
- `just test-browser`: Opens Chrome in incognito mode for testing.
- `just test-browser-profile`: Opens Chrome with a specific test profile.

### Google Cloud Environment Switching

```bash
gcloud config configurations activate interviewai-dev   # Development
gcloud config configurations activate interviewai-stage # Staging
gcloud config configurations activate interviewai-prod  # Production
```

## Architecture

### Frontend (Next.js 15 + TypeScript)

- **Framework**: Next.js 15 with the App Router.
- **UI Components**: `shadcn/ui` components located in `src/components/ui/`.
- **Authentication**: Firebase Authentication with a context provider in `src/contexts/AuthContext.tsx`.
- **State Management**: TanStack Query for server-side state management.
- **Forms**: React Hook Form with Zod for validation.

### AI Integration (Google Genkit)

- **Framework**: Google Genkit with Gemini models.
- **Flows**: AI flows are located in `src/ai/flows/` and handle interview logic, resume analysis, and question generation.
- **Prompts**: The template system is in `src/ai/prompts/`.
- **Development**: Use `npm run genkit:dev` to access the Genkit UI for testing flows.

### Multi-Agent System

- **Orchestrator Agent**: Coordinates other agents and manages the conversation flow.
- **Evaluator Agent**: Provides feedback on interview responses.
- **Context Agent**: Manages conversation context and state.
- **Interviewer Agent**: Conducts the interview sessions.
- **Agent Framework**: The agent framework is located in `src/agents/` with shared utilities and a test harness.

### Backend Services

- **Go Functions**: Microservices in `backends/catalyst-interviewai/functions/`.
- **Python Services**: A FastAPI-based multi-agent system in `backends/catalyst-py/`.
- **Rust ML Functions**: Candle-based ML transformers in `backends/catalyst-rs/`.
- **API Gateway**: Proxies all backend services.

### Infrastructure (Pulumi + GCP)

- **IaC**: Pulumi configuration is in `pulumi-gcp-catalyst/`.
- **Resources**:
  - Cloud Functions
  - Cloud Run
  - API Gateway
  - Secret Manager
  - Pub/Sub
  - Cloud Storage
- **Environments**: `dev`, `stage`, and `prod` with separate GCP projects.
- **Configuration**: Environment-specific configuration is in `Pulumi.interviewai-{env}.yaml`.

#### `pulumi-gcp-catalyst/automation`

- Contains a Go program (`sync-baseurl.go`) for automating the synchronization of base URLs.

#### `pulumi-gcp-catalyst/pulumi-gcp-infrastructure`

- Manages the core GCP infrastructure, including Firebase, IAM, and project-level resources.
- **`firebase`**: Contains Firebase-related infrastructure.
- **`iam`**: Manages IAM policies and service accounts.
- **`project`**: Defines the GCP project configuration.

#### `pulumi-gcp-catalyst/pulumi-gcp-interviewai`

- Manages the application-specific infrastructure for the interview AI.
- **`config`**: Contains configuration for the application.
- **`envconfig`**: Manages environment-specific configurations.
- **`functions`**: Defines the Cloud Functions.
- **`gateway`**: Configures the API Gateway.
- **`iam`**: Manages IAM policies for the application.
- **`monitoring`**: Defines monitoring and logging configurations.
- **`storage`**: Manages Cloud Storage resources.
- **`tunnel`**: Configures the SSH tunnel for secure connections.
- **`utils`**: Contains utility functions for the Pulumi program.

## Key Patterns

### Authentication Flow

1. The frontend uses Firebase Authentication for user authentication.
2. ID tokens are sent in the `Authorization` header.
3. The backend validates tokens using the Firebase Admin SDK.
4. API keys are stored in Secret Manager with user-specific paths.
5. BYOT (Bring Your Own Token) is integrated via `NEXT_PUBLIC_GO_BACKEND_URL`.

### API Structure

- Frontend API routes are in `src/app/api/`.
- Backend functions are exposed via the API Gateway.

### Development Workflow

1. Start the local development server: `npm run dev`
2. For AI development, run `npm run genkit:dev` in a separate terminal.
3. Use ngrok for external access: `just ngrok-start`
4. Test APIs using the Testing Utilities Panel at `/testing-utilities`.

### Debugging Resources

- **Authentication Issues**: See `debugging/auth-flow-debugging.md` and `debugging/byot-debugging-guide.md`.
- **API Testing**: Use the testing utilities panel or follow the guides in `debugging/`.
- **Logs**: Use `just logs-all` to view backend function logs.
- **Test Script**: `scripts/test-agents.sh YOUR_FIREBASE_TOKEN` to test Python agent endpoints.