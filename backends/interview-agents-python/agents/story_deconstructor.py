"""Story Deconstructor Agent - Maps user stories to STAR method components."""

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


class STARStatus(str, Enum):
    """Status of STAR deconstruction."""
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"


@dataclass
class STARComponents:
    """STAR method components."""
    situation: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None


@dataclass
class DeconstructionResult:
    """Result of story deconstruction."""
    status: STARStatus
    star_components: STARComponents
    clarifying_question: Optional[str] = None
    missing_components: List[str] = None
    confidence_score: float = 0.0


class StoryDeconstructorAgent(BaseAgent):
    """
    Story Deconstructor Agent for Narrative Refinement Module.
    
    JTBD: To analyze a user's unstructured story and map it to the STAR method 
    components, asking clarifying questions if a component is missing or unclear.
    
    Boundaries:
    - Does not judge the quality or impact of the story
    - Only deconstructs it into the STAR format
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.CONTEXT, session_tracker)  # Using CONTEXT enum for now
        
        # AI client setup
        self._setup_ai_client()
        
        # STAR validation patterns
        self.star_patterns = self._setup_star_patterns()
        
        # Clarifying question templates
        self.clarifying_questions = self._setup_clarifying_questions()
        
        logger.info("Story Deconstructor Agent initialized")
    
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
    
    def _setup_star_patterns(self) -> Dict[str, List[str]]:
        """Setup patterns to identify STAR components."""
        return {
            "situation": [
                r"(?:at|when I was|while working|during|in my role)",
                r"(?:company|organization|team|project) (?:was|had|needed)",
                r"(?:situation|context|background|setting)",
                r"(?:faced|encountered|dealing with)"
            ],
            "task": [
                r"(?:my role|I was responsible|I needed to|my job was)",
                r"(?:assigned|tasked|asked|expected) to",
                r"(?:goal|objective|target|aim) (?:was|to)",
                r"(?:challenge|problem|issue) (?:was|to solve)"
            ],
            "action": [
                r"(?:I did|I implemented|I created|I developed)",
                r"(?:my approach|I decided|I chose to|I started)",
                r"(?:first|then|next|finally|I also)",
                r"(?:strategy|method|process|steps) (?:I|we|was)"
            ],
            "result": [
                r"(?:as a result|outcome|result|impact|effect)",
                r"(?:achieved|accomplished|delivered|completed)",
                r"(?:improved|increased|decreased|reduced|saved)",
                r"(?:successful|success|positive|beneficial)"
            ]
        }
    
    def _setup_clarifying_questions(self) -> Dict[str, List[str]]:
        """Setup clarifying question templates."""
        return {
            "situation": [
                "Could you provide more context about the situation or setting where this happened?",
                "What was the background or circumstances that led to this experience?",
                "Can you describe the company/team/project environment in more detail?"
            ],
            "task": [
                "What specifically was your role or responsibility in this situation?",
                "What goal or objective were you trying to achieve?",
                "What problem were you asked to solve or what task were you given?"
            ],
            "action": [
                "What specific steps did you take to address this situation?",
                "Can you walk me through your approach or strategy?",
                "What actions did you personally take to tackle this challenge?"
            ],
            "result": [
                "What was the outcome or result of your actions?",
                "How did your efforts impact the situation?",
                "What did you achieve or accomplish through your work?"
            ]
        }
    
    @trace_agent_operation("process_request", AgentName.CONTEXT)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process story deconstruction requests."""
        action = request.get("action")
        
        handlers = {
            "deconstruct_story": self._deconstruct_story,
            "validate_star": self._validate_star_components,
            "generate_clarifying_question": self._generate_clarifying_question
        }
        
        handler = handlers.get(action)
        if not handler:
            return {"error": f"Unknown action: {action}"}
        
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error processing story deconstruction request {action}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.type == MessageType.REQUEST:
            request = {
                "action": message.payload.get("action", "deconstruct_story"),
                **message.payload
            }
            
            result = await self.process_request(request)
            
            return AgentMessage(
                id=f"story_deconstructor_response_{datetime.now().timestamp()}",
                type=MessageType.RESPONSE,
                from_agent=AgentName.CONTEXT,  # Using CONTEXT enum
                to_agent=message.from_agent,
                session_id=message.session_id,
                timestamp=datetime.now(),
                priority=MessagePriority.NORMAL,
                payload=result,
                correlation_id=message.id
            )
        
        return None
    
    async def _deconstruct_story(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Deconstruct a user story into STAR components."""
        story_text = request.get("story_text", "")
        
        if not story_text:
            return {"error": "No story text provided"}
        
        # First, try rule-based extraction
        rule_based_result = await self._rule_based_extraction(story_text)
        
        # If rule-based extraction is insufficient, use AI
        if rule_based_result.status == STARStatus.INCOMPLETE and self.model:
            ai_result = await self._ai_extraction(story_text, rule_based_result)
            final_result = ai_result
        else:
            final_result = rule_based_result
        
        # Generate clarifying question if needed
        if final_result.status == STARStatus.INCOMPLETE:
            final_result.clarifying_question = await self._generate_clarifying_question_for_missing(
                final_result.missing_components
            )
        
        return {
            "status": final_result.status.value,
            "situation": final_result.star_components.situation,
            "task": final_result.star_components.task,
            "action": final_result.star_components.action,
            "result": final_result.star_components.result,
            "clarifying_question": final_result.clarifying_question,
            "missing_components": final_result.missing_components or [],
            "confidence_score": final_result.confidence_score
        }
    
    async def _rule_based_extraction(self, story_text: str) -> DeconstructionResult:
        """Extract STAR components using rule-based patterns."""
        components = STARComponents()
        confidence_scores = {}
        
        # Split story into sentences for analysis
        sentences = re.split(r'[.!?]+', story_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Analyze each sentence for STAR components
        component_sentences = {
            "situation": [],
            "task": [],
            "action": [],
            "result": []
        }
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            
            for component, patterns in self.star_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, sentence_lower):
                        component_sentences[component].append(sentence)
                        break
        
        # Extract components based on matched sentences
        for component, sentences_list in component_sentences.items():
            if sentences_list:
                # Take the most relevant sentence or combine multiple
                if len(sentences_list) == 1:
                    content = sentences_list[0]
                else:
                    content = ". ".join(sentences_list[:2])  # Limit to 2 sentences
                
                setattr(components, component, content)
                confidence_scores[component] = min(len(sentences_list) * 0.3, 1.0)
        
        # Determine overall status
        missing_components = []
        for component in ["situation", "task", "action", "result"]:
            if not getattr(components, component):
                missing_components.append(component)
        
        status = STARStatus.COMPLETE if not missing_components else STARStatus.INCOMPLETE
        overall_confidence = sum(confidence_scores.values()) / 4 if confidence_scores else 0.0
        
        return DeconstructionResult(
            status=status,
            star_components=components,
            missing_components=missing_components,
            confidence_score=overall_confidence
        )
    
    async def _ai_extraction(self, story_text: str, initial_result: DeconstructionResult) -> DeconstructionResult:
        """Use AI to extract STAR components with more sophistication."""
        try:
            with trace_ai_operation("star_extraction", settings.default_model, "story_deconstruction") as span:
                prompt = self._create_star_extraction_prompt(story_text, initial_result)
                
                response = await self.model.generate_content_async(prompt)
                result_json = json.loads(response.text)
                
                # Create components from AI response
                components = STARComponents(
                    situation=result_json.get("situation"),
                    task=result_json.get("task"),
                    action=result_json.get("action"),
                    result=result_json.get("result")
                )
                
                # Determine missing components
                missing_components = []
                for component in ["situation", "task", "action", "result"]:
                    if not getattr(components, component):
                        missing_components.append(component)
                
                status = STARStatus.COMPLETE if not missing_components else STARStatus.INCOMPLETE
                confidence = result_json.get("confidence_score", 0.7)
                
                span.set_attribute("extraction_status", status.value)
                span.set_attribute("confidence_score", confidence)
                
                return DeconstructionResult(
                    status=status,
                    star_components=components,
                    missing_components=missing_components,
                    confidence_score=confidence
                )
                
        except Exception as e:
            logger.error(f"Error in AI extraction: {e}")
            return initial_result
    
    def _create_star_extraction_prompt(self, story_text: str, initial_result: DeconstructionResult) -> str:
        """Create prompt for AI-based STAR extraction."""
        return f"""
        Analyze this user story and extract STAR method components. Return ONLY valid JSON.
        
        Story: "{story_text}"
        
        Initial analysis found:
        - Situation: {initial_result.star_components.situation or "MISSING"}
        - Task: {initial_result.star_components.task or "MISSING"}
        - Action: {initial_result.star_components.action or "MISSING"}
        - Result: {initial_result.star_components.result or "MISSING"}
        
        Extract and improve each component:
        
        Return JSON format:
        {{
            "situation": "The context/background where this happened, or null if missing",
            "task": "The specific goal/responsibility/challenge, or null if missing", 
            "action": "The specific steps/actions taken, or null if missing",
            "result": "The outcome/impact achieved, or null if missing",
            "confidence_score": 0.0-1.0
        }}
        
        Rules:
        - Only extract information explicitly present in the story
        - Use null for missing components, don't invent content
        - Keep extracted text concise but complete
        - Confidence score based on clarity and completeness
        """
    
    async def _generate_clarifying_question_for_missing(self, missing_components: List[str]) -> str:
        """Generate appropriate clarifying question for missing components."""
        if not missing_components:
            return None
        
        # Prioritize components by importance
        priority_order = ["situation", "task", "action", "result"]
        
        # Find the highest priority missing component
        for component in priority_order:
            if component in missing_components:
                questions = self.clarifying_questions.get(component, [])
                return questions[0] if questions else f"Could you provide more detail about the {component}?"
        
        return "Could you provide more detail about your story?"
    
    async def _validate_star_components(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate provided STAR components for completeness."""
        components = {
            "situation": request.get("situation"),
            "task": request.get("task"),
            "action": request.get("action"),
            "result": request.get("result")
        }
        
        missing = [comp for comp, value in components.items() if not value]
        
        return {
            "valid": len(missing) == 0,
            "missing_components": missing,
            "completeness_score": (4 - len(missing)) / 4
        }
    
    async def _generate_clarifying_question(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a clarifying question for a specific component."""
        component = request.get("component")
        
        if component not in self.clarifying_questions:
            return {"error": f"Unknown component: {component}"}
        
        questions = self.clarifying_questions[component]
        
        # Select question based on context or use first one
        selected_question = questions[0]
        
        return {
            "clarifying_question": selected_question,
            "component": component
        }