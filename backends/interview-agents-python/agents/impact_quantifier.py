"""Impact Quantifier Agent - Prompts users to add quantitative metrics to results."""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import re

import google.generativeai as genai
from google.cloud import aiplatform

from .base import BaseAgent, AgentMessage, MessageType, MessagePriority
from common.config import AgentName, settings
from common.telemetry import SessionTracker, trace_agent_operation, trace_ai_operation

logger = logging.getLogger(__name__)


@dataclass
class QuantificationResult:
    """Result of impact quantification analysis."""
    quantified: bool
    existing_metrics: List[str]
    suggested_questions: List[str]
    confidence_score: float = 0.0
    metric_categories: List[str] = None


class ImpactQuantifierAgent(BaseAgent):
    """
    Impact Quantifier Agent for Narrative Refinement Module.
    
    JTBD: To analyze the "Result" component of a STAR story and prompt the user 
    with targeted, contextual questions to help them add quantitative metrics 
    if they are missing.
    
    Boundaries:
    - Does not invent or suggest metrics
    - Only asks questions to elicit them from the user
    - Does not validate the truthfulness of the user's claimed metrics
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.EVALUATOR, session_tracker)  # Using EVALUATOR enum for now
        
        # AI client setup
        self._setup_ai_client()
        
        # Metric detection patterns
        self.metric_patterns = self._setup_metric_patterns()
        
        # Question templates by category
        self.question_templates = self._setup_question_templates()
        
        logger.info("Impact Quantifier Agent initialized")
    
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
    
    def _setup_metric_patterns(self) -> Dict[str, List[str]]:
        """Setup patterns to detect existing quantitative metrics."""
        return {
            "percentage": [
                r"(\d+(?:\.\d+)?)\s*%",
                r"(\d+(?:\.\d+)?)\s*percent",
                r"by\s+(\d+(?:\.\d+)?)\s*%"
            ],
            "monetary": [
                r"\$[\d,]+(?:\.\d{2})?[KMB]?",
                r"(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|USD)",
                r"(?:saved|revenue|cost|budget).*\$[\d,]+",
                r"(\d+(?:,\d{3})*)\s*(?:million|billion|thousand)"
            ],
            "time": [
                r"(\d+(?:\.\d+)?)\s*(?:hours?|days?|weeks?|months?|years?)",
                r"(\d+(?:\.\d+)?)\s*(?:hrs?|mins?|minutes?|seconds?)",
                r"(?:reduced|saved|faster).*(\d+(?:\.\d+)?)\s*(?:hours?|days?|weeks?)"
            ],
            "volume": [
                r"(\d+(?:,\d{3})*)\s*(?:users?|customers?|people|employees?)",
                r"(\d+(?:,\d{3})*)\s*(?:requests?|transactions?|sales?|orders?)",
                r"(\d+(?:,\d{3})*)\s*(?:visitors?|downloads?|registrations?)"
            ],
            "performance": [
                r"(\d+(?:\.\d+)?)\s*(?:x|times?)\s*(?:faster|better|more)",
                r"(?:improved|increased|boosted).*(\d+(?:\.\d+)?)\s*(?:x|times?)",
                r"(\d+(?:\.\d+)?)\s*(?:fold|multiple)"
            ],
            "rating": [
                r"(\d+(?:\.\d+)?)\s*(?:out of|/)\s*(\d+)",
                r"(\d+(?:\.\d+)?)\s*(?:star|rating|score)",
                r"rating.*(\d+(?:\.\d+)?)"
            ]
        }
    
    def _setup_question_templates(self) -> Dict[str, List[str]]:
        """Setup question templates for different metric categories."""
        return {
            "financial_impact": [
                "Can you quantify the financial impact? For example, how much money was saved, earned, or costs reduced?",
                "What was the monetary value of this achievement? (e.g., $50K saved, $2M in revenue generated)",
                "How much did this impact the bottom line financially?"
            ],
            "time_savings": [
                "How much time was saved through your actions? (e.g., reduced processing time from 2 hours to 30 minutes)",
                "What was the time impact of your work? (e.g., saved 10 hours per week, completed 2 weeks ahead of schedule)",
                "Can you measure the time efficiency gained?"
            ],
            "volume_scale": [
                "How many people/users/customers were affected by your work?",
                "What was the scale of impact? (e.g., served 10,000 users, processed 500 orders daily)",
                "Can you quantify the volume or reach of your achievement?"
            ],
            "performance_improvement": [
                "By what percentage or factor did performance improve? (e.g., 25% faster, 3x more efficient)",
                "What was the measurable improvement? (e.g., increased accuracy from 85% to 95%)",
                "How much better was the outcome compared to before?"
            ],
            "quality_metrics": [
                "How did this impact quality metrics? (e.g., reduced errors by 40%, improved customer satisfaction to 4.8/5)",
                "What quality improvements can you measure?",
                "Were there any measurable quality or satisfaction gains?"
            ],
            "business_metrics": [
                "How did this impact key business metrics? (e.g., increased conversion rate by 15%, reduced churn by 30%)",
                "What business KPIs were improved?",
                "Can you measure the business impact?"
            ],
            "team_productivity": [
                "How did this impact team productivity or efficiency?",
                "What was the productivity gain? (e.g., team completed 20% more work, reduced manual effort by 8 hours/week)",
                "Can you quantify the team or process improvement?"
            ]
        }
    
    @trace_agent_operation("process_request", AgentName.EVALUATOR)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process impact quantification requests."""
        action = request.get("action")
        
        handlers = {
            "analyze_quantification": self._analyze_quantification,
            "suggest_questions": self._suggest_quantification_questions,
            "validate_metrics": self._validate_existing_metrics
        }
        
        handler = handlers.get(action)
        if not handler:
            return {"error": f"Unknown action: {action}"}
        
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error processing impact quantification request {action}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.type == MessageType.REQUEST:
            request = {
                "action": message.payload.get("action", "analyze_quantification"),
                **message.payload
            }
            
            result = await self.process_request(request)
            
            return AgentMessage(
                id=f"impact_quantifier_response_{datetime.now().timestamp()}",
                type=MessageType.RESPONSE,
                from_agent=AgentName.EVALUATOR,  # Using EVALUATOR enum
                to_agent=message.from_agent,
                session_id=message.session_id,
                timestamp=datetime.now(),
                priority=MessagePriority.NORMAL,
                payload=result,
                correlation_id=message.id
            )
        
        return None
    
    async def _analyze_quantification(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze result text for quantitative metrics."""
        result_text = request.get("result_text", "")
        
        if not result_text:
            return {"error": "No result text provided"}
        
        # First, detect existing metrics using rule-based approach
        existing_metrics = self._detect_existing_metrics(result_text)
        
        # Determine if adequately quantified
        quantified = len(existing_metrics) > 0
        
        # If not quantified or needs improvement, generate questions
        if not quantified or len(existing_metrics) < 2:
            if self.model:
                ai_analysis = await self._ai_quantification_analysis(result_text, existing_metrics)
                suggested_questions = ai_analysis.get("suggested_questions", [])
                metric_categories = ai_analysis.get("metric_categories", [])
                confidence = ai_analysis.get("confidence_score", 0.5)
            else:
                # Fallback to rule-based question generation
                suggested_questions = self._generate_fallback_questions(result_text)
                metric_categories = ["general"]
                confidence = 0.3
        else:
            suggested_questions = []
            metric_categories = []
            confidence = 0.9
        
        result = QuantificationResult(
            quantified=quantified and len(existing_metrics) >= 2,
            existing_metrics=existing_metrics,
            suggested_questions=suggested_questions,
            confidence_score=confidence,
            metric_categories=metric_categories
        )
        
        return {
            "quantified": result.quantified,
            "existing_metrics": result.existing_metrics,
            "suggested_questions": result.suggested_questions,
            "confidence_score": result.confidence_score,
            "metric_categories": result.metric_categories or []
        }
    
    def _detect_existing_metrics(self, text: str) -> List[str]:
        """Detect existing quantitative metrics in text using patterns."""
        detected_metrics = []
        text_lower = text.lower()
        
        for category, patterns in self.metric_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    # Extract the matched text with some context
                    start = max(0, match.start() - 20)
                    end = min(len(text), match.end() + 20)
                    context = text[start:end].strip()
                    
                    metric_info = {
                        "category": category,
                        "value": match.group(0),
                        "context": context
                    }
                    detected_metrics.append(str(metric_info))
        
        return detected_metrics
    
    async def _ai_quantification_analysis(self, result_text: str, existing_metrics: List[str]) -> Dict[str, Any]:
        """Use AI to analyze quantification needs and suggest questions."""
        try:
            with trace_ai_operation("quantification_analysis", settings.default_model, "impact_quantifier") as span:
                prompt = self._create_quantification_prompt(result_text, existing_metrics)
                
                response = await self.model.generate_content_async(prompt)
                analysis = json.loads(response.text)
                
                span.set_attribute("quantified", analysis.get("quantified", False))
                span.set_attribute("question_count", len(analysis.get("suggested_questions", [])))
                
                return analysis
                
        except Exception as e:
            logger.error(f"Error in AI quantification analysis: {e}")
            return {
                "quantified": False,
                "suggested_questions": self._generate_fallback_questions(result_text),
                "metric_categories": ["general"],
                "confidence_score": 0.3
            }
    
    def _create_quantification_prompt(self, result_text: str, existing_metrics: List[str]) -> str:
        """Create prompt for AI quantification analysis."""
        return f"""
        Analyze this achievement result for quantitative metrics and suggest questions to elicit missing ones.
        
        Result Text: "{result_text}"
        
        Existing Metrics Found: {existing_metrics if existing_metrics else "None"}
        
        Your task:
        1. Determine if the result has sufficient quantitative metrics
        2. Identify what types of metrics would strengthen this achievement
        3. Generate 2-3 specific questions to elicit those metrics
        
        Return JSON format:
        {{
            "quantified": true/false,
            "metric_categories": ["financial_impact", "time_savings", "volume_scale", "performance_improvement", "quality_metrics", "business_metrics"],
            "suggested_questions": [
                "Specific question to elicit financial impact",
                "Specific question to elicit volume/scale",
                "Specific question to elicit performance improvement"
            ],
            "confidence_score": 0.0-1.0
        }}
        
        Guidelines:
        - A result needs at least 2 different types of metrics to be "quantified"
        - Questions should be specific to the context, not generic
        - Focus on the most relevant metric categories for this achievement
        - Don't suggest metrics that are already present
        """
    
    def _generate_fallback_questions(self, result_text: str) -> List[str]:
        """Generate fallback questions when AI is not available."""
        # Analyze text for context clues
        text_lower = result_text.lower()
        
        suggested_questions = []
        
        # Financial context
        if any(word in text_lower for word in ["save", "cost", "revenue", "budget", "money", "profit"]):
            suggested_questions.append(self.question_templates["financial_impact"][0])
        
        # Time context
        if any(word in text_lower for word in ["time", "faster", "quick", "efficient", "speed", "duration"]):
            suggested_questions.append(self.question_templates["time_savings"][0])
        
        # Volume/scale context
        if any(word in text_lower for word in ["user", "customer", "people", "team", "scale", "volume"]):
            suggested_questions.append(self.question_templates["volume_scale"][0])
        
        # Performance context
        if any(word in text_lower for word in ["improve", "better", "increase", "optimize", "enhance"]):
            suggested_questions.append(self.question_templates["performance_improvement"][0])
        
        # Default questions if no context detected
        if not suggested_questions:
            suggested_questions = [
                self.question_templates["financial_impact"][0],
                self.question_templates["performance_improvement"][0]
            ]
        
        return suggested_questions[:3]  # Limit to 3 questions
    
    async def _suggest_quantification_questions(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate targeted quantification questions for specific categories."""
        categories = request.get("categories", [])
        context = request.get("context", "")
        
        if not categories:
            return {"error": "No categories specified"}
        
        questions = []
        for category in categories:
            if category in self.question_templates:
                # Get context-specific question or default to first one
                category_questions = self.question_templates[category]
                questions.append(category_questions[0])
        
        return {
            "suggested_questions": questions,
            "categories": categories
        }
    
    async def _validate_existing_metrics(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and categorize existing metrics in text."""
        text = request.get("text", "")
        
        detected_metrics = self._detect_existing_metrics(text)
        
        # Categorize metrics
        categories = set()
        for metric_str in detected_metrics:
            # Extract category from metric info
            try:
                # This is a simplified version - in practice you'd parse the metric_info properly
                if "percentage" in metric_str:
                    categories.add("performance_improvement")
                elif "monetary" in metric_str:
                    categories.add("financial_impact")
                elif "time" in metric_str:
                    categories.add("time_savings")
                elif "volume" in metric_str:
                    categories.add("volume_scale")
            except:
                pass
        
        return {
            "has_metrics": len(detected_metrics) > 0,
            "metric_count": len(detected_metrics),
            "metrics": detected_metrics,
            "categories": list(categories),
            "well_quantified": len(detected_metrics) >= 2 and len(categories) >= 2
        }