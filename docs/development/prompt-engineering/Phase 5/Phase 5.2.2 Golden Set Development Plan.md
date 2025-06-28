# P5-2.2 - Golden Set Development Plan

**Version:** 1.0 **Associated Roadmap:** `prompt-dev-roadmap-v1.4` **Date:** June 11, 2025 **Purpose:** This document is the official deliverable for Task 5.2. It provides structured guidance and templates for the subject matter experts responsible for creating the "golden set" of test cases required for the `P5-2 Testing & Evaluation Framework`.

## **1. Introduction**

The validity of our entire testing framework hinges on the quality and realism of our test data. This document provides the plan and instructions for creating this "golden set." The objective is to produce a diverse, categorized, and accurately annotated corpus of test cases that will allow us to rigorously evaluate our AI agents' performance.

This plan covers three main areas:

1. Creating Mock Interview Transcripts for the `Evaluator Agent`.
    
2. Developing User Stories for the Narrative Refinement Module.
    
3. Sourcing and Annotating Resumes for the `Context Agent`.
    

## **2. Test Suite 1: Mock Interview Transcripts**

**Objective:** To create a suite of 30 mock interview transcripts (10 `LOW`, 10 `MEDIUM`, 10 `HIGH` complexity) to test the `Evaluator Agent`'s scoring accuracy and its Adaptive Reasoning capabilities.

### **Instructions for Transcript Authors:**

1. **Select a Case Prompt:** Use one of the standard case prompts (e.g., Product Design, Product Strategy, Amazon LP Behavioral).
    
2. **Embody a Persona:** Write the "candidate" portion of the transcript from the perspective of a specific persona (e.g., a junior PM who is strong on tactics but weak on strategy; a senior PM who thinks systemically).
    
3. **Adhere to Complexity Definitions:** Each transcript must clearly map to one of the complexity tiers below.
    

### **Complexity Tier Definitions:**

- **`LOW` Complexity:**
    
    - **Characteristics:** Linear, straightforward answer. Follows a simple "problem -> solution" structure. Does not explore significant trade-offs or strategic alternatives. Uses basic product terminology.
        
    - **Goal:** To test the `evaluator_agent_lean_v1.prompt` for speed and accuracy on simple inputs.
        
- **`MEDIUM` Complexity:**
    
    - **Characteristics:** Well-structured response, likely using a declared framework (e.g., "First, I'll define users..."). Discusses 1-2 clear trade-offs. Defines specific success metrics. Connects the solution to a business goal.
        
    - **Goal:** To test the `evaluator_agent_cot_v1.1.prompt` on a standard, good-but-not-perfect PM response.
        
- **`HIGH` Complexity:**
    
    - **Characteristics:** Convoluted, non-linear response. May mix strategy and tactics. Introduces multiple, potentially conflicting constraints or solutions. May challenge the premise of the question. Requires the evaluator to "connect the dots."
        
    - **Goal:** To test the `evaluator_agent_decompose_v1.prompt` and identify the boundaries of our system's reasoning capabilities.
        

### **Transcript Template:**

```
---
test_case_id: MIT-M-001
complexity: MEDIUM
type: Product Design
---

**Interviewer:** "Thanks for joining. Today's case is about improving user retention for a popular photo-sharing app. How would you approach this?"

**Candidate:** "That's a great question. Before I dive into solutions, I'd like to structure my approach. First, I'll identify the key user segments and their primary reasons for churning. Second, I'll brainstorm a few potential solutions tailored to the most at-risk segment. Third, I'll prioritize these solutions and detail the top one. Finally, I'll define how we'd measure success..."

[...continue transcript...]
```

## **3. Test Suite 2: Narrative Refinement Stories**

**Objective:** To create a suite of 25 user stories to test the full pipeline of the Narrative Refinement Module (`Story Deconstructor`, `Impact Quantifier`, `Achievement Reframing`).

### **Instructions for Story Authors:**

Create stories that fall into two categories:

1. **Well-Formed (N=10):** These stories should be clear and already contain most of the STAR components, including a quantified result. They are used to test the "happy path" of the pipeline.
    
2. **Vague & Incomplete (N=15):** These stories are more realistic. They must be missing at least one critical STAR component or lack any quantitative metrics. These are designed to test the `Story Deconstructor`'s clarification questions and the `Impact Quantifier`'s metric probes.
    

### **Example Test Cases:**

- **Well-Formed Example (`test_case_id: NRS-WF-001`):**
    
    > "In my role as PM for the mobile app, I was tasked with reducing the high user drop-off rate during the sign-up process. After analyzing the funnel, I hypothesized that the number of steps was the primary issue. I designed and A/B tested a new, simplified sign-up flow that reduced the steps from 7 to 3. This resulted in a 40% decrease in sign-up abandonment and increased new user activation by 15%."
    
- **Vague & Incomplete Example (`test_case_id: NRS-VI-001`):**
    
    > "The old reporting system was really slow and everyone complained about it. I was put in charge of fixing it. I worked with the engineering team for a few months to build a new version. The new system was much better and the team liked it." **(Expected `Deconstructor` question:** "What was your specific goal with the new system?" **Expected `Quantifier` question:** "That's a great outcome. Can you put a number on 'much better'? For example, by what percentage was the new system faster?")
    

## **4. Test Suite 3: Resume Corpus for `Context Agent`**

**Objective:** To create a "golden set" of 20 resumes for testing the `Context Agent`'s parsing accuracy.

### **Instructions for Corpus Curators:**

1. **Source Diverse Resumes:** Collect 20 real (anonymized) resumes. The set must include a variety of formats: single-column, multi-column, chronological, functional, creative/designed, and some with inconsistent formatting or minor typos.
    
2. **Create Ground Truth Annotation:** For each resume, manually create the "perfect" JSON output according to the schema defined in `P2`. This involves meticulously copying the text for each role, date, and accomplishment. This annotated JSON will be the ground truth against which the agent's output is measured.
    

## **5. Human Rater Consensus Process**

**Objective:** To establish a reliable "ground truth" for all subjective evaluations.

1. **Rater Panel:** All subjective evals (e.g., scoring interview transcripts, rating feedback quality) will be performed by a panel of at least 3 qualified human experts.
    
2. **Independent Rating:** Panelists will first score the assets independently using the provided rubrics without consulting one another.
    
3. **Calibration Session:** After independent scoring, the panel will meet for a calibration session. They will review cases with high score variance, discuss their reasoning, and align on a final **Consensus Score**.
    
4. **Final Ground Truth:** This Consensus Score will be recorded as the official ground truth for that test case. This process ensures our benchmarks are robust, fair, and free from the bias of a single individual.