# InterviewAI Pre-Migration Product Requirements Document (PRD)

## Current State (as of June 2024)

### Application Overview
- **Frontend:**
  - Built with Next.js (React), located in `/src/`
  - Handles all user interaction, interview session management, and UI logic
  - Communicates with backend via RESTful API endpoints

- **Backend:**
  - Primary backend in Go, located in `/backends/catalyst-go-backend/`
  - Deployed as Google Cloud Functions and API Gateway (via Pulumi)
  - Handles business logic for interview flows, user API key management, and AI orchestration
  - Some prompt logic is currently embedded in Go code

- **Infrastructure:**
  - Managed with Pulumi (YAML and Go), in `/pulumi-gcp-catalyst-backend/`
  - Deploys GCP resources: Cloud Functions, API Gateway, IAM, Secret Manager, Monitoring, etc.

- **AI Model Integration:**
  - Currently uses Gemini (Google) as the primary LLM provider
  - API keys managed per user via Secret Manager

---

## Roadmap: Backend Modernization & Prompt Optimization

### 1. **Migrate Backend Logic to Go Genkit**
- Refactor all business logic and AI orchestration into modular Go Genkit flows
- Each flow encapsulates a single interview or AI operation (e.g., question generation, follow-up, hints)
- Flows are stateless and API-driven, enabling easy scaling and testing
- Expose flows as RESTful endpoints via a Go HTTP server (for Cloud Run) and as Cloud Functions for event-driven tasks

### 2. **Prompt Optimization & dotprompt Migration**
- Abstract all prompt templates from Go code into versioned `.prompt` files using [dotprompt](https://github.com/dotprompt/dotprompt)
- Prompts are parameterized, version-controlled, and can be updated without code changes
- Enable non-engineers (product/content teams) to iterate on prompt design
- Document all prompt variables and structure for maintainability

### 3. **A/B Testing of Prompts and Flows**
- Implement infrastructure to support A/B testing of prompts and Genkit flows
- Route a percentage of users to different prompt versions or flow logic
- Collect and analyze metrics (e.g., user feedback, completion rates) to optimize performance

### 4. **Multi-Provider Model Support**
- Refactor backend to support pluggable LLM providers (e.g., Gemini, OpenAI, Anthropic)
- Abstract model invocation logic to allow dynamic selection based on user, experiment, or feature flag
- Store and manage API keys securely for each provider

### 5. **API-First, Modular Architecture**
- Maintain a clean separation between frontend and backend via OpenAPI-documented REST endpoints
- Backend is stateless and does not assume any specific client (web, mobile, CLI, etc.)
- All business logic, prompt orchestration, and AI integration reside in the backend
- Frontend(s) can be swapped or extended with minimal changes

---

## Migration Steps (High-Level)
1. Audit and extract all prompt logic into dotprompt files
2. Refactor Go backend to use Genkit flows and dotprompt for prompt management
3. Modularize backend API layer and document with OpenAPI
4. Add support for multiple LLM providers and A/B testing infrastructure
5. Update frontend to consume new API endpoints as needed
6. Test, document, and monitor the new architecture

---

## Future Considerations
- Add a prompt management UI for non-technical team members
- Expand analytics and feedback collection for continuous improvement
- Explore serverless and containerized deployment strategies for cost and performance optimization

---

*This document reflects the current state and planned evolution of InterviewAI as of June 2024. For questions or suggestions, contact the engineering team.*

Product Requirements Document: InterviewAI
1. Introduction

Product Name: InterviewAI

Purpose: InterviewAI is an AI-powered web application designed to help job seekers prepare for various types of technical and behavioral interviews. It provides realistic interview simulations, personalized feedback, and tools to help users articulate their experiences and tailor their application materials. The goal is to build user confidence and improve their interview performance.

Version: 1.4 (reflecting addition of Admin Feedback and Technical Architecture Appendix)

2. Goals & Objectives

Provide users with realistic and challenging mock interview experiences across different interview types and FAANG-comparable difficulty levels.

Offer actionable, AI-driven feedback on user responses, including strengths, areas for improvement, and specific suggestions.

Enable users to customize their practice sessions based on job descriptions, resumes, target companies, and specific skills or focus areas.

Help users document and articulate their achievements using structured methods like STAR.

Assist users in crafting application materials like cover letters and tailoring resumes.

Empower users to track their progress and learn from past interview sessions.

Create a supportive and engaging environment for interview preparation.

Continuously evolve by incorporating advanced AI capabilities to offer deeper and more personalized preparation experiences.

Provide a mechanism for platform administrators to audit interviews and provide feedback to the system for quality improvement.

3. Target Audience

Job seekers preparing for roles in the tech industry (e.g., Software Engineers, Product Managers, Data Scientists, ML Engineers).

Students and new graduates entering the job market.

Professionals looking to change careers or advance in their current roles.

Individuals seeking to improve their interviewing skills for FAANG-level companies or similar competitive environments.

Platform administrators and content curators responsible for maintaining and improving interview quality.

4. Core Features (Implemented)

4.1. AI-Driven Interview Simulation:

Types: Product Sense, Technical System Design, Behavioral, Machine Learning (Conceptual & System Design), Data Structures & Algorithms.

Styles: Simple Q&A, Case Study (multi-turn, dynamic follow-ups), Take-Home Assignment (question generation, plus structured submission analysis - see 4.3).

Difficulty: Calibrated to FAANG levels (L3-L7), informed by leveling guidelines (Ambiguity, Complexity, Scope, Execution).

Dynamic AI Interviewer Personas: Users can select an interviewer persona (e.g., "Supportive Coach," "Skeptical Hiring Manager," "Time-Pressed Technical Lead," "Friendly Peer Interviewer," "Deep Dive Expert," "Antagonistic Challenger," "Apathetic Business Lead"), influencing the AI's tone and style of questioning.

Customization:

Optional Job Title and Job Description input.

Optional Resume input.

Optional Target Company input (special handling for "Amazon" for LPs).

Optional "Specific Focus" input.

Optional "Targeted Skills" selection.

"Themed Interview Packs" for quick setup (including "Amazon Final Round (Behavioral LP Focus)").

"Saved Custom Interview Setups": Users can save their entire interview configuration for quick reuse.

4.2. Interactive Interview Interface:

Real-time question presentation.

Textarea for user answers, Speech-to-text.

Timer for tracking answer duration.

In-interview helper tools (grouped under a "Help Tools" dropdown):

"Explain This Concept": AI explains a term from the question.

"Get a Hint": AI provides a subtle hint for the current question.

"View Sample Answer": AI generates an ideal answer for the current question.

"Clarify This Question": Users can ask the AI for clarification on the current interview question, and the AI responds in its adopted persona.

Note-taking area for "Case Study" interviews.

4.3. Performance Feedback & Analysis:

Per-Question Feedback: Structured (Critique, Strengths, Areas for Improvement, Suggestions), AI-generated Ideal Answer Pointers (based on question design and passed from question generation flow), User self-rated Confidence Score display, Reflection Prompts.

Overall Summary: Comprehensive summary including pacing.

"Deep Dive" Analysis: Option to get more detailed analysis on specific questions.

"Clarify Feedback": Ability to ask the AI follow-up questions about specific feedback points.

Structured Take-Home Assignment Submission & Feedback: Utilizes a specialized analysis flow (analyze-take-home-submission) for detailed feedback.

Admin Feedback Mechanism: A section on the interview summary page (conceptually visible to admins) allows for inputting and viewing structured feedback on interview sessions, targeting aspects like AI question quality or feedback quality.

4.4. User Accounts & Data Persistence (Firebase-based):

Google Authentication.

Interview History: Logged-in users can view a list of their past completed interviews and revisit their feedback summaries.

Saved Resumes: Users can save/load multiple resume versions.

Saved Job Descriptions: Users can save/load multiple JDs.

Saved Custom Interview Setups.

Achievements Log: STAR method documentation with AI structuring assistance.

Shared Assessment Repository: Users can upload their own assessments (marking them as public or private) and browse public assessments contributed by others (includes pagination and client-side filtering).

4.5. Resume Lab:

Standalone Resume Analysis and Resume-to-JD Tailoring.

Save/Load for resumes and JDs.

4.6. Cover Letter Crafter:

AI-generated draft cover letters.

Save/Load for resumes, JDs, and selection from saved achievements.

4.7. Export Interview Summary:

Downloadable Markdown file.

4.8. RAG-Augmented Question Generation (Simulated):

AI question generation flows are equipped with a simulated tool (findRelevantAssessmentsTool) to retrieve example assessment snippets, instructing the AI to use these for inspiration in generating new, unique questions.

5. Proposed New Features (Not Yet Implemented)

5.1. Full RAG Pipeline Implementation:

What: Transition the simulated RAG for question generation to a full pipeline:

Backend service for generating embeddings of public shared assessments.

Integration with a vector database for storing and searching these embeddings.

Update findRelevantAssessmentsTool to perform real similarity searches against the vector DB.

Why: To genuinely improve AI question diversity and relevance by leveraging the user-contributed assessment repository.

5.2. Advanced Resume-JD Alignment & Enhancement:

What: Resume-JD Score, Automated Tailoring Suggestions (Inline).

Why: Provides quantifiable fit and speeds up resume tailoring.

5.3. Skill Progression Tracking & Personalized Learning Roadmaps:

What: Track performance on "Targeted Skills," provide a "Skill Heatmap," and AI-suggested learning roadmaps.

Why: Offers long-term value and strategic preparation focus.

5.4. AI-Generated "Interviewer Persona" Hint:

What: AI provides a brief hint about its adopted persona at the start of a session.

Why: Helps users understand the AI's evaluation style and adapt.

5.5. File Upload for Take-Home Assignments:

What: Allow .txt or .md file uploads for take-home assignment submissions.

Why: Improves convenience for users.

5.6. Enhanced Admin Auditing Interface & Feedback Loop:

What: A dedicated admin dashboard to review interviews, admin feedback, and potentially flag sessions or AI outputs for review. Tools to categorize and analyze admin feedback to identify patterns for AI prompt/model improvements.

Why: Streamlines the quality control and AI improvement process.

5.7. Interactive "Build My STAR Story" Wizard for Achievements:

What: An AI-guided conversational wizard to help users verbally describe experiences and have the AI structure them into the STAR format for the Achievements Log.

Why: Lowers the barrier to documenting achievements and helps users articulate impact.

5.8. Amazon L7 PMT Mock Interview Experience (Detailed)

Purpose: To provide a high-fidelity, role-specific mock interview simulation for Amazon L7 Principal Product Management Technical (PMT) candidates, reflecting the unique expectations, rigor, and structure of Amazon's senior-level interview process.

User Stories:
- As a senior PMT candidate, I want to practice with realistic, multi-turn scenario-based questions that reflect the ambiguity, scope, and cross-functional impact expected at L7.
- As a user, I want the AI interviewer to simulate a Bar Raiser, Hiring Manager, and Peer PMT, so I can experience a panel-style interview.
- As a candidate, I want to receive feedback on how well my answers align with Amazon's Leadership Principles (LPs), especially at the L7 bar.
- As a user, I want to track which LPs have been covered and which are missing during my session.
- As a candidate, I want to be guided to structure my answers in the STAR format, with prompts for depth and scope appropriate for L7.
- As a user, I want to experience realistic follow-up questions, ambiguity, and pivots, as would occur in a real Amazon L7 PMT interview.

Key Features:

**1. Role-Specific Question Generation**
- Scenario-based, multi-turn questions tailored to L7 PMT responsibilities (e.g., product vision, cross-org influence, technical depth, ambiguity handling).
- Dynamic follow-ups that probe for scope, impact, and leadership.
- Option to select or randomize scenario themes (e.g., new product launch, crisis management, scaling challenges).

**2. Panel Interview Simulation**
- Simulate a panel with multiple AI interviewers:
  - Bar Raiser: Focuses on LPs, ambiguity, and raising the bar.
  - Hiring Manager: Focuses on business impact, team fit, and execution.
  - Peer PMT: Focuses on collaboration, technical depth, and stakeholder management.
- Each interviewer can ask questions, follow-ups, and provide feedback in their own style.

**3. Leadership Principle (LP) Tracking & Feedback**
- Real-time tracking of which LPs have been addressed in the session.
- After each answer, AI provides feedback on LP alignment, depth, and L7 calibration.
- End-of-session LP heatmap showing strengths and gaps.

**4. STAR Story Builder & Guidance**
- Interactive prompts to help users structure answers in the STAR format (Situation, Task, Action, Result).
- AI suggestions for increasing depth, scope, and cross-functional impact in responses.
- Option to save and review STAR stories for future reference.

**5. Realistic Interview Dynamics**
- Time-boxed questions and simulated interruptions.
- Ambiguity injection: AI may intentionally provide incomplete information, requiring the candidate to ask clarifying questions.
- "Curveball" follow-ups to test adaptability and critical thinking.

**6. Feedback & Calibration**
- Per-question and overall feedback calibrated to L7 expectations (scope, ambiguity, leadership, technical depth).
- AI-generated summary with actionable suggestions for improvement.
- Option for users to request deeper dives on specific LPs or competencies.

**7. Session Analytics & Progression**
- LP/competency heatmap for the session and over time.
- Track progress across multiple L7 PMT mock interviews.
- Personalized learning roadmap based on performance.

**8. Admin/Coach Tools (Future)**
- Option for a human coach or admin to join the session, observe, and provide additional feedback.
- Ability to flag AI questions or feedback for quality review.

**9. Export & Review**
- Downloadable session summary, including all questions, answers, feedback, and LP analysis.
- Option to share session results with mentors or peers for additional review.

---

6. Style Guidelines

Primary color: Vibrant blue (#29ABE2)

Background color: Light blue-gray (#F0F8FF)

Accent color: Electric purple (#7B68EE)

Typography: Clean and modern (Geist Sans).

Icons: Crisp, easily recognizable icons (Lucide React).

Layout: Structured, intuitive, responsive, with ShadCN UI components. UI improvements include better visual grouping in forms, enhanced feedback display, and clearer emphasis in forms. UX refinements include compact action buttons, grouped helper tools, and improved discoverability for clarification buttons.

Interactions: Subtle transitions and animations.

7. Non-Goals (for current & next immediate iterations)

Live coding environments or code execution/evaluation.

Video/audio recording of user and analysis of non-verbal cues.

Direct integration with job boards or ATS.

Real-time human mock interviewers.

Multi-language support beyond English for AI.

Extensive gamification.

Direct upload of complex binary file types (e.g., .pdf, .docx) requiring advanced parsing.

8. Success Metrics

User Engagement: Active users, interviews completed/user, session duration, feature usage.

User Retention: Return rates, cohort retention.

Task Completion & Feature Adoption: Saved items count, customization option usage.

Qualitative Feedback: User reviews, anecdotal success, satisfaction scores.

Platform Quality (Admin Perspective): Volume and nature of admin feedback, trends in AI performance based on audits.

9. Future Considerations (Beyond Next Iterations)

Deeper Company-Specific Insights (beyond Amazon LPs).

Structured Mock Interview "Courses" or "Paths."

Community & Social Features (anonymized sharing, peer feedback - carefully considered).

Preparation Planning Tools (checklists, reminders).

Advanced File Handling for Take-Homes (parsing .pdf, .docx).

More sophisticated RAG integration for feedback generation.

Appendix A: Technical Architecture Overview

A.1. Frontend:

Framework: Next.js (React framework)

Language: TypeScript

UI Components: ShadCN/UI, Lucide React (icons)

State Management: React Hooks (useState, useEffect, useContext, useReducer), React Hook Form (for forms)

Styling: Tailwind CSS

Client-Side Routing: Next.js App Router

A.2. Backend & AI Logic:

AI Flow Management: Genkit (TypeScript SDK)

Used to define, run, and manage AI flows for question generation, feedback analysis, resume analysis, cover letter generation, concept explanation, etc.

Flows are invoked as server-side functions/actions from the Next.js application.

AI Models:

Primarily leveraging Google's Generative AI models (e.g., Gemini family via Genkit plugins) for text generation, summarization, and analysis tasks.

Specific models (e.g., gemini-pro, text-embedding-gecko for future RAG) are configured within Genkit flows.

Speech-to-Text: Browser's Web Speech API (SpeechRecognition).

A.3. Database & Authentication:

Database: Firebase Firestore (NoSQL, document-based)

Stores user data (profiles, saved resumes, saved JDs, saved interview setups, achievements, interview history including session data and feedback).

Stores shared assessment documents for the repository.

Authentication: Firebase Authentication (Google Sign-In).

A.4. Deployment & Hosting (Assumed):

The application is designed to be deployable on platforms supporting Next.js (e.g., Vercel, Netlify, Firebase Hosting).

Environment variables are used for Firebase configuration and other sensitive keys, configured per deployment environment.

A.5. Key Architectural Patterns:

Client-Server Architecture: Next.js frontend interacts with server-side Genkit flows.

Component-Based UI: React components for modularity.

Serverless Functions (Implicit): Genkit flows can be thought of as serverless functions managed by the Genkit framework, callable from the Next.js backend.

Data Persistence: Firestore for structured and semi-structured data storage.

RAG (Retrieval Augmented Generation - Simulated/Planned):

Current: Simulated retrieval tool.

Planned: Involves embedding generation (e.g., Firebase Functions + embedding model) and a vector database for storing/querying shared assessment embeddings to augment AI model context.

A.6. Error Handling & Logging:

Client-side error handling with user feedback (e.g., toast notifications).

Console logging for debugging.

Firebase error codes and messages are used for diagnosing backend issues.

This PRD (Version 1.4) now includes the admin feedback feature and a technical architecture appendix.