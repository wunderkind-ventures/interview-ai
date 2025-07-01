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
- `npm run env:generate` - Generate complete .env.local from Pulumi outputs
- `npm run env:update-backend` - Update only backend URL from latest infrastructure
- `npm run env:validate` - Validate current environment
- `npm run deploy:prepare` - Prepare deployment configuration

### Gemini API Setup
- `./scripts/setup-gemini-api.sh [dev|stage|prod]` - Set up Gemini API for an environment
  - Enables the Generative Language API
  - Guides through API key creation
  - Stores API key in Secret Manager
  - Updates local configuration

### Infrastructure (via justfile)
- `just pulumi-up` - Deploy infrastructure with Pulumi
- `just pulumi-down` - Destroy infrastructure
- `just ngrok-start` - Start ngrok tunnel to interview-ai.ngrok.app
- `just ngrok-stop` - Stop ngrok tunnel
- `just git-clean` - Clean up merged git branches
- `just logs-all` - View logs for all backend functions
- `just deploy-all` - Deploy all backend functions
- `just test-browser` - Open Chrome in incognito mode for testing
- `just test-browser-profile` - Open Chrome with specific test profile

### Google Cloud Environment Switching
```bash
gcloud config configurations activate interviewai-dev   # Development
gcloud config configurations activate interviewai-stage # Staging  
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

### Multi-Agent System
- **Orchestrator Agent**: Coordinates other agents and manages conversation flow
- **Evaluator Agent**: Provides feedback on interview responses
- **Context Agent**: Manages conversation context and state
- **Interviewer Agent**: Conducts the actual interview sessions
- **Agent Framework**: Located in `src/agents/` with shared utilities and test harness

### Backend Services
- **Go Functions**: Microservices in `backends/catalyst-interviewai/functions/`
  - `setapikey`: Store user's Gemini API key in Secret Manager
  - `removeapikey`: Remove stored API key
  - `getapikeystatus`: Check if user has an API key stored
  - `proxytogenkit`: Proxy requests to Genkit AI flows
  - `parseresume`: Resume parsing and analysis (docx, md, pdf)
  - `contentscraper`: YouTube and blog content extraction
  - `contentindexer`: Vector indexing for RAG system (Cloud Run)
  - `vectorsearch`: Semantic search functionality (Cloud Run)
  - `pythonagentgateway`: Bridge to Python agent system (multiple endpoints)
  - `byok`: Bring Your Own Key functionality
  - `rag`: RAG system orchestration
  - `scuttle-go`: Web crawling functionality
- **Python Services**: In `backends/interview-agents-python/`
  - FastAPI-based multi-agent system
  - Agents: orchestrator, evaluator, context, interviewer
  - Achievement reframing and story deconstruction
  - Impact quantifier for accomplishments
  - Deployed as Cloud Run service: `python-adk-agents-dev`
- **Rust ML Functions**: In `backends/catalyst-rs/`
  - Candle-based ML transformers
  - Whisper model for speech processing
  - Quantized model support (Qwen3)
- **API Gateway**: Proxies all backend services at `https://catalyst-gateway-dev-an3b0bg1.uc.gateway.dev`
- **BigQuery Analytics**: Comprehensive analytics tracking in `interview_analytics_dev` dataset
  - `interview_sessions`: Track all interview sessions
  - `user_responses`: Store user answers to questions
  - `evaluation_scores`: AI evaluation results  
  - `agent_interactions`: Inter-agent message logs
  - `prompt_performance`: Prompt effectiveness metrics
  - `session_summaries`: Final interview reports

### Infrastructure (Pulumi + GCP)
- **IaC**: Pulumi configuration in `pulumi-gcp-catalyst/pulumi-gcp-interviewai/` (NOT pulumi-gcp-infrastructure)
- **Resources**: 
  - Cloud Functions (Gen1 for most services, Gen2 for ParseResume)
  - Cloud Run (ContentIndexer, VectorSearch, Python agents)
  - API Gateway with OpenAPI spec at `https://catalyst-gateway-dev-an3b0bg1.uc.gateway.dev`
  - Secret Manager for API keys
  - Pub/Sub for content indexing pipeline
  - Cloud Storage for function deployments
  - Monitoring with alerts
- **Environments**: dev, stage, prod with separate GCP projects
- **Configuration**: Environment-specific config in `Pulumi.interviewai-{env}.yaml`
- **Stack outputs**: Clean names without environment suffixes (e.g., `apigatewayHostname` not `apigatewayHostname-dev`)
- **Active Stack**: `wkv/interviewai-dev` (use `pulumi stack select wkv/interviewai-dev`)
- **Cloud Run Services**: 
  - `python-adk-agents-dev`: https://python-adk-agents-dev-s5blxcobka-uc.a.run.app (healthy)
  - `contentindexer-dev`: https://contentindexer-dev-s5blxcobka-uc.a.run.app
  - `vectorsearch-dev-33bb8dd`: https://vectorsearch-dev-33bb8dd-s5blxcobka-uc.a.run.app

## Key Patterns

### Authentication Flow
1. Frontend uses Firebase Auth for user authentication
   - Email/password authentication enabled by default
   - Google Sign-In requires manual Firebase Console configuration (see `docs/deployment/google-auth-setup.md`)
   - OAuth client ID configured via `NEXT_PUBLIC_FIREBASE_OAUTH_CLIENT_ID`
2. ID tokens sent in Authorization header
3. Backend validates tokens using Firebase Admin SDK
4. API keys stored in Secret Manager with user-specific paths
5. BYOT (Bring Your Own Token) integration via `NEXT_PUBLIC_GO_BACKEND_URL`

### API Structure
- Frontend API routes: `src/app/api/`
- Backend functions exposed via API Gateway at `https://catalyst-gateway-dev-an3b0bg1.uc.gateway.dev`
- Key API endpoints:
  - `/api/user/set-api-key` - Store Gemini API key
  - `/api/user/remove-api-key` - Remove stored API key
  - `/api/user/api-key-status` - Check API key status
  - `/api/genkit/proxy` - Proxy to Genkit AI flows
  - `/api/resume/parse` - Parse resume documents
  - `/api/content/scrape` - Scrape YouTube/blog content
  - `/api/content/search` - Search scraped content
  - `/api/vector/search` - Semantic vector search
  - `/api/agents/interview/start` - Start interview session
  - `/api/agents/interview/{sessionId}/respond` - Submit interview response
  - `/api/agents/interview/{sessionId}/status` - Get session status
  - `/api/agents/interview/{sessionId}/end` - End interview session
  - `/api/agents/report/{sessionId}` - Get interview report
  - `/api/agents/health` - Agent system health check
- CORS handled at function level with OPTIONS endpoints
- All requests require Firebase authentication
- Testing utilities available at `/testing-utilities`

### Development Workflow
1. Start local dev server: `npm run dev`
2. For AI development: `npm run genkit:dev` in separate terminal
3. Use ngrok for external access: `just ngrok-start`
4. Test APIs using the Testing Utilities Panel at `/testing-utilities`
5. For Cursor users: Follow task-based workflow in `.cursor/rules/`

### Debugging Resources
- **Auth Issues**: See `debugging/auth-flow-debugging.md` and `debugging/byot-debugging-guide.md`
- **API Testing**: Use the testing utilities panel or follow guides in `debugging/`
- **Logs**: Use `just logs-all` to view backend function logs
- **Test Script**: `scripts/test-agents.sh YOUR_FIREBASE_TOKEN` - Test Python agent endpoints

### Testing Deployed Infrastructure
1. Get Firebase token from `/testing-utilities` panel
2. Test API Gateway: `curl https://catalyst-gateway-dev-an3b0bg1.uc.gateway.dev/api/agents/health`
3. Test individual functions directly (requires auth token):
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://us-central1-wkv-interviewai-dev.cloudfunctions.net/AgentHealthGCF-dev
   ```
4. Check function status: `gcloud functions list --regions=us-central1`
5. Check Cloud Run services: `gcloud run services list --region=us-central1`

### BigQuery Analytics Integration
- **Go Functions**: Use `pkg/analytics` package to log events
  - StartInterviewGCF logs new sessions
  - InterviewResponseGCF logs user responses
  - All functions log via analytics client
- **Python Agents**: Use `common.analytics` module
  - Base agent auto-logs all inter-agent messages
  - Evaluator agent logs evaluation scores
  - Orchestrator tracks session state changes
- **Query Analytics**:
  ```bash
  bq query --use_legacy_sql=false 'SELECT * FROM `wkv-interviewai-dev.interview_analytics_dev.interview_sessions` LIMIT 5'
  ```

## Important Notes

- Test infrastructure exists in CI/CD (`ai-agent-testing.yml`) but no local test runner configured
- TypeScript and ESLint errors are currently allowed in builds
- All backend functions require Firebase auth tokens (except health endpoints)
- Environment variables needed for local development (check with team)
- Use `just` commands for infrastructure operations
- Cost monitoring is automated in CI/CD for API usage tracking
- Python agent service health check may timeout initially - needs warm-up
- API Gateway uses OpenAPI spec with 32 placeholder URLs for function mapping
- Some functions deployed as Cloud Run services for better scalability
- Vector search requires manual Vertex AI setup (see stack outputs for instructions)

## Environment Configuration

### Setting Up .env.local
The `.env.local` file contains environment-specific configuration including Firebase settings and the API Gateway URL. There are two ways to manage this:

1. **Generate complete environment file from Pulumi** (recommended after infrastructure changes):
   ```bash
   npm run env:generate
   # Or specify environment: npm run env:generate -- stage
   ```

2. **Update only the backend URL** (useful after API Gateway updates):
   ```bash
   npm run env:update-backend
   # Or specify environment: npm run env:update-backend -- stage
   ```

The backend URL should match the API Gateway hostname from Pulumi:
- Development: `catalyst-gateway-dev-an3b0bg1.uc.gateway.dev`
- Staging/Production: Check Pulumi outputs

Note: Firebase API keys must be obtained from Firebase Console and added manually.

### Deployment to Staging/Production

When staging and production environments are set up, use these scripts to manage deployments:

1. **Prepare deployment configuration**:
   ```bash
   ./scripts/prepare-deployment.sh [stage|prod]
   ```
   This script:
   - Fetches configuration from Pulumi infrastructure
   - Creates/updates apphosting.yaml files
   - Provides a deployment checklist

2. **Validate environment before deployment**:
   ```bash
   ./scripts/validate-env.sh [dev|stage|prod]
   ```
   This script:
   - Validates all required environment variables
   - Tests API Gateway connectivity
   - Checks Pulumi infrastructure status

3. **Update only backend URL** (after infrastructure changes):
   ```bash
   npm run env:update-backend -- [stage|prod]
   ```

### Environment Variable Management

- **Development**: Uses `.env.local` (gitignored)
- **Staging/Production**: Uses `apphosting.[env].yaml` files
- **Secrets**: Stored in Google Secret Manager, never in code
- **Example files**: `.env.example.staging` and `.env.example.prod` document required variables

## Common Issues & Solutions

### API Gateway 504 Timeouts (RESOLVED)
- **Issue**: AgentHealthGCF was taking 18+ seconds on cold start
- **Solution**: Increased function memory from 256MB to 512MB in Pulumi configuration
- **Result**: Response time reduced from 18s to ~160ms (99%+ improvement)
- To apply memory changes to other functions experiencing cold start issues:
  1. Update `functions/component/gen1.go` to accept `MemoryMb` parameter
  2. Set `MemoryMb: 512` in function configuration in `main.go`
  3. Deploy with `pulumi up`

### Missing Functions in Pulumi State
- Run `pulumi refresh --yes` to detect missing resources
- Then `pulumi up --yes` to recreate them

### Authentication Errors
- Refresh credentials: `gcloud auth application-default login`
- Ensure correct project: `gcloud config set project wkv-interviewai-dev`
- Set quota project: `gcloud auth application-default set-quota-project wkv-interviewai-dev`

### Google Sign-In Not Working
- Manually enable Google provider in Firebase Console
- Add OAuth client ID to safelist in Firebase Authentication settings
- See `docs/deployment/google-auth-setup.md` for detailed steps
