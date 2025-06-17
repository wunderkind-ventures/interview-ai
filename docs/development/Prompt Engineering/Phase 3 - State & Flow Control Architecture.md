# P3 - State & Flow Control Architecture

**Version:** 1.0 **Associated Roadmap:** `prompt-dev-roadmap-v1.4` **Date:** June 11, 2025 **Purpose:** This document is the official deliverable for Phase 3 of the Prompt Development Roadmap. It defines the state machine, transition logic, and intervention rules for the `Orchestrator Agent`, which controls the end-to-end flow for both the **Mock Interview Hub** and the **Narrative Refinement Module**.

## **Part A: Mock Interview Module Flow Control**

This section outlines the state machine for the agents involved in conducting and evaluating mock interviews.

### **1. State Diagram: Mock Interview Lifecycle**

The following diagram illustrates the standard lifecycle of a mock interview session. The `Orchestrator Agent` manages the transitions between these states.

```
graph TD
    A[Start] --> B(Configuring);
    B --> C{Scoping};
    C --> D{Analysis};
    D --> E{Solutioning};
    E --> F{Metrics};
    F --> G{Challenging};
    G --> H(Report Generation);
    H --> I[End];

    %% Spontaneous Transitions
    C --> G;
    D --> G;
    E --> G;
```

### **2. State Transition Triggers: Mock Interview**

The `Orchestrator Agent` uses the following semantic triggers, detected in the candidate's responses, to transition the interview from one state to the next.

|From State|To State|Trigger Type|Trigger Description & Keywords|
|---|---|---|---|
|`Configuring`|`Scoping`|User Action|User clicks the "Start Interview" button. The `Orchestrator` issues the first directive to the `Interviewer Agent` to present the case prompt.|
|`Scoping`|`Analysis`|Semantic|Candidate signals they are done scoping and moving to analysis. Detect keywords like: _"Now I'll move on to the users..."_, _"The key user segments I see are..."_, _"To understand the problem better, let's identify the pain points."_|
|`Analysis`|`Solutioning`|Semantic|Candidate signals they are ready to propose a specific solution. Detect keywords like: _"Based on that analysis, the solution I'd propose is..."_, _"I've prioritized the following feature..."_, _"My recommendation is to build..."_|
|`Solutioning`|`Metrics`|Semantic|Candidate has detailed their solution and is now defining success. Detect keywords like: _"To measure success..."_, _"The KPIs I would track are..."_, _"The North Star metric for this would be..."_|
|`Metrics`|`Challenging`|Agent Action|The `Orchestrator` determines the candidate has sufficiently covered metrics and decides to inject a final challenge based on the interview flow.|
|`Challenging`|`Report Generation`|Semantic|Candidate provides a concluding answer to the final challenge question (e.g., _"So, given that constraint, I would adjust my MVP by..."_, _"That's how I would handle that situation."_). The `Orchestrator` signals the end of the interview.|
|Any State (`Scoping`, `Analysis`, `Solutioning`)|`Challenging`|Agent Action|The `Orchestrator Agent` can decide to inject a relevant challenge at any appropriate moment, often triggered by a timer or after a key part of the analysis is complete, to test the candidate's adaptability.|

### **3. Gating Conditions & Intervention Logic: Mock Interview**

This table defines the rules that prevent the mock interview from proceeding if a candidate misses a critical step, ensuring a high-quality evaluation.

|Gate Name|Condition to Trigger Gate|Intervention Directive to `Interviewer Agent`|
|---|---|---|
|**Prevent Premature Solutioning**|The candidate is in `Scoping` state AND their response contains `solution_keywords` AND the `Evaluator Agent`'s real-time score for "Problem Definition & Structuring" is < 3.|"The candidate is jumping to a solution too early. Gently guide them back. **Say this:** 'That's an interesting idea. Before we dive into solutions, could you first walk me through how you're structuring your overall approach to this problem?'"|
|**Ensure User Focus**|The candidate is in `Analysis` state AND has not mentioned `user_keywords` (e.g., "user," "customer," "persona") after several conversational turns.|"The candidate's analysis is not user-centric. Prompt them to focus on the user. **Say this:** 'This is a good start. Could you tell me more about the specific users or customers you are designing this for?'"|
|**Demand Prioritization Rationale**|The candidate is in `Solutioning` state AND has proposed a solution without explaining _why_ they chose it over other options.|"The candidate has not justified their prioritization. Probe for their rationale. **Say this:** 'That sounds like a viable solution. Can you walk me through why you chose this particular solution over other alternatives you may have considered?'"|
|**Require Measurable Metrics**|The candidate is in `Metrics` state AND has proposed vague metrics (`engagement`, `success`) AND the `Evaluator Agent`'s score for "Success Metrics" is < 3.|"The candidate's metrics are too vague. Push for specificity. **Say this:** 'That makes sense. Could you define 'engagement' more specifically? What is the single most important metric you would track as your North Star?'"|
|**Handle Silence or Confusion**|The user has not responded for more than 15 seconds OR their response contains keywords indicating confusion (`I'm not sure`, `I don't understand`).|"The candidate seems stuck. Offer a gentle nudge to help them proceed. **Say this:** 'This is a challenging problem. Why don't we start by identifying the main goal of the business in this scenario? What are they trying to achieve?'"|

## **Part B: Narrative Refinement Module Flow Control**

This section outlines the state machine for the agents involved in helping users craft and refine their professional stories.

### **4. State Diagram: Narrative Refinement Pipeline**

The following diagram illustrates the standard pipeline for a user refining a single achievement story.

```
graph TD
    A[Start Module] --> B(Awaiting Story Input);
    B -- User Submits Story --> C{Deconstructing};
    C -- Agent Needs Info --> D(Awaiting Clarification);
    D -- User Provides Info --> C;
    C -- Deconstruction Complete --> E{Quantifying};
    E -- Result Not Quantified --> F(Awaiting Quantification);
    F -- User Provides Metrics --> E;
    E -- Quantification Complete --> G{Reframing};
    G -- Agent Generates Outputs --> H[End];
```

### **5. State Transition Triggers: Narrative Refinement**

This table defines the triggers that move the narrative refinement pipeline from one state to the next.

|From State|To State|Trigger Type|Trigger Description & Conditions|
|---|---|---|---|
|`Awaiting Story Input`|`Deconstructing`|User Action|User submits the text of their raw story. The `Orchestrator` passes this text to the `Story Deconstructor Agent`.|
|`Deconstructing`|`Awaiting Clarification`|Agent Output|The `Story Deconstructor Agent` returns a JSON object where `status: "incomplete"`.|
|`Awaiting Clarification`|`Deconstructing`|User Action|The user submits a response to the `clarifying_question`. The `Orchestrator` appends this new text to the original story and re-runs the `Story Deconstructor Agent`.|
|`Deconstructing`|`Quantifying`|Agent Output|The `Story Deconstructor Agent` returns a JSON object where `status: "complete"`. The `Orchestrator` passes the `result` field to the `Impact Quantifier Agent`.|
|`Quantifying`|`Awaiting Quantification`|Agent Output|The `Impact Quantifier Agent` returns a JSON object where `quantified: false`.|
|`Awaiting Quantification`|`Quantifying`|User Action|The user provides answers to the `suggested_questions`. The `Orchestrator` appends these answers to the `result` text and re-runs the `Impact Quantifier Agent`.|
|`Quantifying`|`Reframing`|Agent Output|The `Impact Quantifier Agent` returns a JSON object where `quantified: true`. The `Orchestrator` passes the final, complete STAR JSON object to the `Achievement Reframing Agent`.|
|`Reframing`|`End`|Agent Output|The `Achievement Reframing Agent` returns its JSON output with the three reframed achievement formats. The `Orchestrator` displays these to the user.|

### **6. Gating Conditions & Intervention Logic: Narrative Refinement**

This table defines the rules for the interactive coaching loop within the Narrative Refinement Module.

|Gate Name|Condition to Trigger Gate|Intervention Action by `Orchestrator Agent`|
|---|---|---|
|**Incomplete STAR Story**|The `Story Deconstructor Agent` returns `status: "incomplete"`.|The `Orchestrator` presents the `clarifying_question` from the agent's output directly to the user. (e.g., _"Thanks for sharing that. It's a great start. To make it stronger, could you tell me more about what your specific goal or task was in that situation?"_)|
|**Unquantified Result**|The `Impact Quantifier Agent` returns `quantified: false`.|The `Orchestrator` presents one or more of the `suggested_questions` from the agent's output to the user. (e.g., _"This is a powerful result. To make it even more compelling for a resume, can we add a number to it? For example, by what percentage did you improve the process?"_)|
|**Low-Quality User Input**|User provides a very short (<10 words) or non-descriptive response to a clarifying question.|The `Orchestrator` re-prompts for more detail. (e.g., _"Could you elaborate a bit more on that? Providing specific details will help us craft the most powerful story."_)|