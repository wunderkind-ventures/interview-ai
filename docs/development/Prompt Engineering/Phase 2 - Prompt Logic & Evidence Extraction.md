# P2 - Prompt Logic & Evidence Extraction

**Version:** 1.0 **Associated Roadmap:** `prompt-dev-roadmap-v1.4` **Date:** June 11, 2025 **Purpose:** This document is the official deliverable for Phase 2 of the Prompt Development Roadmap. It provides the detailed technical specifications required to translate the platform's rubrics and methodologies into machine-executable logic and directives for the AI agents.

## **Part A: Mock Interview Module**

This part contains the logic and schemas for the agents involved in conducting and evaluating mock interviews.

### **1. Task 2.1: Deconstructing Rubrics into Logic Statements**

The following tables operationalize the evaluation rubrics by defining specific, detectable signals for each competency. The `Evaluator Agent` will be programmed to identify these signals in the candidate's transcript.

#### **1.1 Product Design Rubric Logic**

|

| **Competency** | **Logic & Signals to Detect** | | **Problem Definition & Structuring** | - **Initial Action Check:** Does the candidate's first turn contain `question_keywords` (e.g., "clarify," "understand," "what do you mean by," "scope") before `solution_keywords` (e.g., "I would build," "the feature would," "my solution is")? - **Framework Identification:** Detect presence of `framework_keywords` (e.g., "my approach is," "first I will," "I'll structure this by," "CIRCLES method"). - **Constraint Seeking:** Detect keywords related to constraints (`technical`, `resource`, `timeline`, `business goal`, `metric`). | | **User Empathy & Insight** | - **Persona Specificity:** Analyze noun phrases associated with "user." Score higher for specific personas ("commuters listening to podcasts on the subway") vs. generic demographics ("young people"). - **Pain Point Articulation:** Detect explicit statements linking a feature to a user problem using patterns like "[Solution] solves [User Pain Point]." - **Quote Analysis:** Extract direct quotes describing user feelings, motivations, or frustrations. | | **Solution Ideation & Creativity** | - **Solution Count:** Count the number of distinct solutions proposed during the brainstorming phase. Score higher for >2 distinct ideas. - **Novelty Check:** Compare proposed solutions against a corpus of standard product features. Flag and score higher for novel concepts (e.g., "gamified social listening" vs. "a share button"). - **Practicality Acknowledgement:** Detect keywords related to feasibility (`practical`, `feasible`, `engineering effort`, `MVP`). | | **Prioritization & Trade-Off Analysis** | - **Framework Application:** Detect explicit mentions of prioritization frameworks (`RICE`, `Kano`, `impact vs. effort`, `MoSCoW`). - **Trade-off Language:** Identify phrases indicating comparison and choice, such as "the trade-off here is," "we gain X but lose Y," "we chose A over B because..." - **MVP Scoping:** Analyze the proposed feature set for an MVP. Score higher for a lean set of features explicitly tied to a core user problem and learning goal. | | **Success Metrics & Data-Driven Approach** | - **Metric Specificity:** Score higher for specific, measurable metrics ("Daily Active Sharers") versus vague ones ("engagement"). - **North Star Identification:** Detect the phrase "North Star metric." - **Counter-Metric Check:** Detect mentions of "guardrail metrics," "counter-metrics," or discussion of potential negative consequences (e.g., "we need to make sure this doesn't cannibalize..."). |

#### **1.2 Product Strategy Rubric Logic**

| **Competency** | **Logic & Signals to Detect** | | **Market & Competitive Analysis** | - **Competitor Identification:** Count the number of unique competitors named. - **SWOT Language:** Detect keywords associated with strategic analysis (`strengths`, `weaknesses`, `opportunities`, `threats`, `competitive advantage`, `moat`). - **Market Trend Analysis:** Identify discussion of external market forces or shifts in user behavior. | | **Strategic Rationale & Business Acumen** | - **Business Model Keywords:** Detect terms like `monetization`, `revenue stream`, `CAC`, `LTV`, `business model`, `partnerships`. - **Alignment Statement Check:** Look for explicit statements linking the product strategy to company-level goals (e.g., "This aligns with the company's goal of..."). | | **Go-to-Market (GTM) Strategy** | - **GTM Component Check:** Detect mentions of core GTM components (`launch phases`, `beachhead market`, `target segment`, `PR`, `marketing channels`, `sales enablement`). - **Phasing Language:** Identify discussion of a multi-phase rollout (`Phase 1`, `pilot`, `beta`, `full launch`). | | **Risk & Mitigation Planning** | - **Risk Identification:** Count the number of distinct risks identified (`technical risk`, `market risk`, `execution risk`). - **Mitigation Linkage:** For each identified risk, check for a corresponding `mitigation_keyword` (e.g., "to mitigate this," "we can de-risk this by," "the plan to address this is"). | | **Long-Term Vision** | - **Temporal Language:** Detect future-oriented phrases (`in 3-5 years`, `the long-term vision`, `the end-state is`, `ultimately we want to`). - **Scalability Keywords:** Identify terms like `platform`, `ecosystem`, `scalable mechanism`, `network effects`. |

### **2. Task 2.2: Evidence Extraction Schema for `Evaluator Agent`**

This section defines the core prompt template and required JSON output format for the `Evaluator Agent`.

#### **2.1 Core Analytical Prompt Template**

```
You are an expert, unbiased Product Management interview evaluator. Your sole job is to analyze the provided interview transcript and score the candidate's performance against the provided rubrics and leveling guides. You must be objective and base your analysis strictly on the evidence in the transcript.

**INPUTS:**
1.  **Transcript:** {Full interview transcript text}
2.  **Rubric:** {JSON object containing the rubric for the interview type}
3.  **Leveling Guide:** {JSON object containing the leveling dimension definitions}

**INSTRUCTIONS (Chain of Thought):**
For each competency in the rubric, perform the following steps:
1.  **Identify Evidence:** Scan the transcript for all phrases, statements, and conversational turns relevant to this competency.
2.  **Analyze Evidence:** Compare the extracted evidence against the behavioral anchors in the rubric for that competency.
3.  **Justify Score:** Write a single sentence that directly links a specific piece of evidence to a specific behavioral anchor in the rubric.
4.  **Assign Score:** Assign a numerical score from 1 to 5 based on your analysis.
5.  **Select Quotes:** Extract up to three direct quotes from the transcript that best support your score.

After evaluating all competencies, perform a final leveling assessment:
1.  **Synthesize Dimensions:** Based on all evidence, assess the candidate's performance on the core leveling dimensions of Ambiguity, Complexity, Scope, and Execution.
2.  **Determine Level:** Compare this assessment to the provided Leveling Guide and determine the most appropriate level (e.g., "L5", "L6", "L7").
3.  **Justify Leveling:** Write a concise rationale for your leveling decision.

**OUTPUT:**
You must return a single, valid JSON object with no extraneous text that conforms to the schema provided.

```

#### **2.2 Required JSON Output Schema**

```
{
  "overall_level_assessment": {
    "assessed_level": "L6",
    "rationale": "The candidate consistently operated at a strategic level, defining their own strategy and handling complex trade-offs, which aligns with L6 expectations.",
    "evidence_for_dimensions": {
      "ambiguity": "Handled a vague prompt by asking insightful clarifying questions to define scope and goals.",
      "complexity": "Successfully navigated a problem with multiple conflicting constraints.",
      "scope": "The solution's impact was framed at an organizational level.",
      "execution": "Demonstrated a shift from tactical execution to strategic definition."
    }
  },
  "competency_scores": [
    {
      "competency": "Problem Definition & Structuring",
      "score": 5,
      "rationale": "Candidate asked multiple insightful clarifying questions that reframed the problem and articulated a clear, sophisticated framework before proceeding.",
      "evidence_quotes": [
        "Before I start, can we clarify what 'success' means for this business?",
        "My approach will be to first define the user segments, then ideate solutions for the highest-value segment."
      ]
    }
  ]
}

```

### **3. Task 2.3: Level-Based Directives for `Interviewer Agent`**

The `Orchestrator Agent` will prepend the `Interviewer Agent`'s core prompt with one of the following directives to calibrate its behavior.

- **For L5 (Product Manager II):** `Directive: You are interviewing a candidate for a mid-level Product Manager (L5) role. The candidate is expected to demonstrate strong product ownership and tactical execution. Focus your probes on **how** they would implement their ideas. Prioritize questions that test their ability to work with a team, define a clear MVP, and handle **difficult** (but not overwhelmingly complex) problems.`
    
- **For L6 (Senior Product Manager):** `Directive: You are interviewing a candidate for a Senior Product Manager (L6) role. The candidate is expected to demonstrate strategic ownership and the ability to operate independently. Focus your probes on **why** their solution is the right one for the business. Challenge them to **determine their own strategy**. Test their ability to handle **complex** problems with conflicting constraints.`
    
- **For L7 (Principal Product Manager):** `Directive: You are interviewing a candidate for a Principal PM (L7) role. The candidate is expected to demonstrate vision and the ability to handle significant ambiguity. Frame your questions to assess their ability to think long-term and at scale. Challenge them to **set the vision** for the entire product area.`
    

## **Part B: Narrative Refinement Module**

This part contains the logic and schemas for the agents that help users craft their professional stories.

### **4. Task 2.1b: Deconstructing Methodologies into Logic Statements**

| **Agent** | **Methodology** | **Logic & Signals to Detect** | | **`Story Deconstructor`** | **STAR Method Parsing** | - **Identify Components:** Scan for keywords signaling each part: `Situation:` ("the project was," "the team was facing"), `Task:` ("my goal was," "I was responsible for"), `Action:` (focus on "I designed," "I led," "I built"), `Result:` ("the outcome was," "this resulted in," "we achieved"). - **Gap Analysis:** After parsing, check if any of the S, T, A, or R components are `null`. If so, trigger a clarifying question. | | **`Impact Quantifier`** | **Quantitative Impact Detection** | - **Metric Pattern Matching:** Scan the "Result" text for patterns: `%`, `$`, `[number]x improvement`, `reduced from [X] to [Y]`, `days`, `weeks`, `conversion rate`, `latency`, `churn`. - **Question Generation Logic:** If no metrics are found, generate contextual questions. _Example: If story context includes `server`, suggest questions about `latency (ms)` or `cost savings ($)`._ | | **`Achievement Reframing`** | **Contextual Rewrite Logic** | - **Resume Bullet:** Enforce starting with a strong `action_verb` and validate word count. - **Behavioral Story:** Ensure narrative flows in the S -> T -> A -> R sequence. - **Cover Letter:** Check that the output explicitly mentions the `{{target_company}}` name. |

### **5. Task 2.2b: Analytical Schemas for Narrative Agents**

#### **5.1 `Story Deconstructor` Schema**

- **Prompt Template:** Instructs the agent to parse a user's story into STAR components and ask one clarifying question if a component is missing.
    
- **Required JSON Output Schema:**
    
    ```
    {
      "status": "'complete' or 'incomplete'",
      "situation": "string or null",
      "task": "string or null",
      "action": "string or null",
      "result": "string or null",
      "clarifying_question": "string or null"
    }
    
    ```
    

#### **5.2 `Impact Quantifier` Schema**

- **Prompt Template:** Instructs the agent to analyze the "Result" text and generate targeted questions if quantitative metrics are absent.
    
- **Required JSON Output Schema:**
    
    ```
    {
      "quantified": "boolean",
      "suggested_questions": ["string", "string", ...]
    }
    
    ```
    

#### **5.3 `Achievement Reframing` Schema**

- **Prompt Template:** Instructs the agent to rewrite the final STAR story into three formats, using optional context about the target role and company.
    
- **Required JSON Output Schema:**
    
    ```
    {
      "resume_bullet": "string",
      "behavioral_story_narrative": "string",
      "cover_letter_snippet": "string"
    }
    
    ```
    

### **6. Task 2.3b: Contextual Directives for `Achievement Reframing Agent`**

- **For Resume:** `Directive: Focus on extreme conciseness and impact. Start with a strong action verb and end with the most impressive quantified metric.`
    
- **For Cover Letter:** `Directive: Focus on persuasion. Your goal is to connect the candidate's past achievement to the future needs of the target company.`
    
- **For Behavioral Interview:** `Directive: Focus on narrative flow. Your goal is to create an engaging story. Ensure smooth transitions between Situation, Task, Action, and Result.`