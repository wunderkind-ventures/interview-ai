# P1 - Agent Job-to-Be-Done (JTBD) Definitions

**Version:** 1.0 **Associated Roadmap:** `prompt-dev-roadmap-v1.4` **Date:** June 11, 2025 **Purpose:** This document is the official deliverable for Phase 1 of the Prompt Development Roadmap. It provides the foundational specifications for every agent in the AI Interview Coach architecture, defining their core function (JTBD), operational boundaries, and data contracts.

## **1. Core Agents: The Mock Interview Engine**

These agents are responsible for executing the live mock interview experience.

### 1.1 Orchestrator Agent

- **Job to Be Done (JTBD):** To manage the state of the entire interview process, directing the flow of information and issuing phase-specific commands to other agents to ensure a coherent and logical user experience.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not directly interact with the user or generate conversational content.
        
    - _Anti-Goal:_ Does not perform evaluation or synthesis; it is purely a state manager and director.
        
- **Inputs:** User session start signal, real-time signals from other agents (e.g., `Evaluator Agent` scores for gating logic), state transition triggers from user conversation.
    
- **Outputs:** Phase-specific directives to other agents (e.g., `{ "command": "ask_question", "target_agent": "Interviewer", "params": { "phase": "scoping" } }`).
    

### 1.2 Context Agent

- **JTBD:** To parse unstructured user-provided documents (e.g., resumes) and transform them into a structured JSON summary of key experiences, skills, and projects.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not interpret the quality or effectiveness of the source document's content.
        
    - _Anti-Goal:_ Operates only during the pre-interview setup phase.
        
- **Inputs:** A raw document file (e.g., PDF, DOCX).
    
- **Outputs:** A structured JSON object for use by other agents (e.g., `{ "experience": [...], "skills": [...] }`).
    

### 1.3 Interviewer Agent

- **JTBD:** To conduct the live mock interview by asking relevant questions, adopting a specified persona, and executing phase-specific conversational tactics as directed by the `Orchestrator Agent`.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not evaluate the candidate's performance or provide any real-time feedback.
        
    - _Anti-Goal:_ Does not control the interview's flow or transitions between phases.
        
- **Inputs:** A directive from the `Orchestrator Agent`; structured context from the `Context Agent`.
    
- **Outputs:** Text-based questions and conversational probes directed to the user.
    

### 1.4 Evaluator Agent

- **JTBD:** To silently and continuously analyze the live interview transcript, scoring the candidate's performance against predefined rubrics and leveling guides while citing specific textual evidence for each rating.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not interact with the user or influence the interview's direction.
        
    - _Anti-Goal:_ Its evaluation is based solely on the provided rubrics, not on its own subjective "opinion."
        
- **Inputs:** The live interview transcript stream; relevant rubrics and leveling guides.
    
- **Outputs:** A structured JSON report containing scores, rationale, and evidence for each competency.
    

### 1.5 Synthesis Agent

- **JTBD:** To transform the structured, quantitative output from the `Evaluator Agent` into a coherent, human-readable qualitative summary of the candidate's performance.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not perform new evaluations; its summary is strictly based on the `Evaluator`'s output.
        
    - _Anti-Goal:_ Does not generate coaching advice or learning recommendations.
        
- **Inputs:** The final JSON report from the `Evaluator Agent`.
    
- **Outputs:** A narrative text summary for the user-facing feedback report.
    

### 1.6 Coaching Agent

- **JTBD:** To generate a personalized, actionable learning plan by identifying the candidate's lowest-scoring competencies from the evaluation and recommending specific, targeted resources.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not evaluate performance; its recommendations are based solely on the competency scores provided by the `Evaluator Agent`.
        
- **Inputs:** The final JSON report from the `Evaluator Agent`.
    
- **Outputs:** A structured list of curated learning resources.
    

## **2. Narrative Refinement Module Agents**

These agents work in a pipeline to help users craft and polish their professional stories.

### 2.1 Story Deconstructor Agent

- **JTBD:** To analyze a user's unstructured story and map it to the STAR method components, asking clarifying questions if a component is missing or unclear.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not judge the quality or impact of the story; it only deconstructs it into the STAR format.
        
- **Inputs:** Raw, unstructured text of a user's story.
    
- **Outputs:** A JSON object with `status` (`complete` or `incomplete`), `situation`, `task`, `action`, `result`, and a `clarifying_question` if the status is incomplete.
    

### 2.2 Impact Quantifier Agent

- **JTBD:** To analyze the "Result" component of a STAR story and prompt the user with targeted, contextual questions to help them add quantitative metrics if they are missing.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not invent or suggest metrics; it only asks questions to elicit them from the user.
        
    - _Anti-Goal:_ Does not validate the truthfulness of the user's claimed metrics.
        
- **Inputs:** The "Result" text from the `Story Deconstructor Agent`.
    
- **Outputs:** A JSON object with a boolean `quantified` field and an array of `suggested_questions` if `quantified` is false.
    

### 2.3 Achievement Reframing Agent

- **JTBD:** To take a complete, quantified STAR story and expertly rewrite it into three distinct, optimized formats: a concise resume bullet, a compelling behavioral interview narrative, and a persuasive cover letter snippet.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not create new content or achievements; it only reframes the final, user-approved story.
        
- **Inputs:** The final, quantified STAR story JSON, plus optional context (`target_company`, `job_description_snippet`).
    
- **Outputs:** A JSON object containing three string fields: `resume_bullet`, `behavioral_story_narrative`, and `cover_letter_snippet`.
    

## **3. Meta-Agents: The Evolutionary Engine**

These agents are responsible for the continuous, automated improvement of the platform itself, as outlined in Phase 6 of the roadmap.

### 3.1 Prompt Engineer Agent (Mutator/Optimizer)

- **JTBD:** To improve the system's performance by programmatically generating new "child" variations of existing "parent" prompts based on performance data and a set of engineering principles.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not evaluate the prompts it creates; this is the job of the automated testing harness.
        
- **Inputs:** A high-performing "parent" prompt, its performance data, and a directive from the `Orchestrator` (e.g., "Incorporate Step-Back prompting logic into this prompt.").
    
- **Outputs:** One or more new "child" prompt text variations to be added to the Prompt Archive for testing.
    

### 3.2 Challenger Agent

- **JTBD:** To enhance system robustness by autonomously generating a diverse set of adversarial test cases and challenging user personas to be used in the automated integration testing harness.
    
- **Boundaries & Anti-Goals:**
    
    - _Anti-Goal:_ Does not evaluate the system's response to its challenges; it only generates the inputs.
        
- **Inputs:** A high-level directive (e.g., "Generate 5 difficult candidate personas for a behavioral interview.").
    
- **Outputs:** A structured set of test cases for the automated testing pipeline.