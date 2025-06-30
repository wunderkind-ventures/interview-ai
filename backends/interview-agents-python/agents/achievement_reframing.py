"""Achievement Reframing Agent - Reframes STAR stories into optimized formats."""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass

import google.generativeai as genai
from google.cloud import aiplatform

from .base import BaseAgent, AgentMessage, MessageType, MessagePriority
from common.config import AgentName, settings
from common.telemetry import SessionTracker, trace_agent_operation, trace_ai_operation

logger = logging.getLogger(__name__)


@dataclass
class STARStory:
    """Complete STAR story structure."""
    situation: str
    task: str
    action: str
    result: str


@dataclass
class ReframedAchievement:
    """Reframed achievement in multiple formats."""
    resume_bullet: str
    behavioral_story_narrative: str
    cover_letter_snippet: str
    confidence_score: float = 0.0


class AchievementReframingAgent(BaseAgent):
    """
    Achievement Reframing Agent for Narrative Refinement Module.
    
    JTBD: To take a complete, quantified STAR story and expertly rewrite it 
    into three distinct, optimized formats: a concise resume bullet, a compelling 
    behavioral interview narrative, and a persuasive cover letter snippet.
    
    Boundaries:
    - Does not create new content or achievements
    - Only reframes the final, user-approved story
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.SYNTHESIS, session_tracker)  # Using SYNTHESIS enum
        
        # AI client setup
        self._setup_ai_client()
        
        # Reframing templates and guidelines
        self.reframing_guidelines = self._setup_reframing_guidelines()
        
        logger.info("Achievement Reframing Agent initialized")
    
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
    
    def _setup_reframing_guidelines(self) -> Dict[str, Dict[str, str]]:
        """Setup guidelines for different reframing formats."""
        return {
            "resume_bullet": {
                "format": "Action verb + specific accomplishment + quantified impact",
                "length": "1-2 lines, under 150 characters ideally",
                "style": "Concise, punchy, numbers-heavy",
                "example": "Optimized database queries reducing response time by 40% and serving 50K+ daily users",
                "guidelines": [
                    "Start with strong action verb",
                    "Include specific metrics and numbers",
                    "Focus on impact and results",
                    "Use industry-relevant keywords",
                    "Keep under 2 lines"
                ]
            },
            "behavioral_story": {
                "format": "Full STAR narrative with smooth transitions",
                "length": "60-90 seconds when spoken (150-250 words)",
                "style": "Conversational, structured, engaging",
                "example": "In my role as... I was tasked with... My approach was... As a result...",
                "guidelines": [
                    "Use smooth transitions between STAR components",
                    "Make it sound natural when spoken",
                    "Include enough detail to be compelling",
                    "End with strong, quantified impact",
                    "Make personal contribution clear"
                ]
            },
            "cover_letter_snippet": {
                "format": "1-2 sentences highlighting key achievement",
                "length": "25-40 words per sentence",
                "style": "Professional, relevant to target role",
                "example": "My experience optimizing systems for scale aligns with your need for...",
                "guidelines": [
                    "Connect achievement to target role/company",
                    "Focus on most relevant aspects",
                    "Use professional but engaging tone",
                    "Include key metrics",
                    "Show value proposition"
                ]
            }
        }
    
    @trace_agent_operation("process_request", AgentName.SYNTHESIS)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process achievement reframing requests."""
        action = request.get("action")
        
        handlers = {
            "reframe_achievement": self._reframe_achievement,
            "reframe_single_format": self._reframe_single_format,
            "optimize_existing": self._optimize_existing_reframe
        }
        
        handler = handlers.get(action)
        if not handler:
            return {"error": f"Unknown action: {action}"}
        
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error processing achievement reframing request {action}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.type == MessageType.REQUEST:
            request = {
                "action": message.payload.get("action", "reframe_achievement"),
                **message.payload
            }
            
            result = await self.process_request(request)
            
            return AgentMessage(
                id=f"achievement_reframing_response_{datetime.now().timestamp()}",
                type=MessageType.RESPONSE,
                from_agent=AgentName.SYNTHESIS,
                to_agent=message.from_agent,
                session_id=message.session_id,
                timestamp=datetime.now(),
                priority=MessagePriority.NORMAL,
                payload=result,
                correlation_id=message.id
            )
        
        return None
    
    async def _reframe_achievement(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Reframe complete STAR story into all three formats."""
        star_story = self._extract_star_story(request)
        
        if not star_story:
            return {"error": "Invalid or incomplete STAR story provided"}
        
        # Extract optional context
        target_company = request.get("target_company")
        job_description_snippet = request.get("job_description_snippet")
        target_role = request.get("target_role")
        
        # Perform reframing
        if self.model:
            result = await self._ai_reframing(star_story, target_company, job_description_snippet, target_role)
        else:
            result = self._template_based_reframing(star_story)
        
        return {
            "resume_bullet": result.resume_bullet,
            "behavioral_story_narrative": result.behavioral_story_narrative,
            "cover_letter_snippet": result.cover_letter_snippet,
            "confidence_score": result.confidence_score
        }
    
    def _extract_star_story(self, request: Dict[str, Any]) -> Optional[STARStory]:
        """Extract STAR story from request."""
        try:
            return STARStory(
                situation=request.get("situation", ""),
                task=request.get("task", ""),
                action=request.get("action", ""),
                result=request.get("result", "")
            )
        except Exception as e:
            logger.error(f"Error extracting STAR story: {e}")
            return None
    
    async def _ai_reframing(
        self, 
        star_story: STARStory, 
        target_company: Optional[str] = None,
        job_description: Optional[str] = None,
        target_role: Optional[str] = None
    ) -> ReframedAchievement:
        """Use AI to reframe the achievement into all formats."""
        try:
            with trace_ai_operation("achievement_reframing", settings.default_model, "reframing") as span:
                prompt = self._create_reframing_prompt(star_story, target_company, job_description, target_role)
                
                response = await self.model.generate_content_async(prompt)
                result_json = json.loads(response.text)
                
                achievement = ReframedAchievement(
                    resume_bullet=result_json.get("resume_bullet", ""),
                    behavioral_story_narrative=result_json.get("behavioral_story_narrative", ""),
                    cover_letter_snippet=result_json.get("cover_letter_snippet", ""),
                    confidence_score=result_json.get("confidence_score", 0.8)
                )
                
                span.set_attribute("reframing_success", True)
                span.set_attribute("confidence_score", achievement.confidence_score)
                
                return achievement
                
        except Exception as e:
            logger.error(f"Error in AI reframing: {e}")
            return self._template_based_reframing(star_story)
    
    def _create_reframing_prompt(
        self, 
        star_story: STARStory,
        target_company: Optional[str] = None,
        job_description: Optional[str] = None,
        target_role: Optional[str] = None
    ) -> str:
        """Create prompt for AI-based achievement reframing."""
        
        context_section = ""
        if target_company or job_description or target_role:
            context_section = f"""
            
            TARGET CONTEXT:
            - Company: {target_company or 'Not specified'}
            - Role: {target_role or 'Not specified'}
            - Job Requirements: {job_description or 'Not specified'}
            
            Use this context to make the reframing more relevant and targeted.
            """
        
        return f"""
        Reframe this STAR story into three optimized formats. Return ONLY valid JSON.
        
        STAR STORY:
        - Situation: {star_story.situation}
        - Task: {star_story.task}
        - Action: {star_story.action}
        - Result: {star_story.result}
        {context_section}
        
        REFRAMING GUIDELINES:
        
        1. RESUME BULLET (1-2 lines, <150 chars):
        - Start with action verb
        - Include specific metrics
        - Focus on impact
        - Industry keywords
        
        2. BEHAVIORAL STORY (60-90 seconds spoken, 150-250 words):
        - Natural conversational flow
        - Smooth STAR transitions
        - Engaging and detailed
        - Clear personal contribution
        
        3. COVER LETTER SNIPPET (1-2 sentences, 25-40 words each):
        - Connect to target role/company
        - Professional tone
        - Value proposition focus
        - Key metrics included
        
        Return JSON format:
        {{
            "resume_bullet": "Action verb + accomplishment + quantified impact",
            "behavioral_story_narrative": "Full STAR narrative with smooth transitions...",
            "cover_letter_snippet": "Professional sentences connecting achievement to target role...",
            "confidence_score": 0.0-1.0
        }}
        
        REQUIREMENTS:
        - Use ONLY information from the provided STAR story
        - Don't invent new achievements or exaggerate
        - Maintain accuracy while optimizing presentation
        - Make each format distinct and purpose-built
        """
    
    def _template_based_reframing(self, star_story: STARStory) -> ReframedAchievement:
        """Fallback template-based reframing when AI is not available."""
        
        # Extract key elements
        action_words = self._extract_action_words(star_story.action)
        metrics = self._extract_metrics(star_story.result)
        main_accomplishment = self._extract_main_accomplishment(star_story)
        
        # Resume bullet (simple template)
        resume_bullet = f"{action_words[0] if action_words else 'Achieved'} {main_accomplishment}"
        if metrics:
            resume_bullet += f" {metrics[0]}"
        
        # Behavioral story (concatenate with transitions)
        behavioral_story = (
            f"In {star_story.situation}, {star_story.task}. "
            f"My approach was {star_story.action}. "
            f"As a result, {star_story.result}."
        )
        
        # Cover letter snippet (focus on relevance)
        cover_letter = f"My experience with {main_accomplishment} demonstrates my ability to deliver results"
        if metrics:
            cover_letter += f", including {metrics[0]}"
        cover_letter += "."
        
        return ReframedAchievement(
            resume_bullet=resume_bullet,
            behavioral_story_narrative=behavioral_story,
            cover_letter_snippet=cover_letter,
            confidence_score=0.3  # Low confidence for template-based
        )
    
    def _extract_action_words(self, action_text: str) -> list:
        """Extract action verbs from action text."""
        action_verbs = [
            "developed", "implemented", "created", "designed", "built", "optimized",
            "improved", "led", "managed", "coordinated", "analyzed", "solved",
            "reduced", "increased", "automated", "streamlined", "enhanced"
        ]
        
        found_verbs = []
        action_lower = action_text.lower()
        
        for verb in action_verbs:
            if verb in action_lower:
                found_verbs.append(verb.capitalize())
        
        return found_verbs
    
    def _extract_metrics(self, result_text: str) -> list:
        """Extract quantitative metrics from result text."""
        import re
        
        metrics = []
        
        # Look for percentages
        percent_matches = re.findall(r'\d+(?:\.\d+)?%', result_text)
        metrics.extend(percent_matches)
        
        # Look for dollar amounts
        dollar_matches = re.findall(r'\$[\d,]+(?:\.\d{2})?[KMB]?', result_text)
        metrics.extend(dollar_matches)
        
        # Look for time periods
        time_matches = re.findall(r'\d+(?:\.\d+)?\s*(?:hours?|days?|weeks?|months?)', result_text)
        metrics.extend(time_matches)
        
        # Look for volume numbers
        volume_matches = re.findall(r'\d+(?:,\d{3})*\s*(?:users?|customers?|people)', result_text)
        metrics.extend(volume_matches)
        
        return metrics
    
    def _extract_main_accomplishment(self, star_story: STARStory) -> str:
        """Extract the main accomplishment from the STAR story."""
        # Simple heuristic: use the first substantial phrase from the action or result
        action_words = star_story.action.split()[:8]  # First 8 words
        main_accomplishment = " ".join(action_words)
        
        # Clean up
        main_accomplishment = main_accomplishment.strip(".,!?")
        
        return main_accomplishment
    
    async def _reframe_single_format(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Reframe into a single specific format."""
        format_type = request.get("format_type")
        
        if format_type not in ["resume_bullet", "behavioral_story", "cover_letter_snippet"]:
            return {"error": f"Invalid format type: {format_type}"}
        
        star_story = self._extract_star_story(request)
        if not star_story:
            return {"error": "Invalid or incomplete STAR story provided"}
        
        # Get full reframing and return specific format
        full_result = await self._reframe_achievement(request)
        
        return {
            "format_type": format_type,
            "reframed_text": full_result.get(format_type, ""),
            "confidence_score": full_result.get("confidence_score", 0.0)
        }
    
    async def _optimize_existing_reframe(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize an existing reframed achievement."""
        existing_text = request.get("existing_text", "")
        format_type = request.get("format_type", "")
        feedback = request.get("feedback", "")
        
        if not existing_text or not format_type:
            return {"error": "Missing existing_text or format_type"}
        
        # Use AI to optimize based on feedback
        if self.model:
            try:
                prompt = f"""
                Optimize this {format_type} based on the feedback provided.
                
                Current {format_type}: "{existing_text}"
                
                Feedback: "{feedback}"
                
                Guidelines for {format_type}:
                {self.reframing_guidelines.get(format_type, {}).get('guidelines', [])}
                
                Return JSON with:
                {{
                    "optimized_text": "improved version",
                    "changes_made": ["list of changes"],
                    "confidence_score": 0.0-1.0
                }}
                """
                
                response = await self.model.generate_content_async(prompt)
                result = json.loads(response.text)
                
                return result
                
            except Exception as e:
                logger.error(f"Error in optimization: {e}")
                return {"error": f"Optimization failed: {str(e)}"}
        
        return {"error": "AI optimization not available"}