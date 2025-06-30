"""Prompt Portfolio - Implementation of Phase 5.1 lean/CoT prompt variants."""

from typing import Dict, Any, List, Optional
from enum import Enum
from dataclasses import dataclass

from common.config import ComplexityLevel, AgentName


class PromptType(str, Enum):
    """Types of prompts in the portfolio."""
    LEAN = "lean"          # Zero-shot, simple prompts for low complexity
    COT = "chain_of_thought"  # Chain of thought for medium complexity  
    STEP_BACK = "step_back"   # Step-back prompting for high complexity
    SELF_REFLECTION = "self_reflection"  # Self-reflection for very high complexity


@dataclass
class PromptVariant:
    """A single prompt variant."""
    id: str
    prompt_type: PromptType
    complexity_level: ComplexityLevel
    agent_name: AgentName
    template: str
    performance_metrics: Dict[str, float]
    created_at: str
    parent_id: Optional[str] = None  # For evolutionary variants


class PromptPortfolio:
    """
    Prompt Portfolio implementing Phase 5.1 requirements.
    
    Manages lean and CoT prompt variants for different complexity levels
    and provides adaptive routing based on complexity assessment.
    """
    
    def __init__(self):
        self.prompts: Dict[str, PromptVariant] = {}
        self.routing_rules: Dict[ComplexityLevel, PromptType] = {
            ComplexityLevel.LOW: PromptType.LEAN,
            ComplexityLevel.MEDIUM: PromptType.COT,
            ComplexityLevel.HIGH: PromptType.STEP_BACK,
            ComplexityLevel.VERY_HIGH: PromptType.SELF_REFLECTION
        }
        
        # Initialize with base prompt variants
        self._initialize_base_prompts()
    
    def _initialize_base_prompts(self):
        """Initialize base prompt variants for each agent and complexity level."""
        
        # Evaluator Agent Prompts
        self._add_evaluator_prompts()
        
        # Story Deconstructor Prompts  
        self._add_story_deconstructor_prompts()
        
        # Impact Quantifier Prompts
        self._add_impact_quantifier_prompts()
        
        # Achievement Reframing Prompts
        self._add_achievement_reframing_prompts()
    
    def _add_evaluator_prompts(self):
        """Add Evaluator agent prompt variants."""
        
        # LEAN prompt for low complexity
        self.prompts["evaluator_lean"] = PromptVariant(
            id="evaluator_lean",
            prompt_type=PromptType.LEAN,
            complexity_level=ComplexityLevel.LOW,
            agent_name=AgentName.EVALUATOR,
            template="""
            Evaluate this interview response on a scale of 1-5 for each dimension:
            
            Response: "{user_response}"
            
            Rate these dimensions:
            1. Problem Understanding (1-5)
            2. Solution Approach (1-5) 
            3. Communication Clarity (1-5)
            
            Return JSON: {{"problem_understanding": X, "solution_approach": X, "communication_clarity": X, "overall_score": X}}
            """,
            performance_metrics={"accuracy": 0.85, "latency_ms": 800, "cost_per_eval": 0.002},
            created_at="2025-01-01"
        )
        
        # CoT prompt for medium complexity
        self.prompts["evaluator_cot"] = PromptVariant(
            id="evaluator_cot",
            prompt_type=PromptType.COT,
            complexity_level=ComplexityLevel.MEDIUM,
            agent_name=AgentName.EVALUATOR,
            template="""
            I need to evaluate this interview response systematically. Let me think through each dimension step by step.
            
            Response: "{user_response}"
            Context: {context}
            
            Let me analyze each dimension:
            
            1. Problem Understanding:
            First, I'll check if the candidate understood the core problem...
            - Do they identify key requirements?
            - Do they ask clarifying questions?
            - Do they recognize constraints?
            
            2. Solution Approach:
            Next, I'll evaluate their approach...
            - Is the methodology logical?
            - Do they break down the problem systematically?
            - Are they considering trade-offs?
            
            3. Technical Depth:
            Now for technical competency...
            - Are technical details accurate?
            - Do they use appropriate terminology?
            - Is their depth suitable for the level?
            
            4. Communication Clarity:
            Finally, communication assessment...
            - Is the explanation clear and logical?
            - Do they use effective examples?
            - Is the flow easy to follow?
            
            Based on this analysis, my evaluation is:
            {{"problem_understanding": X, "solution_approach": X, "technical_depth": X, "communication_clarity": X, "overall_score": X, "reasoning": "step by step rationale"}}
            """,
            performance_metrics={"accuracy": 0.92, "latency_ms": 1500, "cost_per_eval": 0.008},
            created_at="2025-01-01"
        )
        
        # STEP_BACK prompt for high complexity
        self.prompts["evaluator_step_back"] = PromptVariant(
            id="evaluator_step_back",
            prompt_type=PromptType.STEP_BACK,
            complexity_level=ComplexityLevel.HIGH,
            agent_name=AgentName.EVALUATOR,
            template="""
            Before evaluating this specific response, let me step back and consider the broader context of what makes an excellent response at this level.
            
            High-level question: What distinguishes exceptional {interview_type} responses for {faang_level} candidates?
            
            Key principles for evaluation:
            - Technical depth should demonstrate senior-level thinking
            - Problem decomposition should be sophisticated
            - Solutions should consider scalability and maintainability
            - Communication should be clear yet detailed
            
            Now, applying these principles to evaluate:
            Response: "{user_response}"
            
            Step 1: Assess against senior-level expectations
            Step 2: Evaluate systematic problem-solving approach  
            Step 3: Check for advanced considerations (scalability, edge cases, trade-offs)
            Step 4: Evaluate communication effectiveness
            
            Detailed evaluation with evidence:
            {{"problem_understanding": X, "solution_approach": X, "technical_depth": X, "scalability_consideration": X, "communication_clarity": X, "overall_score": X, "evidence": ["specific examples"], "senior_level_rationale": "explanation"}}
            """,
            performance_metrics={"accuracy": 0.95, "latency_ms": 2200, "cost_per_eval": 0.015},
            created_at="2025-01-01"
        )
    
    def _add_story_deconstructor_prompts(self):
        """Add Story Deconstructor prompt variants."""
        
        # LEAN prompt for simple stories
        self.prompts["story_deconstructor_lean"] = PromptVariant(
            id="story_deconstructor_lean",
            prompt_type=PromptType.LEAN,
            complexity_level=ComplexityLevel.LOW,
            agent_name=AgentName.CONTEXT,  # Story deconstructor uses CONTEXT enum
            template="""
            Extract STAR components from this story:
            
            Story: "{story_text}"
            
            Return JSON:
            {{"situation": "context", "task": "goal", "action": "steps taken", "result": "outcome", "status": "complete/incomplete"}}
            
            Use null for missing components.
            """,
            performance_metrics={"accuracy": 0.78, "latency_ms": 600, "cost_per_eval": 0.001},
            created_at="2025-01-01"
        )
        
        # CoT prompt for complex stories
        self.prompts["story_deconstructor_cot"] = PromptVariant(
            id="story_deconstructor_cot", 
            prompt_type=PromptType.COT,
            complexity_level=ComplexityLevel.MEDIUM,
            agent_name=AgentName.CONTEXT,
            template="""
            I need to carefully deconstruct this story into STAR components. Let me analyze it systematically.
            
            Story: "{story_text}"
            
            Let me work through this step by step:
            
            Step 1: Identify the Situation
            Looking for context, background, setting...
            
            Step 2: Find the Task
            What was the specific goal, responsibility, or challenge...
            
            Step 3: Extract the Action  
            What specific steps did the person take...
            
            Step 4: Determine the Result
            What was the outcome or impact...
            
            Step 5: Assess completeness
            Are all STAR components clearly present and detailed enough?
            
            Based on this analysis:
            {{"situation": "detailed context", "task": "specific goal", "action": "concrete steps", "result": "measurable outcome", "status": "complete/incomplete", "missing_components": [], "clarifying_question": "specific question if needed"}}
            """,
            performance_metrics={"accuracy": 0.88, "latency_ms": 1200, "cost_per_eval": 0.005},
            created_at="2025-01-01"
        )
    
    def _add_impact_quantifier_prompts(self):
        """Add Impact Quantifier prompt variants."""
        
        # LEAN prompt for obvious metrics
        self.prompts["impact_quantifier_lean"] = PromptVariant(
            id="impact_quantifier_lean",
            prompt_type=PromptType.LEAN,
            complexity_level=ComplexityLevel.LOW,
            agent_name=AgentName.EVALUATOR,  # Impact quantifier uses EVALUATOR enum
            template="""
            Check if this result has quantitative metrics:
            
            Result: "{result_text}"
            
            Return JSON:
            {{"quantified": true/false, "existing_metrics": ["list"], "suggested_questions": ["questions to get metrics"]}}
            """,
            performance_metrics={"accuracy": 0.82, "latency_ms": 500, "cost_per_eval": 0.001},
            created_at="2025-01-01"
        )
        
        # CoT prompt for subtle quantification opportunities
        self.prompts["impact_quantifier_cot"] = PromptVariant(
            id="impact_quantifier_cot",
            prompt_type=PromptType.COT,
            complexity_level=ComplexityLevel.MEDIUM,
            agent_name=AgentName.EVALUATOR,
            template="""
            I need to analyze this result for quantification opportunities. Let me think through different types of metrics systematically.
            
            Result: "{result_text}"
            
            Step 1: Scan for existing metrics
            Looking for numbers, percentages, dollar amounts, time savings...
            
            Step 2: Identify metric categories that could apply
            - Financial impact (cost savings, revenue, budget)
            - Performance metrics (speed, efficiency, accuracy) 
            - Scale metrics (users, volume, reach)
            - Quality metrics (satisfaction, error rates)
            - Time metrics (duration, frequency, deadlines)
            
            Step 3: Determine what's missing
            Which metric categories are relevant but not quantified?
            
            Step 4: Generate targeted questions
            What specific questions would elicit the missing metrics?
            
            Analysis result:
            {{"quantified": true/false, "existing_metrics": ["found metrics"], "missing_categories": ["categories"], "suggested_questions": ["specific contextual questions"], "confidence": 0.0-1.0}}
            """,
            performance_metrics={"accuracy": 0.91, "latency_ms": 1100, "cost_per_eval": 0.006},
            created_at="2025-01-01"
        )
    
    def _add_achievement_reframing_prompts(self):
        """Add Achievement Reframing prompt variants."""
        
        # LEAN prompt for straightforward reframing
        self.prompts["achievement_reframing_lean"] = PromptVariant(
            id="achievement_reframing_lean",
            prompt_type=PromptType.LEAN,
            complexity_level=ComplexityLevel.LOW,
            agent_name=AgentName.SYNTHESIS,
            template="""
            Reframe this STAR story into three formats:
            
            Situation: {situation}
            Task: {task}
            Action: {action}
            Result: {result}
            
            Return JSON:
            {{"resume_bullet": "Action verb + accomplishment + metrics", "behavioral_story_narrative": "Full STAR with transitions", "cover_letter_snippet": "1-2 sentences connecting to role"}}
            """,
            performance_metrics={"accuracy": 0.75, "latency_ms": 800, "cost_per_eval": 0.003},
            created_at="2025-01-01"
        )
        
        # CoT prompt for sophisticated reframing
        self.prompts["achievement_reframing_cot"] = PromptVariant(
            id="achievement_reframing_cot",
            prompt_type=PromptType.COT,
            complexity_level=ComplexityLevel.MEDIUM,
            agent_name=AgentName.SYNTHESIS,
            template="""
            I need to expertly reframe this STAR story into three optimized formats. Let me approach each format strategically.
            
            STAR Story:
            Situation: {situation}
            Task: {task}  
            Action: {action}
            Result: {result}
            
            Target Context: {target_company}, {target_role}
            
            Let me craft each format thoughtfully:
            
            1. Resume Bullet Strategy:
            - Start with strong action verb
            - Focus on quantified impact
            - Include relevant keywords for ATS
            - Keep under 150 characters
            
            2. Behavioral Story Strategy:
            - Create smooth transitions between STAR components
            - Make it conversational (60-90 seconds spoken)
            - Emphasize personal contribution
            - End with strong impact
            
            3. Cover Letter Strategy:
            - Connect achievement to target role requirements
            - Show value proposition
            - Professional but engaging tone
            - Include key metrics
            
            Strategically crafted formats:
            {{"resume_bullet": "optimized bullet", "behavioral_story_narrative": "engaging narrative", "cover_letter_snippet": "targeted snippet", "optimization_notes": ["strategy used"]}}
            """,
            performance_metrics={"accuracy": 0.89, "latency_ms": 1800, "cost_per_eval": 0.012},
            created_at="2025-01-01"
        )
    
    def get_prompt(self, agent_name: AgentName, complexity: ComplexityLevel, action: str = None) -> Optional[PromptVariant]:
        """Get the appropriate prompt for agent, complexity, and action."""
        
        # Determine prompt type based on complexity
        prompt_type = self.routing_rules.get(complexity, PromptType.COT)
        
        # Find matching prompt
        for prompt in self.prompts.values():
            if (prompt.agent_name == agent_name and 
                prompt.complexity_level == complexity and
                prompt.prompt_type == prompt_type):
                return prompt
        
        # Fallback to CoT if exact match not found
        for prompt in self.prompts.values():
            if (prompt.agent_name == agent_name and 
                prompt.prompt_type == PromptType.COT):
                return prompt
        
        return None
    
    def get_best_performing_prompt(self, agent_name: AgentName, metric: str = "accuracy") -> Optional[PromptVariant]:
        """Get the best performing prompt for an agent based on a metric."""
        
        agent_prompts = [p for p in self.prompts.values() if p.agent_name == agent_name]
        
        if not agent_prompts:
            return None
        
        return max(agent_prompts, key=lambda p: p.performance_metrics.get(metric, 0))
    
    def add_prompt_variant(self, prompt: PromptVariant):
        """Add a new prompt variant to the portfolio."""
        self.prompts[prompt.id] = prompt
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary of all prompts."""
        summary = {}
        
        for agent in AgentName:
            agent_prompts = [p for p in self.prompts.values() if p.agent_name == agent]
            
            if agent_prompts:
                avg_accuracy = sum(p.performance_metrics.get("accuracy", 0) for p in agent_prompts) / len(agent_prompts)
                avg_latency = sum(p.performance_metrics.get("latency_ms", 0) for p in agent_prompts) / len(agent_prompts)
                avg_cost = sum(p.performance_metrics.get("cost_per_eval", 0) for p in agent_prompts) / len(agent_prompts)
                
                summary[agent.value] = {
                    "prompt_count": len(agent_prompts),
                    "avg_accuracy": avg_accuracy,
                    "avg_latency_ms": avg_latency,
                    "avg_cost_per_eval": avg_cost,
                    "complexity_coverage": list(set(p.complexity_level for p in agent_prompts))
                }
        
        return summary
    
    def recommend_optimization(self, agent_name: AgentName) -> List[str]:
        """Recommend optimization strategies for an agent's prompts."""
        recommendations = []
        
        agent_prompts = [p for p in self.prompts.values() if p.agent_name == agent_name]
        
        if not agent_prompts:
            recommendations.append(f"No prompts found for {agent_name.value}")
            return recommendations
        
        # Check for missing complexity levels
        covered_complexities = set(p.complexity_level for p in agent_prompts)
        missing_complexities = set(ComplexityLevel) - covered_complexities
        
        if missing_complexities:
            recommendations.append(f"Create prompts for missing complexity levels: {[c.value for c in missing_complexities]}")
        
        # Check for performance gaps
        low_accuracy_prompts = [p for p in agent_prompts if p.performance_metrics.get("accuracy", 0) < 0.8]
        if low_accuracy_prompts:
            recommendations.append(f"Improve accuracy for {len(low_accuracy_prompts)} prompts below 80%")
        
        # Check for high latency
        high_latency_prompts = [p for p in agent_prompts if p.performance_metrics.get("latency_ms", 0) > 2000]
        if high_latency_prompts:
            recommendations.append(f"Optimize latency for {len(high_latency_prompts)} prompts > 2000ms")
        
        return recommendations


# Global prompt portfolio instance
prompt_portfolio = PromptPortfolio()