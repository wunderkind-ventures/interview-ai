"""Evaluator Agent - Real-time response evaluation and scoring."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re
import statistics

import google.generativeai as genai
from google.cloud import aiplatform

from .base import BaseAgent, AgentMessage, MessageType, MessagePriority
from common.config import AgentName, ComplexityLevel, settings
from common.telemetry import SessionTracker, trace_agent_operation, trace_ai_operation

logger = logging.getLogger(__name__)


class ScoringDimension(str, Enum):
    """Dimensions for evaluating responses."""
    PROBLEM_UNDERSTANDING = "problem_understanding"
    SOLUTION_APPROACH = "solution_approach"
    TECHNICAL_DEPTH = "technical_depth"
    COMMUNICATION_CLARITY = "communication_clarity"
    SCALABILITY_CONSIDERATION = "scalability_consideration"
    TRADE_OFF_ANALYSIS = "trade_off_analysis"
    IMPLEMENTATION_FEASIBILITY = "implementation_feasibility"
    SYSTEM_DESIGN_THINKING = "system_design_thinking"
    BEHAVIORAL_COMPETENCY = "behavioral_competency"
    LEADERSHIP_POTENTIAL = "leadership_potential"


class FeedbackType(str, Enum):
    """Types of feedback to provide."""
    REINFORCEMENT = "reinforcement"  # Positive feedback
    CORRECTION = "correction"  # Corrective feedback
    GUIDANCE = "guidance"  # Guiding questions
    CHALLENGE = "challenge"  # Challenge to go deeper
    CLARIFICATION = "clarification"  # Ask for clarification


@dataclass
class Score:
    """Individual score for a dimension."""
    dimension: ScoringDimension
    value: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    rationale: str
    evidence: List[str] = field(default_factory=list)
    improvement_areas: List[str] = field(default_factory=list)


@dataclass
class EvaluationResult:
    """Result of evaluating a user response."""
    session_id: str
    timestamp: datetime
    user_response: str
    response_time: float
    interview_state: str
    
    # Scores
    dimension_scores: Dict[ScoringDimension, Score] = field(default_factory=dict)
    overall_score: float = 0.0
    overall_confidence: float = 0.0
    
    # Feedback
    feedback_items: List[Dict[str, Any]] = field(default_factory=list)
    recommended_follow_ups: List[str] = field(default_factory=list)
    
    # Insights
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    growth_areas: List[str] = field(default_factory=list)
    
    # Metadata
    complexity_level: ComplexityLevel = ComplexityLevel.MEDIUM
    interview_type: str = "technical"
    faang_level: str = "L4"


@dataclass
class SessionEvaluation:
    """Ongoing evaluation for a session."""
    session_id: str
    user_id: str
    start_time: datetime
    
    # Evaluation history
    evaluations: List[EvaluationResult] = field(default_factory=list)
    
    # Running metrics
    average_scores: Dict[ScoringDimension, float] = field(default_factory=dict)
    score_trends: Dict[ScoringDimension, List[float]] = field(default_factory=dict)
    response_time_trend: List[float] = field(default_factory=list)
    
    # Performance insights
    consistent_strengths: List[str] = field(default_factory=list)
    consistent_weaknesses: List[str] = field(default_factory=list)
    improvement_trajectory: Dict[str, str] = field(default_factory=dict)  # improving, declining, stable
    
    # Adaptive recommendations
    focus_areas: List[str] = field(default_factory=list)
    difficulty_adjustment: str = "maintain"  # increase, decrease, maintain


class EvaluatorAgent(BaseAgent):
    """
    Evaluator Agent for real-time response evaluation and scoring.
    
    This agent evaluates user responses across multiple dimensions and provides
    structured feedback to guide the interview process.
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.EVALUATOR, session_tracker)
        
        # Active session evaluations
        self.session_evaluations: Dict[str, SessionEvaluation] = {}
        
        # Scoring configurations
        self.scoring_config = self._setup_scoring_config()
        
        # AI client setup
        self._setup_ai_client()
        
        # Evaluation prompts
        self.evaluation_prompts = self._setup_evaluation_prompts()
        
        logger.info("Evaluator Agent initialized")
    
    def _setup_ai_client(self):
        """Set up Google AI client."""
        try:
            aiplatform.init(
                project=settings.gcp_project_id,
                location=settings.vertex_ai_location
            )
            
            genai.configure(api_key=None)
            self.model = genai.GenerativeModel(settings.default_model)
            
        except Exception as e:
            logger.error(f"Failed to setup AI client: {e}")
            self.model = None
    
    def _setup_scoring_config(self) -> Dict[str, Any]:
        """Setup scoring configuration for different interview types and levels."""
        return {
            "technical": {
                "L3": {
                    "dimensions": [
                        ScoringDimension.PROBLEM_UNDERSTANDING,
                        ScoringDimension.SOLUTION_APPROACH,
                        ScoringDimension.TECHNICAL_DEPTH,
                        ScoringDimension.COMMUNICATION_CLARITY
                    ],
                    "weights": {
                        ScoringDimension.PROBLEM_UNDERSTANDING: 0.3,
                        ScoringDimension.SOLUTION_APPROACH: 0.3,
                        ScoringDimension.TECHNICAL_DEPTH: 0.2,
                        ScoringDimension.COMMUNICATION_CLARITY: 0.2
                    }
                },
                "L4": {
                    "dimensions": [
                        ScoringDimension.PROBLEM_UNDERSTANDING,
                        ScoringDimension.SOLUTION_APPROACH,
                        ScoringDimension.TECHNICAL_DEPTH,
                        ScoringDimension.COMMUNICATION_CLARITY,
                        ScoringDimension.TRADE_OFF_ANALYSIS
                    ],
                    "weights": {
                        ScoringDimension.PROBLEM_UNDERSTANDING: 0.25,
                        ScoringDimension.SOLUTION_APPROACH: 0.25,
                        ScoringDimension.TECHNICAL_DEPTH: 0.25,
                        ScoringDimension.COMMUNICATION_CLARITY: 0.15,
                        ScoringDimension.TRADE_OFF_ANALYSIS: 0.1
                    }
                },
                "L5": {
                    "dimensions": [
                        ScoringDimension.PROBLEM_UNDERSTANDING,
                        ScoringDimension.SOLUTION_APPROACH,
                        ScoringDimension.TECHNICAL_DEPTH,
                        ScoringDimension.COMMUNICATION_CLARITY,
                        ScoringDimension.TRADE_OFF_ANALYSIS,
                        ScoringDimension.SCALABILITY_CONSIDERATION
                    ],
                    "weights": {
                        ScoringDimension.PROBLEM_UNDERSTANDING: 0.2,
                        ScoringDimension.SOLUTION_APPROACH: 0.2,
                        ScoringDimension.TECHNICAL_DEPTH: 0.2,
                        ScoringDimension.COMMUNICATION_CLARITY: 0.15,
                        ScoringDimension.TRADE_OFF_ANALYSIS: 0.15,
                        ScoringDimension.SCALABILITY_CONSIDERATION: 0.1
                    }
                },
                "L6": {
                    "dimensions": list(ScoringDimension)[:8],  # All technical dimensions
                    "weights": {
                        ScoringDimension.PROBLEM_UNDERSTANDING: 0.15,
                        ScoringDimension.SOLUTION_APPROACH: 0.15,
                        ScoringDimension.TECHNICAL_DEPTH: 0.15,
                        ScoringDimension.COMMUNICATION_CLARITY: 0.15,
                        ScoringDimension.TRADE_OFF_ANALYSIS: 0.15,
                        ScoringDimension.SCALABILITY_CONSIDERATION: 0.1,
                        ScoringDimension.IMPLEMENTATION_FEASIBILITY: 0.1,
                        ScoringDimension.SYSTEM_DESIGN_THINKING: 0.05
                    }
                }
            },
            "system_design": {
                # System design focuses more on architecture and scalability
                "L4": {
                    "dimensions": [
                        ScoringDimension.PROBLEM_UNDERSTANDING,
                        ScoringDimension.SYSTEM_DESIGN_THINKING,
                        ScoringDimension.SCALABILITY_CONSIDERATION,
                        ScoringDimension.TRADE_OFF_ANALYSIS,
                        ScoringDimension.COMMUNICATION_CLARITY
                    ],
                    "weights": {
                        ScoringDimension.PROBLEM_UNDERSTANDING: 0.2,
                        ScoringDimension.SYSTEM_DESIGN_THINKING: 0.3,
                        ScoringDimension.SCALABILITY_CONSIDERATION: 0.25,
                        ScoringDimension.TRADE_OFF_ANALYSIS: 0.15,
                        ScoringDimension.COMMUNICATION_CLARITY: 0.1
                    }
                }
            },
            "behavioral": {
                # Behavioral interviews focus on soft skills
                "L4": {
                    "dimensions": [
                        ScoringDimension.COMMUNICATION_CLARITY,
                        ScoringDimension.BEHAVIORAL_COMPETENCY,
                        ScoringDimension.LEADERSHIP_POTENTIAL
                    ],
                    "weights": {
                        ScoringDimension.COMMUNICATION_CLARITY: 0.4,
                        ScoringDimension.BEHAVIORAL_COMPETENCY: 0.4,
                        ScoringDimension.LEADERSHIP_POTENTIAL: 0.2
                    }
                }
            }
        }
    
    def _setup_evaluation_prompts(self) -> Dict[str, str]:
        """Setup evaluation prompts for different dimensions."""
        return {
            ScoringDimension.PROBLEM_UNDERSTANDING: """
            Evaluate how well the candidate understands the problem.
            
            Consider:
            - Asks clarifying questions
            - Identifies key requirements
            - Understands constraints
            - Recognizes edge cases
            - Shows domain knowledge
            
            Score 0.0-1.0 where:
            0.0-0.2: Misunderstands the problem
            0.2-0.4: Basic understanding, missing key aspects
            0.4-0.6: Good understanding, minor gaps
            0.6-0.8: Strong understanding, comprehensive
            0.8-1.0: Exceptional understanding, insightful
            """,
            
            ScoringDimension.SOLUTION_APPROACH: """
            Evaluate the quality of the candidate's solution approach.
            
            Consider:
            - Logical problem decomposition
            - Systematic methodology
            - Creative thinking
            - Alternative approaches considered
            - Step-by-step progression
            
            Score 0.0-1.0 based on approach quality.
            """,
            
            ScoringDimension.TECHNICAL_DEPTH: """
            Evaluate the technical depth and accuracy of the response.
            
            Consider:
            - Technical accuracy
            - Depth of knowledge
            - Use of appropriate terminology
            - Understanding of underlying concepts
            - Implementation details
            
            Score 0.0-1.0 based on technical competency.
            """,
            
            ScoringDimension.COMMUNICATION_CLARITY: """
            Evaluate how clearly the candidate communicates.
            
            Consider:
            - Clear explanations
            - Logical flow
            - Appropriate examples
            - Effective use of analogies
            - Engaging presentation
            
            Score 0.0-1.0 based on communication effectiveness.
            """,
            
            ScoringDimension.SCALABILITY_CONSIDERATION: """
            Evaluate consideration of scalability and performance.
            
            Consider:
            - Discusses scaling bottlenecks
            - Considers performance implications
            - Mentions capacity planning
            - Addresses growth scenarios
            - Optimization strategies
            
            Score 0.0-1.0 based on scalability awareness.
            """
        }
    
    @trace_agent_operation("process_request", AgentName.EVALUATOR)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process evaluation requests."""
        action = request.get("action")
        session_id = request.get("session_id")
        
        if not session_id:
            return {"error": "Missing session_id"}
        
        handlers = {
            "initialize_session": self._initialize_session,
            "evaluate_response": self._evaluate_response,
            "get_session_scores": self._get_session_scores,
            "get_performance_trends": self._get_performance_trends,
            "generate_feedback": self._generate_feedback,
            "recommend_difficulty": self._recommend_difficulty_adjustment
        }
        
        handler = handlers.get(action)
        if not handler:
            return {"error": f"Unknown action: {action}"}
        
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error processing evaluation request {action}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.type == MessageType.REQUEST:
            request = {
                "action": message.payload.get("action"),
                "session_id": message.session_id,
                **message.payload
            }
            
            result = await self.process_request(request)
            
            return AgentMessage(
                id=f"evaluator_response_{datetime.now().timestamp()}",
                type=MessageType.RESPONSE,
                from_agent=AgentName.EVALUATOR,
                to_agent=message.from_agent,
                session_id=message.session_id,
                timestamp=datetime.now(),
                priority=MessagePriority.NORMAL,
                payload=result,
                correlation_id=message.id
            )
        
        elif message.type == MessageType.NOTIFICATION:
            await self._handle_notification(message)
        
        return None
    
    async def _initialize_session(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize evaluation for a new session."""
        session_context = request.get("session_context", {})
        session_id = session_context.get("session_id")
        
        if not session_id:
            return {"error": "Missing session_id in session_context"}
        
        # Create session evaluation
        session_eval = SessionEvaluation(
            session_id=session_id,
            user_id=session_context.get("user_id", ""),
            start_time=datetime.now()
        )
        
        self.session_evaluations[session_id] = session_eval
        
        return {
            "success": True,
            "session_id": session_id,
            "evaluator_ready": True
        }
    
    async def _evaluate_response(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a user response."""
        session_id = request.get("session_id")
        user_response = request.get("user_response", "")
        response_time = request.get("response_time", 0)
        context = request.get("context", {})
        
        if session_id not in self.session_evaluations:
            return {"error": "Session not initialized"}
        
        session_eval = self.session_evaluations[session_id]
        
        # Create evaluation result
        evaluation = EvaluationResult(
            session_id=session_id,
            timestamp=datetime.now(),
            user_response=user_response,
            response_time=response_time,
            interview_state=context.get("state", "unknown"),
            complexity_level=ComplexityLevel(context.get("complexity", "medium")),
            interview_type=context.get("interview_type", "technical"),
            faang_level=context.get("faang_level", "L4")
        )
        
        # Perform evaluation
        await self._perform_evaluation(evaluation)
        
        # Add to session history
        session_eval.evaluations.append(evaluation)
        
        # Update running metrics
        await self._update_session_metrics(session_eval, evaluation)
        
        # Generate immediate feedback
        feedback = await self._generate_immediate_feedback(evaluation)
        
        return {
            "success": True,
            "evaluation_id": f"{session_id}_{len(session_eval.evaluations)}",
            "scores": {dim.value: score.value for dim, score in evaluation.dimension_scores.items()},
            "overall_score": evaluation.overall_score,
            "confidence": evaluation.overall_confidence,
            "feedback": feedback,
            "strengths": evaluation.strengths,
            "growth_areas": evaluation.growth_areas,
            "recommended_follow_ups": evaluation.recommended_follow_ups
        }
    
    async def _perform_evaluation(self, evaluation: EvaluationResult):
        """Perform the actual evaluation of the response."""
        if not self.model:
            # Fallback to basic evaluation
            await self._basic_evaluation(evaluation)
            return
        
        # Get scoring configuration
        config = self._get_scoring_config(evaluation.interview_type, evaluation.faang_level)
        dimensions = config["dimensions"]
        weights = config["weights"]
        
        # Evaluate each dimension
        dimension_tasks = [
            self._evaluate_dimension(evaluation, dimension)
            for dimension in dimensions
        ]
        
        dimension_scores = await asyncio.gather(*dimension_tasks, return_exceptions=True)
        
        # Process results
        total_weighted_score = 0.0
        total_weight = 0.0
        confidence_scores = []
        
        for i, dimension in enumerate(dimensions):
            if isinstance(dimension_scores[i], Score):
                score = dimension_scores[i]
                evaluation.dimension_scores[dimension] = score
                
                weight = weights.get(dimension, 1.0 / len(dimensions))
                total_weighted_score += score.value * weight
                total_weight += weight
                confidence_scores.append(score.confidence)
        
        # Calculate overall scores
        evaluation.overall_score = total_weighted_score / total_weight if total_weight > 0 else 0.0
        evaluation.overall_confidence = statistics.mean(confidence_scores) if confidence_scores else 0.0
        
        # Extract insights
        await self._extract_insights(evaluation)
    
    async def _evaluate_dimension(self, evaluation: EvaluationResult, dimension: ScoringDimension) -> Score:
        """Evaluate a specific dimension."""
        try:
            with trace_ai_operation(f"evaluate_{dimension.value}", settings.default_model, evaluation.session_id) as span:
                prompt = self._create_dimension_evaluation_prompt(evaluation, dimension)
                
                response = await self.model.generate_content_async(prompt)
                result = json.loads(response.text)
                
                score = Score(
                    dimension=dimension,
                    value=float(result.get("score", 0.0)),
                    confidence=float(result.get("confidence", 0.0)),
                    rationale=result.get("rationale", ""),
                    evidence=result.get("evidence", []),
                    improvement_areas=result.get("improvement_areas", [])
                )
                
                span.set_attribute(f"{dimension.value}_score", score.value)
                span.set_attribute(f"{dimension.value}_confidence", score.confidence)
                
                return score
                
        except Exception as e:
            logger.error(f"Error evaluating dimension {dimension.value}: {e}")
            return Score(
                dimension=dimension,
                value=0.5,  # Neutral score on error
                confidence=0.0,
                rationale=f"Evaluation error: {str(e)}"
            )
    
    def _create_dimension_evaluation_prompt(self, evaluation: EvaluationResult, dimension: ScoringDimension) -> str:
        """Create evaluation prompt for a specific dimension."""
        base_prompt = self.evaluation_prompts.get(dimension, "Evaluate this response.")
        
        return f"""
        {base_prompt}
        
        Interview Context:
        - Type: {evaluation.interview_type}
        - Level: {evaluation.faang_level}
        - State: {evaluation.interview_state}
        - Complexity: {evaluation.complexity_level.value}
        
        User Response: "{evaluation.user_response}"
        Response Time: {evaluation.response_time} seconds
        
        Return evaluation as JSON:
        {{
            "score": 0.0-1.0,
            "confidence": 0.0-1.0,
            "rationale": "explanation of score",
            "evidence": ["specific examples from response"],
            "improvement_areas": ["specific areas for improvement"]
        }}
        
        Be specific and constructive in your evaluation.
        """
    
    async def _basic_evaluation(self, evaluation: EvaluationResult):
        """Basic evaluation fallback when AI is not available."""
        # Simple heuristic-based evaluation
        response_length = len(evaluation.user_response)
        word_count = len(evaluation.user_response.split())
        
        # Basic scoring based on response characteristics
        base_score = 0.5
        
        # Length factor
        if word_count < 10:
            length_factor = 0.2
        elif word_count < 50:
            length_factor = 0.5
        elif word_count < 200:
            length_factor = 0.8
        else:
            length_factor = 1.0
        
        # Technical keywords factor
        technical_keywords = ["system", "architecture", "scalability", "performance", "design", "implementation"]
        keyword_count = sum(1 for keyword in technical_keywords if keyword in evaluation.user_response.lower())
        keyword_factor = min(keyword_count / 3, 1.0)
        
        # Response time factor
        if evaluation.response_time < 30:
            time_factor = 1.0
        elif evaluation.response_time < 120:
            time_factor = 0.8
        else:
            time_factor = 0.6
        
        # Calculate final score
        final_score = base_score * (0.4 * length_factor + 0.4 * keyword_factor + 0.2 * time_factor)
        
        # Create basic scores for key dimensions
        key_dimensions = [
            ScoringDimension.PROBLEM_UNDERSTANDING,
            ScoringDimension.SOLUTION_APPROACH,
            ScoringDimension.COMMUNICATION_CLARITY
        ]
        
        for dimension in key_dimensions:
            evaluation.dimension_scores[dimension] = Score(
                dimension=dimension,
                value=final_score,
                confidence=0.3,  # Low confidence for basic evaluation
                rationale="Basic heuristic evaluation (AI not available)"
            )
        
        evaluation.overall_score = final_score
        evaluation.overall_confidence = 0.3
    
    async def _extract_insights(self, evaluation: EvaluationResult):
        """Extract insights from the evaluation."""
        strengths = []
        weaknesses = []
        growth_areas = []
        
        for score in evaluation.dimension_scores.values():
            if score.value >= 0.7:
                strengths.extend(score.evidence)
            elif score.value <= 0.4:
                weaknesses.extend(score.evidence)
            
            growth_areas.extend(score.improvement_areas)
        
        evaluation.strengths = list(set(strengths))
        evaluation.weaknesses = list(set(weaknesses))
        evaluation.growth_areas = list(set(growth_areas))
        
        # Generate follow-up recommendations
        evaluation.recommended_follow_ups = await self._generate_follow_up_recommendations(evaluation)
    
    async def _generate_follow_up_recommendations(self, evaluation: EvaluationResult) -> List[str]:
        """Generate follow-up question recommendations."""
        if not self.model:
            return []
        
        try:
            # Find areas that need more exploration
            low_scoring_dims = [
                dim.value for dim, score in evaluation.dimension_scores.items()
                if score.value < 0.6
            ]
            
            if not low_scoring_dims:
                return []
            
            prompt = f"""
            Based on this evaluation, suggest 2-3 specific follow-up questions to explore weak areas.
            
            Weak areas: {low_scoring_dims}
            User response: "{evaluation.user_response}"
            Interview type: {evaluation.interview_type}
            Level: {evaluation.faang_level}
            
            Return as JSON array: ["question 1", "question 2", "question 3"]
            
            Make questions specific and probing.
            """
            
            response = await self.model.generate_content_async(prompt)
            recommendations = json.loads(response.text)
            
            return recommendations if isinstance(recommendations, list) else []
            
        except Exception as e:
            logger.error(f"Error generating follow-up recommendations: {e}")
            return []
    
    async def _update_session_metrics(self, session_eval: SessionEvaluation, evaluation: EvaluationResult):
        """Update running session metrics."""
        # Update average scores
        for dimension, score in evaluation.dimension_scores.items():
            if dimension not in session_eval.average_scores:
                session_eval.average_scores[dimension] = score.value
                session_eval.score_trends[dimension] = [score.value]
            else:
                # Calculate rolling average
                current_scores = session_eval.score_trends[dimension]
                current_scores.append(score.value)
                session_eval.average_scores[dimension] = statistics.mean(current_scores)
        
        # Update response time trend
        session_eval.response_time_trend.append(evaluation.response_time)
        
        # Analyze trends and patterns
        await self._analyze_performance_trends(session_eval)
    
    async def _analyze_performance_trends(self, session_eval: SessionEvaluation):
        """Analyze performance trends over the session."""
        if len(session_eval.evaluations) < 3:
            return  # Not enough data for trend analysis
        
        # Analyze score trends
        for dimension, scores in session_eval.score_trends.items():
            if len(scores) >= 3:
                recent_trend = scores[-3:]
                if recent_trend[-1] > recent_trend[0]:
                    session_eval.improvement_trajectory[dimension.value] = "improving"
                elif recent_trend[-1] < recent_trend[0]:
                    session_eval.improvement_trajectory[dimension.value] = "declining"
                else:
                    session_eval.improvement_trajectory[dimension.value] = "stable"
        
        # Identify consistent patterns
        consistent_high = []
        consistent_low = []
        
        for dimension, avg_score in session_eval.average_scores.items():
            if avg_score >= 0.7:
                consistent_high.append(dimension.value)
            elif avg_score <= 0.4:
                consistent_low.append(dimension.value)
        
        session_eval.consistent_strengths = consistent_high
        session_eval.consistent_weaknesses = consistent_low
        
        # Determine focus areas
        session_eval.focus_areas = consistent_low + [
            dim for dim, trend in session_eval.improvement_trajectory.items()
            if trend == "declining"
        ]
    
    def _get_scoring_config(self, interview_type: str, faang_level: str) -> Dict[str, Any]:
        """Get scoring configuration for interview type and level."""
        config = self.scoring_config.get(interview_type, {}).get(faang_level)
        
        if not config:
            # Fallback to default technical L4 config
            config = self.scoring_config["technical"]["L4"]
        
        return config
    
    async def _generate_immediate_feedback(self, evaluation: EvaluationResult) -> List[Dict[str, Any]]:
        """Generate immediate feedback for the evaluation."""
        feedback_items = []
        
        # Reinforcement for high scores
        high_scoring_dims = [
            dim for dim, score in evaluation.dimension_scores.items()
            if score.value >= 0.8
        ]
        
        if high_scoring_dims:
            feedback_items.append({
                "type": FeedbackType.REINFORCEMENT.value,
                "message": f"Excellent work on {', '.join([d.value.replace('_', ' ') for d in high_scoring_dims])}!",
                "priority": "medium"
            })
        
        # Guidance for low scores
        low_scoring_dims = [
            (dim, score) for dim, score in evaluation.dimension_scores.items()
            if score.value <= 0.4
        ]
        
        for dim, score in low_scoring_dims:
            feedback_items.append({
                "type": FeedbackType.GUIDANCE.value,
                "message": f"Consider expanding on {dim.value.replace('_', ' ')}: {score.improvement_areas[0] if score.improvement_areas else 'provide more detail'}",
                "priority": "high"
            })
        
        # Challenge for medium scores
        medium_scoring_dims = [
            dim for dim, score in evaluation.dimension_scores.items()
            if 0.5 <= score.value < 0.7
        ]
        
        if medium_scoring_dims and len(feedback_items) < 2:
            dim = medium_scoring_dims[0]
            feedback_items.append({
                "type": FeedbackType.CHALLENGE.value,
                "message": f"Good foundation on {dim.value.replace('_', ' ')}. Can you dive deeper into the implications?",
                "priority": "medium"
            })
        
        return feedback_items
    
    async def _get_session_scores(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Get current session scores."""
        session_id = request.get("session_id")
        
        if session_id not in self.session_evaluations:
            return {"error": "Session not found"}
        
        session_eval = self.session_evaluations[session_id]
        
        return {
            "session_id": session_id,
            "total_evaluations": len(session_eval.evaluations),
            "average_scores": {dim.value: score for dim, score in session_eval.average_scores.items()},
            "overall_average": statistics.mean(session_eval.average_scores.values()) if session_eval.average_scores else 0.0,
            "consistent_strengths": session_eval.consistent_strengths,
            "consistent_weaknesses": session_eval.consistent_weaknesses,
            "focus_areas": session_eval.focus_areas,
            "last_evaluation": session_eval.evaluations[-1].overall_score if session_eval.evaluations else None
        }
    
    async def _get_performance_trends(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Get performance trends for the session."""
        session_id = request.get("session_id")
        
        if session_id not in self.session_evaluations:
            return {"error": "Session not found"}
        
        session_eval = self.session_evaluations[session_id]
        
        return {
            "session_id": session_id,
            "score_trends": {dim.value: scores for dim, scores in session_eval.score_trends.items()},
            "improvement_trajectory": session_eval.improvement_trajectory,
            "response_time_trend": session_eval.response_time_trend,
            "difficulty_recommendation": session_eval.difficulty_adjustment
        }
    
    async def _generate_feedback(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed feedback for the session."""
        session_id = request.get("session_id")
        
        if session_id not in self.session_evaluations:
            return {"error": "Session not found"}
        
        session_eval = self.session_evaluations[session_id]
        
        if not session_eval.evaluations:
            return {"feedback": "No evaluations available yet"}
        
        latest_eval = session_eval.evaluations[-1]
        
        # Generate comprehensive feedback
        feedback = {
            "overall_performance": {
                "current_score": latest_eval.overall_score,
                "session_average": statistics.mean([e.overall_score for e in session_eval.evaluations]),
                "confidence": latest_eval.overall_confidence
            },
            "strengths": latest_eval.strengths,
            "growth_areas": latest_eval.growth_areas,
            "immediate_recommendations": latest_eval.recommended_follow_ups,
            "performance_trends": session_eval.improvement_trajectory,
            "focus_areas": session_eval.focus_areas
        }
        
        return {"feedback": feedback}
    
    async def _recommend_difficulty_adjustment(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Recommend difficulty adjustment based on performance."""
        session_id = request.get("session_id")
        
        if session_id not in self.session_evaluations:
            return {"error": "Session not found"}
        
        session_eval = self.session_evaluations[session_id]
        
        if len(session_eval.evaluations) < 2:
            return {"recommendation": "maintain", "reason": "Insufficient data"}
        
        recent_scores = [e.overall_score for e in session_eval.evaluations[-3:]]
        avg_recent = statistics.mean(recent_scores)
        
        if avg_recent >= 0.8:
            recommendation = "increase"
            reason = "Consistently high performance suggests candidate can handle more challenging questions"
        elif avg_recent <= 0.4:
            recommendation = "decrease"
            reason = "Low performance suggests need for easier questions to build confidence"
        else:
            recommendation = "maintain"
            reason = "Performance is appropriate for current difficulty level"
        
        session_eval.difficulty_adjustment = recommendation
        
        return {
            "recommendation": recommendation,
            "reason": reason,
            "recent_average": avg_recent,
            "trend": session_eval.improvement_trajectory
        }
    
    async def _handle_notification(self, message: AgentMessage):
        """Handle notifications from other agents."""
        event = message.payload.get("event")
        
        if event == "state_change":
            session_id = message.session_id
            if session_id in self.session_evaluations:
                # Update evaluation focus based on new state
                new_state = message.payload.get("new_state")
                logger.info(f"Adjusting evaluation focus for state: {new_state}")
        
        # Handle other notifications as needed