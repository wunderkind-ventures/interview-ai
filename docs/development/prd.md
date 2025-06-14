# Product Requirements Document: InterviewAI

**Version:** 1.0 (Reflecting current implemented features)
**Date:** October 26, 2023 (Placeholder Date)

## 1. Introduction

*   **Product Name:** InterviewAI
*   **Purpose:** InterviewAI is an AI-powered web application designed to help job seekers prepare for various types of technical and behavioral interviews. It provides realistic interview simulations, personalized feedback, and tools to help users articulate their experiences and tailor their application materials. The goal is to build user confidence and improve their interview performance.

## 2. Goals & Objectives

*   Provide users with realistic and challenging mock interview experiences across different interview types and FAANG-comparable difficulty levels.
*   Offer actionable, AI-driven feedback on user responses, including strengths, areas for improvement, and specific suggestions.
*   Enable users to customize their practice sessions based on job descriptions, resumes, target companies, and specific skills or focus areas.
*   Help users document and articulate their achievements using structured methods like STAR.
*   Assist users in crafting application materials like cover letters.
*   Empower users to track their progress and learn from past interview sessions.
*   Create a supportive and engaging environment for interview preparation.

## 3. Target Audience

*   Job seekers preparing for roles in the tech industry (e.g., Software Engineers, Product Managers, Data Scientists, ML Engineers).
*   Students and new graduates entering the job market.
*   Professionals looking to change careers or advance in their current roles.
*   Individuals seeking to improve their interviewing skills for FAANG-level companies or similar competitive environments.

## 4. Core Features (Implemented)

### 4.1. AI-Driven Interview Simulation
*   **Interview Types Supported:**
    *   Product Design (e.g., "How would you improve X product?")
    *   Product Strategy (e.g., market entry, competitive response)
    *   Estimation/Analytical (e.g., market sizing, metric definition)
    *   Root Cause Analysis (e.g., "Metric X dropped, why?")
    *   Technical System Design
    *   Behavioral (using the STAR method)
    *   Machine Learning (Conceptual & System Design)
    *   Data Structures & Algorithms
*   **Interview Styles:**
    *   **Simple Q&A:** Standard question-and-answer format.
    *   **Case Study (Multi-turn):** AI presents an initial scenario and then asks dynamic follow-up questions based on user answers.
    *   **Take-Home Assignment:** AI generates a comprehensive assignment prompt.
*   **Difficulty Calibration:** User can select a target FAANG Level (L3-L7) to adjust question complexity and depth.
*   **Customization Options:**
    *   **Job Title & Description:** Users can input these to help AI tailor questions.
    *   **Resume Input:** Users can paste or upload (.txt) their resume for contextual understanding.
    *   **Target Company:** Specify a target company (e.g., "Amazon" to emphasize Leadership Principles).
    *   **Specific Focus:** Users can provide a sub-topic to narrow the interview's theme.
    *   **Targeted Skills:** Selectable skills based on the chosen interview type.
    *   **Interviewer Persona:** Users can select an AI interviewer persona (e.g., Standard, Friendly Peer, Skeptical Hiring Manager, Time-Pressed Technical Lead, Behavioral Specialist, Antagonistic Challenger, Apathetic Business Lead).
    *   **Themed Interview Packs:** Pre-configured setups for common scenarios (e.g., "Amazon Final Round - Behavioral LP Focus").

### 4.2. Interactive Interview Interface
*   Real-time presentation of AI-generated questions.
*   Textarea for users to type their answers.
*   **Speech-to-Text:** Microphone input for dictating answers.
*   **Timer:** Tracks time taken for each answer.
*   **In-Interview Helper Tools (Dropdown Menu):**
    *   "Explain This Concept": AI provides a concise explanation of a term.
    *   "Get a Hint": AI offers a subtle hint for the current question.
    *   "View Sample Answer": AI generates an ideal sample answer for the current question.
    *   "Clarify This Question": User can ask the AI for clarification on the AI's current question.
*   **Note-Taking Area:** Available for "Case Study" interviews for users to jot down notes.

### 4.3. Performance Feedback & Analysis
*   **On-Demand Feedback Generation:** Users explicitly request feedback after completing an interview.
*   **Per-Question Feedback (Structured):**
    *   **Critique:** Overall assessment of the answer.
    *   **Strengths:** Positive aspects of the answer.
    *   **Areas for Improvement:** Specific weaknesses or gaps.
    *   **Specific Suggestions:** Actionable advice for improvement.
    *   **Ideal Answer Pointers (AI-Generated):** Key elements a strong answer would typically include, based on question design.
    *   **User Confidence Score Display:** Shows the user's self-rated confidence for their answer.
    *   **Reflection Prompts:** AI-generated prompts to encourage self-reflection.
*   **Overall Summary:** A comprehensive AI-generated summary of the user's performance, including comments on pacing.
*   **"Deep Dive" Analysis:** Option to request more detailed AI analysis on specific questions, covering:
    *   Detailed Ideal Answer Breakdown
    *   Alternative Approaches
    *   Follow-up Scenarios
    *   Suggested Study Concepts
*   **"Clarify Feedback":** Users can ask the AI follow-up questions about specific points in the generated feedback.

### 4.4. User Accounts & Data Persistence (Firebase-based)
*   **Authentication:** Google Sign-In for user accounts.
*   **Interview History:** Logged-in users can view a list of their past completed interviews and revisit their feedback summaries.
*   **Saved Resumes:** Users can save multiple resume versions (via paste or .txt upload) and load them for interview setup or other features.
*   **Saved Job Descriptions:** Users can save multiple job descriptions and load them.
*   **Saved Custom Interview Setups:** Users can save their entire interview configuration (type, style, level, focus, etc.) for quick reuse.
*   **Achievements Log:**
    *   Users can document their career achievements using the STAR method (Situation, Task, Action, Result).
    *   Includes fields for date achieved, skills demonstrated, and quantifiable impact.
    *   AI assistance is available to help structure each component of the STAR method.

### 4.5. Resume Lab
*   **Standalone Resume Analysis:** AI provides general feedback on a pasted resume (strengths, weaknesses, clarity/impact scores, actionable suggestions).
*   **Resume-to-JD Tailoring:** AI provides suggestions on how to tailor a resume to a specific job description (keywords from JD, missing keywords in resume, relevant experiences to highlight, overall fit assessment).
*   Save/Load functionality for resumes and job descriptions within the Resume Lab.

### 4.6. Cover Letter Crafter
*   AI generates a draft cover letter based on:
    *   User-provided job description.
    *   User's resume.
    *   User-provided summary of key achievements (can be loaded from saved achievements).
    *   Company name and optional hiring manager name.
    *   Desired tone (e.g., Professional, Enthusiastic).
*   Save/Load functionality for resumes and JDs.
*   Ability to select and load achievements from the "My Achievements" log.

### 4.7. Assessment Repository
*   **User Uploads:** Authenticated users can upload interview assessments (title, type, style, level, content, keywords, notes, source).
*   **Public Sharing:** Users can mark their uploaded assessments as "public."
*   **"My Uploads" View:** Users can view and manage the assessments they have personally uploaded.
*   **"Public Repository" View:** Users can browse and view assessments shared publicly by others.
    *   Includes pagination for loading more assessments.
    *   Includes basic client-side search (title, content, keywords) and filtering (by type, level).
*   **RAG Foundation (Simulated):** A simulated Genkit tool (`findRelevantAssessmentsTool`) exists to demonstrate how the AI *could* use the repository to inform question generation. (Full backend RAG pipeline with embeddings and vector DB is not yet implemented).

### 4.8. Export Interview Summary
*   Users can download a Markdown file of their completed interview session.
*   Options to include/exclude various sections (setup details, questions, answers, feedback, ideal pointers, sample answers, deep dives, overall summary).

## 5. Style Guidelines (Brief Overview)

*   **UI Components:** Primarily ShadCN UI components.
*   **Visuals:** Clean, modern, professional aesthetic.
*   **Colors:** Theme based on a vibrant blue primary, light blue-gray background, and electric purple accent.
*   **Icons:** Lucide React for clear visual cues.
*   **Responsiveness:** Basic responsiveness for common screen sizes.

## 6. Non-Goals (for current scope)

*   Live coding environments or code execution/evaluation.
*   Video/audio recording of the user for non-verbal cue analysis.
*   Direct integration with job boards or application tracking systems (ATS).
*   Real-time human mock interviewers or scheduling.
*   Multi-language support beyond English for AI interactions.
*   Advanced gamification elements (badges, leaderboards, points).
*   Full backend implementation of RAG pipeline with vector databases and embedding generation for the Assessment Repository (currently simulated at the tool level).

## 7. Success Metrics (Examples)

*   **User Engagement:**
    *   Number of active users.
    *   Number of interviews completed per user.
    *   Average session duration.
    *   Frequency of use for helper tools (Hint, Explain, Sample Answer, Clarify Feedback).
    *   Usage of Resume Lab and Cover Letter Crafter.
*   **User Retention:**
    *   Percentage of users returning after their first session.
*   **Content & Feature Adoption:**
    *   Number of saved items (resumes, JDs, achievements, custom setups).
    *   Number of assessments contributed to the repository.
*   **Qualitative Feedback:** (If a feedback mechanism is implemented)
    *   User satisfaction scores.
    *   Anecdotal reports of interview success.

## 8. Future Considerations / Potential Enhancements

*   Full implementation of the RAG pipeline for the Assessment Repository.
*   Advanced Admin Auditing and Feedback tools for AI system improvement.
*   More granular skill tracking and personalized learning roadmaps.
*   Deeper company-specific interview simulations beyond Amazon LPs.
*   "Product Innovation Story" specific take-home style for PM roles.
*   Enhanced UI/UX refinements based on user testing.
*   Verbal/Conversational input for adding achievements.

    