
# Project Context: InterviewAI

**Version:** 1.0 (As of current feature set)
**Date:** (Current Date)

## 1. Project Overview

*   **Product Name:** InterviewAI
*   **Purpose:** InterviewAI is an AI-powered web application designed to help job seekers prepare for various types of technical and behavioral interviews. It provides realistic interview simulations, personalized feedback, and tools to help users articulate their experiences and tailor their application materials. The goal is to build user confidence and improve their interview performance.
*   **Target Audience:** Job seekers in the tech industry (Software Engineers, Product Managers, Data Scientists, ML Engineers), students, new graduates, and professionals looking to change careers or advance.
*   **Key Goal:** To empower users to perform better in real-world job interviews by providing a comprehensive, AI-driven preparation platform.

## 2. Core Implemented Features

*   **AI-Driven Mock Interviews:**
    *   **Types:** Product Sense, Technical System Design, Behavioral, Machine Learning (Conceptual & System Design), Data Structures & Algorithms.
    *   **Styles:** Simple Q&A, Case Study (multi-turn, dynamic follow-ups), Take-Home Assignment (question generation).
    *   **Customization:**
        *   FAANG Level (L3-L7) for difficulty calibration.
        *   Optional inputs: Job Title, Job Description, Resume, Target Company (special handling for "Amazon" LPs), Specific Interview Focus, Targeted Skills (dynamic based on interview type).
        *   Selectable AI Interviewer Personas (e.g., Standard, Skeptical, Friendly Peer, Antagonistic Challenger).
        *   Themed Interview Packs (pre-configured setups for common scenarios).
*   **Interactive Interview Interface:**
    *   Real-time question presentation.
    *   Textarea for user answers, with optional Speech-to-Text functionality.
    *   Timer for answer duration (for Q&A and Case Study).
    *   Note-taking area specifically for "Case Study" interviews.
    *   In-interview "Help Tools" (Dropdown):
        *   Explain This Concept (AI explains a term).
        *   Get a Hint (AI provides a hint for the current question).
        *   View Sample Answer (AI generates an ideal answer).
        *   Clarify This Question (User asks AI to clarify its own question).
*   **Performance Feedback & Analysis:**
    *   **On-Demand Generation:** User explicitly requests feedback after an interview.
    *   **Per-Question Feedback (Structured):** Critique, Strengths, Areas for Improvement, Specific Suggestions, AI-generated Ideal Answer Pointers (based on question design), display of user's self-rated Confidence Score, AI-generated Reflection Prompts.
    *   **Overall Summary:** Comprehensive AI-generated summary of performance, including comments on pacing.
    *   **"Deep Dive" Analysis:** Option for more detailed AI analysis on specific questions.
    *   **"Clarify Feedback":** Users can ask the AI follow-up questions about specific points in the generated feedback.
*   **User Accounts & Data Persistence (Firebase):**
    *   Google Authentication for user accounts.
    *   **Interview History:** Logged-in users can view a list of their past completed interviews (stored in Firestore) and revisit their feedback summaries.
    *   **Saved Resumes & Job Descriptions:** Users can save and load multiple resume and job description versions to/from Firestore.
    *   **Saved Custom Interview Setups:** Users can save and load their entire interview configuration.
    *   **Achievements Log:** Users can document career achievements using the STAR method (Situation, Task, Action, Result), including AI assistance for structuring each component. Achievements are saved to Firestore.
*   **Resume Lab:**
    *   **Standalone Resume Analysis:** AI provides general feedback on a pasted resume.
    *   **Resume-to-JD Tailoring:** AI provides suggestions on how to tailor a resume to a specific job description.
    *   Save/Load functionality for resumes and JDs within the Lab.
*   **Cover Letter Crafter:**
    *   AI generates a draft cover letter based on JD, resume, selected saved achievements, company info, and desired tone.
    *   Save/Load functionality for resumes and JDs; selection from saved achievements.
*   **Assessment Repository:**
    *   Authenticated users can upload their interview assessments (questions, cases).
    *   Option to mark assessments as "public."
    *   "My Uploads" view for managing personal contributions.
    *   "Public Repository" view to browse assessments shared by others, with pagination and basic client-side search/filtering.
    *   **Simulated RAG:** A Genkit tool (`findRelevantAssessmentsTool`) exists to *simulate* how the AI *could* use the repository to inform question generation. Full backend RAG pipeline (embeddings, vector DB) is not yet implemented.
*   **Export Interview Summary:**
    *   Users can download a Markdown file of their completed interview session with selectable content sections.
*   **Bring Your Own API Key (BYOK) - Prototype:**
    *   Users can (optionally) provide their own Google AI Gemini API key via a Settings page.
    *   This key is stored in Firestore (associated with the user, **not production-secure for API keys**).
    *   Select AI flows (e.g., question generation) attempt to use this user-provided key if available, falling back to a default if not. This is a prototype and lacks robust production secret management.

## 3. Technology Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **UI Components:** React, ShadCN UI
*   **Styling:** Tailwind CSS
*   **AI Integration:** Genkit (using the TypeScript SDK)
    *   **AI Models:** Google AI (Gemini models, e.g., `gemini-2.0-flash`)
*   **Database & Authentication:** Firebase
    *   **Authentication:** Firebase Authentication (Google Sign-In)
    *   **Database:** Firestore (for user data, interviews, resumes, JDs, achievements, settings, assessments)
*   **Client-Side State Management:** React Context (`AuthContext`), `useState`, `useEffect`.
*   **Form Handling:** `react-hook-form` with `zod` for validation.
*   **Local Storage:** Used for persisting in-progress interview session data and setup before explicit saving to backend for logged-in users.
*   **Speech-to-Text:** Browser's Web Speech API (client-side).

## 4. Architectural Patterns & Key Decisions

*   **Genkit Flows (`'use server';`):** All AI-related logic (question generation, feedback, analysis, etc.) is encapsulated in Genkit flows. These are TypeScript modules marked with `'use server';` and are invoked as Next.js server actions from client components.
*   **Specialized AI Agents/Flows:** The system employs an orchestrator flow (`customizeInterviewQuestions`) that delegates tasks to more specialized flows for different interview styles (Simple Q&A, Case Study initial setup, Take-Home assignment generation) and also for feedback refinement (`refineInterviewFeedback`).
*   **Dynamic Case Study Follow-ups:** Case study interviews use a dedicated flow (`generateDynamicCaseFollowUp`) to generate subsequent questions based on the ongoing conversation.
*   **Zod Schemas:** Zod is used extensively to define the input and output schemas for all Genkit flows, ensuring data integrity and providing type safety. Shared Zod schemas are located in `src/ai/schemas.ts`.
*   **Firebase Integration:** Firestore is the primary database for persisting user-specific data. Firebase Authentication handles user sign-up and login.
*   **Client-Side Session Persistence:** `localStorage` is used to hold the state of an ongoing interview, allowing users to refresh or return to an in-progress session. This data is then synced to Firestore for logged-in users upon completion.
*   **Simulated RAG:** The "Assessment Repository" feature includes a Genkit tool that *simulates* retrieving relevant assessment snippets. A full RAG pipeline (embedding generation, vector database storage, and similarity search) is not currently implemented.
*   **Constants-Driven Configuration:** Key options like interview types, levels, skills, and themed packs are defined in `src/lib/constants.ts` for centralized management and easy updates.
*   **Component-Based UI:** The frontend is built with reusable React components, primarily from ShadCN UI.

## 5. Important Project Files & Directories

*   **`src/app/`**: Contains Next.js App Router page definitions and layouts.
    *   `layout.tsx`: Root layout, includes `AuthProvider`.
    *   `page.tsx`: Main landing page (interview setup).
    *   `interview/page.tsx`: Active interview session page.
    *   `feedback/page.tsx`: Interview summary and feedback page.
    *   `achievements/page.tsx`: User achievements log.
    *   `history/page.tsx`: User's past interview history.
    *   `resume-lab/page.tsx`: Resume analysis and tailoring tool.
    *   `cover-letter-crafter/page.tsx`: Cover letter generation tool.
    *   `assessment-repository/page.tsx`: Shared assessment repository.
    *   `settings/page.tsx`: User settings (e.g., BYOK API key).
*   **`src/components/`**: Reusable React components.
    *   `ui/`: ShadCN UI components.
    *   Feature-specific components (e.g., `interview-setup-form.tsx`, `interview-session.tsx`, `interview-summary.tsx`, `achievements-manager.tsx`, etc.).
    *   `layout/`: Header and Footer components.
*   **`src/ai/`**: All Genkit related code.
    *   `flows/`: Individual Genkit flows for different AI tasks.
    *   `tools/`: Genkit tools (e.g., `assessment-retrieval-tool.ts`).
    *   `schemas.ts`: Shared Zod schema definitions for AI flows.
    *   `genkit.ts`: Global Genkit AI client initialization.
    *   `dev.ts`: Genkit development server configuration (registers flows and tools).
*   **`src/lib/`**: Core utilities and constants.
    *   `constants.ts`: Application-wide constants (interview types, levels, personas, themed packs, skills).
    *   `types.ts`: TypeScript interface and type definitions.
    *   `utils.ts`: General utility functions.
*   **`src/contexts/`**: React Context providers.
    *   `auth-context.tsx`: Manages Firebase authentication state.
*   **`docs/`**: Project documentation.
    *   `prd.md`: This Product Requirements Document.
    *   `level_guidelines.md`: Amazon job level guidelines (used conceptually to inform AI).
*   **`package.json`**: Lists all project dependencies, including `next`, `react`, `firebase`, `genkit`, `lucide-react`, `zod`, etc.
*   **`.env.local` (User-managed, not in repo):** Contains Firebase project credentials (API key, auth domain, project ID, etc.) necessary for Firebase services to initialize.

## 6. Current Status & Known Limitations

*   **Functional Prototype:** The application is a functional prototype with a wide range of features for mock interview preparation.
*   **BYOK Security:** The "Bring Your Own API Key" feature stores the user's key in Firestore. This is a **prototype-level implementation** and **not secure for production use** of sensitive API keys. A production system would require backend-managed, encrypted secret storage (e.g., Google Secret Manager) and backend-mediated API calls.
*   **RAG Simulation:** The Retrieval Augmented Generation for assessment content is currently *simulated* by a tool. A full RAG pipeline would require:
    *   A backend process for generating embeddings for new public assessments.
    *   Integration with a vector database for storing and searching these embeddings.
    *   The `findRelevantAssessmentsTool` would need to be updated to perform real embedding generation (for the query) and similarity search against the vector DB.
*   **Admin Auditing:** A basic mechanism for admins (identified by a placeholder email) to add feedback to interview sessions exists. A full admin interface with role management and dedicated review tools is not implemented.
*   **Error Handling:** While basic error handling is in place (toasts, alerts), comprehensive error handling for all edge cases (especially for AI interactions and external service calls) can be further improved.
*   **Scalability:** For a large number of users or assessments, Firestore queries might need optimization with composite indexes, and the RAG pipeline would definitely need scalable infrastructure.
*   **UI/UX:** Continuously evolving; further refinements can always be made for better intuitiveness and visual appeal.

## 7. Environment Setup & Configuration

*   **Firebase Project:** A Firebase project is required, with Authentication (Google Sign-In enabled) and Firestore Database enabled.
*   **Environment Variables (`.env.local`):** Critical Firebase project configuration keys (API Key, Project ID, Auth Domain, etc.) must be set in a `.env.local` file for the Firebase SDK to initialize correctly during local development. For deployed environments, these must be configured in the hosting provider's settings.
*   **Firestore Security Rules:** Security rules must be configured in the Firebase console to control access to Firestore data (e.g., allowing users to read/write their own data).
*   **Genkit:** Genkit flows are developed in TypeScript and run as server-side functions.

This document should provide a solid understanding of the InterviewAI project's current state and architecture.
