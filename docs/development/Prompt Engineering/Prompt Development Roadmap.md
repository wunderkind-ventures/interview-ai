# Prompt Development Roadmap

**Version:** 1.4 **Date:** June 11, 2025 **Purpose:** This document outlines the structured process and deliverables required to design, develop, test, and evolve the agent prompts that will power the AI Interview Coach. It serves as a tactical guide to implement and continuously improve the agent architecture for all platform modules, incorporating an **Adaptive Reasoning** strategy.

## **Introduction**

The intelligence of the AI Interview Coach is dependent on the quality of its agent prompts. This roadmap establishes a systematic, multi-phase process to ensure our prompts are strategic, robust, and aligned with the platform's core vision. A key principle of this roadmap is **Adaptive Reasoning**: the system must dynamically select the appropriate level of reasoning complexity for a given task to maximize both accuracy and efficiency, avoiding "overthinking" on simple problems and "reasoning collapse" on complex ones.

## **Phase 1: Foundation & Agent Role Definition (The "Why")**

**Goal:** To achieve absolute clarity on the specific "Job to Be Done" (JTBD) for each agent in the system architecture. This prevents role overlap and ensures each agent's prompts are hyper-focused on its unique function.

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**1.1**|**Formalize Agent JTBD Statements:** Write a concise, one-sentence JTBD statement for each agent in the architecture, including those for the Mock Interview Hub (`Orchestrator`, `Context`, `Interviewer`, `Evaluator`, `Synthesis`, `Coaching`) and the Narrative Refinement Module (`Story Deconstructor`, `Impact Quantifier`, `Achievement Reframing`).|A finalized "Agent Job-to-Be-Done" definition document, covering all agents.|Product Lead, Lead AI Engineer|
|**1.2**|**Define Agent Boundaries & Anti-Goals:** For each agent, explicitly define what it _does not_ do. These "anti-goals" prevent scope creep. _Example: An anti-goal for the `Interviewer Agent` is "Does not provide real-time performance feedback to the user."_|"Agent Boundaries & Anti-Goals" section added to the JTBD document.|Product Lead, Lead AI Engineer|
|**1.3**|**Map Agent Inputs & Outputs:** Define the precise data contract for all agent interactions, including the pipeline flow for the Narrative Refinement Module (e.g., `Story Deconstructor` output schema becomes the input for `Impact Quantifier`).|An updated data flow diagram illustrating the inputs and outputs for all agent interactions across all modules.|Lead AI Engineer|

## **Phase 2: Logic & Evidence Extraction (The "What")**

**Goal:** To translate our methodologies into machine-executable rules and logic. **This now includes logic for assessing task complexity.**

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**2.1**|**Deconstruct Rubrics & Methodologies into Logic Statements:** Convert evaluation rubrics and the STAR method into logical conditions.|"Rubric-to-Logic Mapping" document.|Product Lead, AI/ML Specialist|
|**2.2**|**Create Evidence Extraction Directives:** Design the specific instructions and JSON output schemas for agents that analyze text.|Templates for analytical prompts and their required JSON output schemas.|AI/ML Specialist|
|**2.3**|**Develop Level-Based & Contextual Prompt Modifiers:** Create prompt modifications for the `Interviewer` and `Achievement Reframing` agents.|A document outlining all prompt directives and modifiers.|Product Lead, Content Strategist|
|**2.4**|**Develop Complexity Assessment Logic:** Design a lightweight mechanism or agent to rate the complexity of an input (e.g., a candidate's response) on a `LOW`, `MEDIUM`, `HIGH` scale.|A "Complexity Assessment Rubric" defining the signals for each level.|AI/ML Specialist, Product Lead|

## **Phase 3: State & Flow Control (The "How")**

**Goal:** To design the `Orchestrator Agent`'s state machine. **This now includes the adaptive routing logic.**

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**3.1**|**Design Comprehensive State Diagrams:** Create visual diagrams for all interactive flows.|Finalized State Flow Diagrams for all platform modules.|Product Lead, Lead AI Engineer|
|**3.2**|**Define State Transition Triggers:** For each transition, define the specific triggers.|A comprehensive "State Transition Logic" table for all modules.|AI/ML Specialist, Product Lead|
|**3.3**|**Implement Gating Conditions & Intervention Logic:** Design the rules that handle incomplete or unclear user input within all modules.|A comprehensive "Gating & Intervention Rules" document.|Product Lead, AI/ML Specialist|
|**3.4**|**Implement Adaptive Reasoning Workflow:** Update the `Orchestrator`'s logic to first assess the complexity of an input, then route it to the appropriate prompt (e.g., "lean" vs. "CoT") for the target agent.|An updated State Flow Diagram that includes the "Assess Complexity" step and routing logic.|Lead AI Engineer, AI/ML Specialist|

## **Phase 4: Persona & Tone Definition (The "Feel")**

**Goal:** To create a comprehensive style guide for all user-facing agents. **This now includes defining the tone for adaptive transitions.**

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**4.1**|**Develop All Persona Profiles:** Create detailed persona profiles for all user-facing agents (`Interviewer`, `Feedback Coach`, `Storytelling Coach`).|A complete "Agent Persona" guide.|Content Strategist, UX Writer|
|**4.2**|**Create a Unified Voice & Tone Guide:** For each persona, define a specific lexicon and tone-of-voice principles.|A comprehensive "Agent Voice & Tone Style Guide".|UX Writer, Content Strategist|
|**4.3**|**Define Tone for Adaptive Transitions:** Define the conversational "seams" for when the `Interviewer Agent` needs to shift its reasoning depth based on `Orchestrator` commands. _Example: A shift to deeper reasoning might be preceded by a phrase like, "That's an interesting point. Let's dive deeper into that."_|A new section in the Voice & Tone guide for "Transitional Language."|UX Writer, Product Lead|

## **Phase 5: Manual Prompt Implementation & Testing**

**Goal:** To write and test a **portfolio of initial prompts** for each analytical agent, validating their performance across different complexity regimes.

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**5.1**|**Draft Initial Prompt Portfolio:** For analytical agents (`Evaluator`, `Story Deconstructor`), draft at least two versions: a simple, zero-shot **"lean" prompt** for low-complexity tasks, and a sophisticated **"CoT" prompt** for medium-to-high complexity tasks.|Version 1.0 of the complete Agent Prompt Library, now containing multiple prompt versions per analytical agent.|AI/ML Specialist, Lead AI Engineer|
|**5.2**|**Develop Complexity-Based Test Suites:** Create categorized test suites for our analytical agents. For the `Evaluator`, this means having sample transcripts rated LOW, MEDIUM, and HIGH complexity.|A suite of categorized test cases for unit testing.|QA Team, Product Lead|
|**5.3**|**Unit & Integration Testing with Adaptive Logic:** Test the "lean" and "CoT" prompts against the categorized test suites. Validate that the `Orchestrator`'s adaptive routing sends inputs to the correct prompt and that the chosen prompt performs effectively and efficiently for its intended complexity level.|Test logs demonstrating the performance/cost trade-off for each prompt version against each complexity level.|QA Team, AI/ML Specialist|
|**5.4**|**Manual Iterative Refinement:** Based on testing, refine the prompts in the portfolio to better suit their target complexity regime.|Updated versions of the Agent Prompt Library, with a changelog documenting key improvements.|Entire Prompt Dev Team|

## **Phase 6: Automated & Evolutionary Prompt System (The "How to Evolve")**

**Goal:** To transition to an automated system that continuously evolves a **diverse portfolio of prompts**, optimizing for both accuracy and efficiency across different complexity levels.

|Task ID|Task Description|Key Deliverable(s)|Owner(s)|
|---|---|---|---|
|**6.1**|**Implement Automated Block-Level Optimization:** Develop a testing harness that automatically evaluates prompts against the complexity-based test suites from Task 5.2. The goal is to find the most token-efficient prompt that meets the accuracy bar for each complexity level.|An automated "unit test" pipeline for agent prompts.|Lead AI Engineer, AI/ML Specialist|
|**6.2**|**Evolve the Prompt Archive & Evolutionary Loop:** The Prompt Archive will now store metadata for each prompt, including its intended `complexity_level` (`LOW`, `MEDIUM`, `HIGH`). The `Prompt Engineer Agent` ("Mutator") will be given new directives, such as: "Generate a more complex CoT version of this lean prompt," or "Simplify this CoT prompt while trying to preserve its accuracy on medium-complexity tasks."|1. An enhanced Prompt Archive schema with complexity metadata. 2. A "Mutator Agent" prompt capable of generating prompt variations of different reasoning depths.|Lead AI Engineer, Product Lead|
|**6.3**|**Implement Self-Referential Feedback Loop:** The feedback loop remains, but can now be more targeted. _Example: If the system detects a "reasoning collapse" on a high-complexity task, it can trigger the `Mutator Agent` to try a different reasoning approach (e.g., Step-Back instead of CoT) for that prompt._|A more sophisticated feedback pipeline that can trigger specific mutation strategies based on failure modes.|AI/ML Specialist, Lead AI Engineer|
|**6.4**|**Develop an Automated Integration Test Harness:** The `Challenger Agent` will now be tasked with generating test cases that specifically probe the boundaries of the complexity regimes, helping to refine the `Orchestrator`'s routing logic.|1. An automated end-to-end testing pipeline. 2. A "Challenger Agent" designed to generate test cases of varying, and sometimes ambiguous, complexity.|QA Team, Lead AI Engineer|