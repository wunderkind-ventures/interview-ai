# P5-2 Testing & Evaluation Framework

**Version:** 1.2 **Associated Roadmap:** `prompt-dev-roadmap-v1.4` **Date:** June 11, 2025 **Purpose:** This document is the official deliverable for the testing and evaluation portion of Phase 5. It establishes the comprehensive, multi-layered framework and guiding principles for measuring the performance, quality, and efficacy of the AI Interview Coach platform and its constituent agents.

## **1. Introduction: A Multi-Layered Approach to Evaluation**

To ensure the quality and effectiveness of our complex, multi-agent system, we will employ a multi-layered evaluation framework. This approach allows us to validate the system at different levels of granularity, from the technical accuracy of a single agent to the real-world value delivered to our users. This framework is essential for both our initial manual testing (Phase 5) and our long-term automated evolutionary system (Phase 6).

The three layers of our evaluation framework are:

1. **Agent-Level Evals (Unit Tests):** Does each agent perform its specific, isolated job correctly and efficiently?
    
2. **Module-Level Evals (Integration Tests):** Do the agents work together effectively to deliver a high-quality, valuable feature output?
    
3. **System-Level Evals (User Success Metrics):** Does the platform, as a whole, help our users achieve their goals?
    

## 2. Guiding Principles for Eval Development

The design and implementation of our evaluation framework will be governed by the following five principles. They ensure our testing process is rigorous, insightful, and aligned with our strategic goals.

### **2.1 The Principle of Specificity and Measurability**

- **Why it Matters:** Vague assessments lead to ambiguous results. To improve our system, we need precise, quantifiable data on its performance. This principle is inspired by the data-driven culture emphasized in the Amazon hiring documents.
    
- **Implementation Guideline:** Every Agent-Level Eval must be tied to a specific, quantifiable metric. We will avoid subjective assessments and use established statistical measures where possible.
    

### **2.2 The Principle of Contextual Realism**

- **Why it Matters:** Our agents must perform in the real world, not just in a sterile lab environment. Our tests must reflect the messy, imperfect nature of real user inputs.
    
- **Implementation Guideline:** Our "golden sets" for testing must be representative of real-world inputs, including their flaws and variations.
    

### **2.3 The Principle of Human-in-the-Loop Ground Truth**

- **Why it Matters:** For many of our tasks, "correctness" is subjective and best determined by expert consensus. Relying on a single person's judgment introduces unacceptable bias.
    
- **Implementation Guideline:** For any eval that requires subjective judgment (e.g., scoring an interview, rating story quality), the ground truth must be established by a panel of at least 2-3 expert human raters. The agent's performance is measured against the **consensus** of this panel.
    

### **2.4 The Principle of Complexity-Aware Evaluation**

- **Why it Matters:** As demonstrated in the "Illusion of Thinking" research, a single performance score can be misleading. An agent might excel at simple tasks but collapse when faced with complexity. We must understand these performance cliffs.
    
- **Implementation Guideline:** All relevant Agent-Level Evals must be segmented into complexity tiers (`LOW`, `MEDIUM`, `HIGH`). We will measure both **accuracy** and **efficiency** (e.g., token count, latency) for each tier.
    

### **2.5 The Principle of Comprehensive Failure Analysis**

- **Why it Matters:** A simple pass/fail result tells us _what_ happened, but not _why_. The most valuable insights come from understanding the root cause of a failure.
    
- **Implementation Guideline:** Every failed test case in an Agent-Level Eval must be categorized by its failure mode. This analysis is the primary input for our evolutionary improvements in Phase 6.
    

## **3. Eval Development Rubric**

To ensure we adhere to these principles, we will use a "meta-rubric" to evaluate the quality of our own evaluation processes, covering all five principles.

## **4. Layer 1: Agent-Level Evals (Unit Tests)**

**Goal:** To rigorously validate the functional correctness and efficiency of each individual agent against a "golden set" of test data.

|Agent to Evaluate|What We Measure (The "Eval")|Methodology & Connection to Documents|
|---|---|---|
|**`Context Agent`**|**Parsing Accuracy:** How accurately does it extract and classify roles, accomplishments, and skills from a resume?|**Methodology:** We will create a "golden set" of 20 diverse resumes and manually map them to the target JSON schema. The agent's output will be measured against this ground truth using **Precision, Recall, and F1 Score** for entity extraction.|
|**`Evaluator Agent`**|**Scoring Accuracy & Rubric Adherence:** How closely do the agent's scores align with expert human raters across varying levels of complexity?|**Methodology:** We will create a test suite of 30 mock interview transcripts, categorized by complexity. A panel of 3 expert human raters will score these transcripts. The agent's scores will be compared to the human consensus, measuring **Mean Squared Error (MSE)** and **Inter-Rater Reliability (e.g., Cohen's Kappa)**. **Connection:** This directly addresses the core finding of the "Illusion of Thinking" paper.|
|**`Story Deconstructor`**|**STAR Component Identification:** How accurately does it map a raw story to the S, T, A, and R components?|**Methodology:** We will write 25 sample stories, including some with intentionally missing components. We will manually label each sentence/clause with its correct STAR component and evaluate for **classification accuracy**. **Connection:** The Amazon interview guides are crystal clear that the **STAR method is non-negotiable**. This eval ensures our agent enforces that structure with precision.|
|**`Impact Quantifier`**|**Metric Detection & Question Relevance:** How well does it identify the absence of metrics and ask insightful, relevant questions?|**Methodology:** We will create two sets of 20 "Result" statements: one quantified, one not. We measure the **False Positive Rate** on the first set and use human raters to score the **relevance** of the questions generated for the second set. **Connection:** Amazon is a "data and metric driven company" (`PM-T.pdf`). This eval validates that our agent effectively pushes users toward this mindset.|

## **5. Layer 2: Module-Level Evals (Integration Tests)**

**Goal:** To assess the end-to-end quality of a user-facing module, focusing on the value of the final output generated by the collaborating agents.

|Module to Evaluate|What We Measure (The "Eval")|Methodology & Connection to Documents|
|---|---|---|
|**Narrative Refinement Module**|**Quality and "Hired-ness" of the Reframed Achievements:** Are the generated resume bullets and behavioral stories compelling and effective?|**Methodology:** We will run 10 raw stories through the entire pipeline. We will then present the final outputs to a panel of professional tech recruiters or hiring managers. They will rate the outputs on a 1-5 scale for **Impact**, **Clarity**, and "How likely would this story be to pass a screening at your company?". **Connection:** This is a direct test of our system's value. The `How to ACE your Amazon interview.docx` provides the "gold standard" for what a strong story looks like. This eval measures how close our AI can get to that standard.|
|**Mock Interview Module**|**Quality of the Final Feedback Report:** Is the generated report insightful, actionable, clear, and fair?|**Methodology:** We will generate 15 complete feedback reports from a diverse set of mock interviews. We will then give these reports (with scores hidden) to expert human raters (e.g., experienced PMs, hiring managers). They will score the _report itself_ using the **Feedback Quality Rubric** below on dimensions like Actionability, Clarity, and Tone. **Connection:** This evaluates the critical user-facing output of the `Synthesis` and `Coaching` agents. This is the ultimate test of whether we are providing a valuable coaching experience, and the results will be a key input for our evolutionary improvements (Phase 6), as inspired by the feedback loops in the "DGM" and "MASS" papers.|

### **Feedback Quality Rubric (for Layer 2 Eval)**

This rubric will be used by human raters to score the quality of the final feedback reports generated by the system.

|Dimension|Needs Development (1-2)|Meets Expectations (3)|Exceeds Expectations (4-5)|
|---|---|---|---|
|**Actionability**|Feedback is generic or high-level (e.g., "Improve your communication"). It is unclear what the user should do next.|Feedback provides some concrete suggestions, but they may not be directly tied to the user's specific performance.|Feedback is highly specific and provides concrete, actionable steps the user can take immediately (e.g., "When discussing trade-offs, next time try to use the RICE framework to structure your argument.").|
|**Clarity & Conciseness**|The summary is rambling, contains jargon, or is difficult to understand. Key takeaways are buried.|The summary is generally understandable, but may be overly verbose or contain some unclear phrasing.|The summary is exceptionally clear, concise, and well-structured. It delivers the key messages with high impact and is easy to skim.|
|**Specificity & Evidence**|Feedback makes claims without providing supporting evidence from the interview (e.g., "Your user empathy was weak.").|Feedback references the user's performance but may not provide specific quotes or examples.|Every piece of feedback is directly supported by specific examples or direct quotes from the user's performance, making the assessment feel fair and well-grounded.|
|**Tone & Persona**|The tone is harsh, overly critical, robotic, or generic. It does not feel like it's coming from an expert coach.|The tone is professional and generally supportive, but may lack a strong, authoritative coaching voice.|The tone perfectly embodies the **`Feedback & Storytelling Coach`** persona: authoritative, empowering, constructive, and deeply invested in the user's success.|

## **6. Layer 3: System-Level Evals (User Success Metrics)**

**Goal:** To measure whether the platform is delivering meaningful value to our users and achieving its strategic objectives. This is tracked via production telemetry.

| What We Measure (The "Eval")       | How We Measure It                                                                                                                                                                      | Connection to Documents & Strategy                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User Confidence & Preparedness** | Post-session surveys asking users to rate "How much more prepared do you feel for your interviews now?" on a 1-10 scale. The primary KPI is the average score and its trend over time. | This is our North Star metric for user value. If we are succeeding, users must _feel_ more prepared and confident.                                                                                           |
| **Feedback Report Utility**        | A simple "Was this feedback helpful?" (Yes/No) button on every generated report, along with an optional field for open-ended comments. The KPI is the % of "Yes" responses.            | This provides a direct, continuous signal on the quality of our Layer 2 outputs. As the "Darwin Gödel Machine" paper suggests, this feedback is critical for our long-term, self-improving system (Phase 6). |
| **User Engagement & Retention**    | Standard product metrics, including **Session Completion Rate** (for both modules), **Repeat Usage** (number of sessions per user over 30 days), and **Week-over-Week Retention**.     | These metrics tell us if the product is valuable enough to be used repeatedly. High engagement is a strong proxy for perceived value and is essential for the platform's long-term success.                  |