# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start Next.js development server on port 9002 with Turbopack
- `npm run genkit:dev` - Start Genkit development server for AI flows
- `npm run genkit:watch` - Start Genkit with hot reload
- `npm run build` - Build the Next.js application
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Infrastructure (via justfile)
- `just pulumi-up` - Deploy infrastructure with Pulumi
- `just pulumi-down` - Destroy infrastructure
- `just ngrok-start` - Start ngrok tunnel to interview-ai.ngrok.app
- `just git-clean` - Clean up merged git branches

### Google Cloud Environment Switching
```bash
gcloud config configurations activate interviewai-dev   # Development
gcloud config configurations activate interviewai-stg   # Staging  
gcloud config configurations activate interviewai-prod  # Production
```

## Architecture

### Frontend (Next.js 15 + TypeScript)
- **App Router**: All pages in `src/app/` using Next.js 15 app directory
- **UI Components**: shadcn/ui components in `src/components/ui/`
- **Authentication**: Firebase Auth with context provider in `src/contexts/AuthContext.tsx`
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form + Zod validation

### AI Integration (Google Genkit)
- **Framework**: Google Genkit with Gemini models
- **Flows**: Located in `src/ai/flows/` - handles interview logic, resume analysis, and question generation
- **Prompts**: Template system in `src/ai/prompts/`
- **Development**: Use `npm run genkit:dev` to access Genkit UI for testing flows

### Backend Services
- **Go Functions**: Microservices in `backends/catalyst-backend/functions/`
  - Each function has its own go.mod for dependency isolation
  - Firebase Admin SDK for authentication
  - Google Cloud Secret Manager for API keys
- **Rust ML Functions**: In `backends/catalyst-rs-fns/` using Candle for ML transformers
- **API Gateway**: Proxies requests to backend services with authentication

### Infrastructure (Pulumi + GCP)
- **IaC**: Pulumi configuration in `pulumi-gcp-catalyst-backend/`
- **Resources**: Cloud Functions, API Gateway, Secret Manager, Monitoring
- **Environments**: dev, stg, prod with separate GCP projects

## Key Patterns

### Authentication Flow
1. Frontend uses Firebase Auth for user authentication
2. ID tokens sent in Authorization header
3. Backend validates tokens using Firebase Admin SDK
4. API keys stored in Secret Manager with user-specific paths

### API Structure
- Frontend API routes: `src/app/api/`
- Backend functions exposed via API Gateway
- CORS handled at function level
- All requests require Firebase authentication

### Development Workflow
1. Start local dev server: `npm run dev`
2. For AI development: `npm run genkit:dev` in separate terminal
3. Use ngrok for external access: `just ngrok-start`
4. Test APIs using the Testing Utilities Panel at `/testing-utilities`

## Important Notes

- No automated tests currently exist - consider adding Jest/Vitest
- Debugging utilities in `debugging/` contain auth troubleshooting guides
- All backend functions require Firebase auth tokens
- Environment variables needed for local development (check with team)
- Use `just` commands for infrastructure operations