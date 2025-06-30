"""Context Agent - Manages interview context and user information."""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import re

import google.generativeai as genai
from google.cloud import aiplatform
import httpx

from .base import BaseAgent, AgentMessage, MessageType, MessagePriority
from common.config import AgentName, settings
from common.telemetry import SessionTracker, trace_agent_operation, trace_ai_operation
from common.auth import firestore_client

logger = logging.getLogger(__name__)


class ContextType(str, Enum):
    """Types of context information."""
    RESUME = "resume"
    JOB_DESCRIPTION = "job_description"
    COMPANY_INFO = "company_info"
    INTERVIEW_HISTORY = "interview_history"
    USER_PREFERENCES = "user_preferences"
    TECHNICAL_SKILLS = "technical_skills"
    BEHAVIORAL_PATTERNS = "behavioral_patterns"


@dataclass
class ResumeData:
    """Structured resume information."""
    personal_info: Dict[str, Any] = field(default_factory=dict)
    experience: List[Dict[str, Any]] = field(default_factory=list)
    education: List[Dict[str, Any]] = field(default_factory=list)
    skills: Dict[str, List[str]] = field(default_factory=dict)
    projects: List[Dict[str, Any]] = field(default_factory=list)
    certifications: List[Dict[str, Any]] = field(default_factory=list)
    achievements: List[str] = field(default_factory=list)
    
    # Derived insights
    years_experience: int = 0
    technical_level: str = "mid"
    domain_expertise: List[str] = field(default_factory=list)
    leadership_experience: bool = False
    company_types: List[str] = field(default_factory=list)  # startup, enterprise, faang


@dataclass
class JobContext:
    """Job and company context information."""
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    job_description: Optional[str] = None
    requirements: List[str] = field(default_factory=list)
    preferred_skills: List[str] = field(default_factory=list)
    company_stage: Optional[str] = None  # startup, growth, enterprise
    company_culture: List[str] = field(default_factory=list)
    interview_process: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InterviewContext:
    """Context for current interview session."""
    session_id: str
    user_id: str
    interview_type: str
    faang_level: str
    
    # User information
    resume_data: Optional[ResumeData] = None
    job_context: Optional[JobContext] = None
    
    # Session dynamics
    response_patterns: Dict[str, Any] = field(default_factory=dict)
    knowledge_gaps: Set[str] = field(default_factory=set)
    strengths: Set[str] = field(default_factory=set)
    communication_style: Dict[str, Any] = field(default_factory=dict)
    
    # Adaptive context
    current_focus_areas: List[str] = field(default_factory=list)
    suggested_follow_ups: List[str] = field(default_factory=list)
    context_history: List[Dict[str, Any]] = field(default_factory=list)
    
    # External knowledge
    relevant_assessments: List[Dict[str, Any]] = field(default_factory=list)
    similar_experiences: List[Dict[str, Any]] = field(default_factory=list)


class ContextAgent(BaseAgent):
    """
    Context Agent for managing interview context and user information.
    
    This agent maintains comprehensive context about the user, job, company,
    and interview dynamics to provide relevant information to other agents.
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.CONTEXT, session_tracker)
        
        # Active contexts by session
        self.active_contexts: Dict[str, InterviewContext] = {}
        
        # AI client setup
        self._setup_ai_client()
        
        # Context extraction patterns
        self.extraction_patterns = self._setup_extraction_patterns()
        
        logger.info("Context Agent initialized")
    
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
    
    def _setup_extraction_patterns(self) -> Dict[str, Any]:
        """Setup patterns for context extraction."""
        return {
            "years_experience": [
                r"(\d+)\+?\s*years?\s*(?:of\s*)?experience",
                r"(\d+)\+?\s*years?\s*in",
                r"(\d+)\+?\s*yrs?\s*"
            ],
            "technical_skills": [
                r"(?:skills?|technologies?|tools?|languages?)[:\s]*([^.]+)",
                r"(?:proficient|experienced|expert)\s+(?:in|with)\s+([^.]+)",
                r"(?:used|worked with|utilized)\s+([^.]+)"
            ],
            "leadership_indicators": [
                r"(?:led|managed|directed|supervised)\s+(?:a\s+)?team",
                r"(?:tech\s+lead|team\s+lead|engineering\s+manager|senior)",
                r"(?:mentored|coached|guided)\s+\d+"
            ],
            "company_types": {
                "faang": ["google", "amazon", "apple", "facebook", "meta", "netflix", "microsoft"],
                "unicorn": ["uber", "airbnb", "stripe", "databricks", "snowflake"],
                "startup": ["startup", "early-stage", "seed", "series a"]
            }
        }
    
    @trace_agent_operation("process_request", AgentName.CONTEXT)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process context-related requests."""
        action = request.get("action")
        session_id = request.get("session_id")
        
        if not session_id:
            return {"error": "Missing session_id"}
        
        handlers = {
            "initialize_session": self._initialize_session,
            "update_context": self._update_context,
            "analyze_resume": self._analyze_resume,
            "extract_job_context": self._extract_job_context,
            "get_context_summary": self._get_context_summary,
            "get_relevant_experience": self._get_relevant_experience,
            "identify_knowledge_gaps": self._identify_knowledge_gaps
        }
        
        handler = handlers.get(action)
        if not handler:
            return {"error": f"Unknown action: {action}"}
        
        try:
            return await handler(request)
        except Exception as e:
            logger.error(f"Error processing context request {action}: {e}")
            return {"error": str(e)}
    
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """Handle inter-agent messages."""
        if message.type == MessageType.REQUEST:
            # Convert message to request format
            request = {
                "action": message.payload.get("action"),
                "session_id": message.session_id,
                **message.payload
            }
            
            result = await self.process_request(request)
            
            # Send response back
            return AgentMessage(
                id=f"context_response_{datetime.now().timestamp()}",
                type=MessageType.RESPONSE,
                from_agent=AgentName.CONTEXT,
                to_agent=message.from_agent,
                session_id=message.session_id,
                timestamp=datetime.now(),
                priority=MessagePriority.NORMAL,
                payload=result,
                correlation_id=message.id
            )
        
        elif message.type == MessageType.NOTIFICATION:
            # Handle state changes and other notifications
            await self._handle_notification(message)
        
        return None
    
    async def _initialize_session(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize context for a new session."""
        session_context = request.get("session_context", {})
        session_id = session_context.get("session_id")
        
        if not session_id:
            return {"error": "Missing session_id in session_context"}
        
        # Create new context
        context = InterviewContext(
            session_id=session_id,
            user_id=session_context.get("user_id", ""),
            interview_type=session_context.get("interview_type", "technical"),
            faang_level=session_context.get("faang_level", "L4")
        )
        
        # Process resume if provided
        resume_data = session_context.get("resume")
        if resume_data:
            context.resume_data = await self._process_resume(resume_data)
        
        # Process job description if provided
        job_description = session_context.get("job_description")
        if job_description:
            context.job_context = await self._process_job_description(job_description)
        
        # Load user's historical context
        await self._load_historical_context(context)
        
        # Store context
        self.active_contexts[session_id] = context
        
        return {
            "success": True,
            "context_summary": await self._generate_context_summary(context),
            "user_profile": await self._generate_user_profile(context)
        }
    
    async def _process_resume(self, resume_data: Dict[str, Any]) -> ResumeData:
        """Process and structure resume data."""
        
        # If it's raw text, extract structured data
        if isinstance(resume_data, str):
            return await self._extract_resume_from_text(resume_data)
        
        # If it's already structured, validate and enhance
        resume = ResumeData()
        
        # Map known fields
        resume.personal_info = resume_data.get("personal_info", {})
        resume.experience = resume_data.get("experience", [])
        resume.education = resume_data.get("education", [])
        resume.skills = resume_data.get("skills", {})
        resume.projects = resume_data.get("projects", [])
        resume.certifications = resume_data.get("certifications", [])
        resume.achievements = resume_data.get("achievements", [])
        
        # Derive insights
        await self._derive_resume_insights(resume)
        
        return resume
    
    async def _extract_resume_from_text(self, resume_text: str) -> ResumeData:
        """Extract structured data from resume text using AI."""
        if not self.model:
            return ResumeData()
        
        try:
            with trace_ai_operation("resume_extraction", settings.default_model, "context") as span:
                prompt = self._create_resume_extraction_prompt(resume_text)
                
                response = await self.model.generate_content_async(prompt)
                
                # Parse JSON response
                extracted_data = json.loads(response.text)
                
                resume = ResumeData()
                
                # Map extracted data
                resume.personal_info = extracted_data.get("personal_info", {})
                resume.experience = extracted_data.get("experience", [])
                resume.education = extracted_data.get("education", [])
                resume.skills = extracted_data.get("skills", {})
                resume.projects = extracted_data.get("projects", [])
                resume.certifications = extracted_data.get("certifications", [])
                resume.achievements = extracted_data.get("achievements", [])
                
                # Derive insights
                await self._derive_resume_insights(resume)
                
                span.set_attribute("extraction_success", True)
                
                return resume
                
        except Exception as e:
            logger.error(f"Error extracting resume: {e}")
            return ResumeData()
    
    def _create_resume_extraction_prompt(self, resume_text: str) -> str:
        """Create prompt for resume extraction."""
        return f"""
        Extract structured information from this resume text and return as JSON.
        
        Resume Text:
        {resume_text}
        
        Return JSON with this structure:
        {{
            "personal_info": {{
                "name": "string",
                "email": "string",
                "phone": "string",
                "location": "string"
            }},
            "experience": [
                {{
                    "company": "string",
                    "title": "string",
                    "duration": "string",
                    "description": "string",
                    "technologies": ["string"]
                }}
            ],
            "education": [
                {{
                    "institution": "string",
                    "degree": "string",
                    "field": "string",
                    "year": "string"
                }}
            ],
            "skills": {{
                "technical": ["string"],
                "languages": ["string"],
                "frameworks": ["string"],
                "tools": ["string"]
            }},
            "projects": [
                {{
                    "name": "string",
                    "description": "string",
                    "technologies": ["string"]
                }}
            ],
            "certifications": [
                {{
                    "name": "string",
                    "issuer": "string",
                    "date": "string"
                }}
            ],
            "achievements": ["string"]
        }}
        
        Extract only information that is clearly present in the text. Use empty arrays/objects for missing data.
        """
    
    async def _derive_resume_insights(self, resume: ResumeData):
        """Derive insights from resume data."""
        
        # Calculate years of experience
        total_years = 0
        for exp in resume.experience:
            duration = exp.get("duration", "")
            years = self._extract_duration_years(duration)
            total_years += years
        
        resume.years_experience = total_years
        
        # Determine technical level
        if total_years < 2:
            resume.technical_level = "junior"
        elif total_years < 5:
            resume.technical_level = "mid"
        elif total_years < 10:
            resume.technical_level = "senior"
        else:
            resume.technical_level = "staff"
        
        # Identify domain expertise
        domains = set()
        for exp in resume.experience:
            description = exp.get("description", "").lower()
            if "machine learning" in description or "ml" in description:
                domains.add("machine_learning")
            if "frontend" in description or "react" in description:
                domains.add("frontend")
            if "backend" in description or "api" in description:
                domains.add("backend")
            if "data" in description:
                domains.add("data_engineering")
            if "infrastructure" in description or "devops" in description:
                domains.add("infrastructure")
        
        resume.domain_expertise = list(domains)
        
        # Check for leadership experience
        leadership_indicators = ["lead", "manager", "director", "principal", "staff"]
        for exp in resume.experience:
            title = exp.get("title", "").lower()
            description = exp.get("description", "").lower()
            
            if any(indicator in title or indicator in description for indicator in leadership_indicators):
                resume.leadership_experience = True
                break
        
        # Identify company types
        company_types = set()
        for exp in resume.experience:
            company = exp.get("company", "").lower()
            
            # Check against patterns
            for company_type, patterns in self.extraction_patterns["company_types"].items():
                if any(pattern in company for pattern in patterns):
                    company_types.add(company_type)
        
        resume.company_types = list(company_types)
    
    def _extract_duration_years(self, duration_str: str) -> float:
        """Extract years from duration string."""
        if not duration_str:
            return 0
        
        # Look for patterns like "2 years", "1.5 years", "6 months"
        year_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", duration_str.lower())
        if year_match:
            return float(year_match.group(1))
        
        month_match = re.search(r"(\d+)\s*(?:months?|mos?)", duration_str.lower())
        if month_match:
            return float(month_match.group(1)) / 12
        
        return 1.0  # Default assumption
    
    async def _process_job_description(self, job_description: str) -> JobContext:
        """Process job description to extract context."""
        job_context = JobContext(job_description=job_description)
        
        if not self.model:
            return job_context
        
        try:
            with trace_ai_operation("job_extraction", settings.default_model, "context") as span:
                prompt = self._create_job_extraction_prompt(job_description)
                
                response = await self.model.generate_content_async(prompt)
                extracted_data = json.loads(response.text)
                
                job_context.company_name = extracted_data.get("company_name")
                job_context.role_title = extracted_data.get("role_title")
                job_context.requirements = extracted_data.get("requirements", [])
                job_context.preferred_skills = extracted_data.get("preferred_skills", [])
                job_context.company_stage = extracted_data.get("company_stage")
                job_context.company_culture = extracted_data.get("company_culture", [])
                
                span.set_attribute("extraction_success", True)
                
        except Exception as e:
            logger.error(f"Error extracting job context: {e}")
        
        return job_context
    
    def _create_job_extraction_prompt(self, job_description: str) -> str:
        """Create prompt for job description extraction."""
        return f"""
        Extract key information from this job description and return as JSON.
        
        Job Description:
        {job_description}
        
        Return JSON with this structure:
        {{
            "company_name": "string or null",
            "role_title": "string or null",
            "requirements": ["required skills/experience"],
            "preferred_skills": ["preferred skills/experience"],
            "company_stage": "startup|growth|enterprise or null",
            "company_culture": ["culture keywords"]
        }}
        
        Extract only clearly mentioned information. Use null for missing data.
        """
    
    async def _load_historical_context(self, context: InterviewContext):
        """Load user's historical interview context."""
        try:
            # Load previous interview data from Firestore
            user_doc = firestore_client.get_user_data(context.user_id, "interview_history")
            
            if user_doc:
                context.response_patterns = user_doc.get("response_patterns", {})
                context.knowledge_gaps = set(user_doc.get("knowledge_gaps", []))
                context.strengths = set(user_doc.get("strengths", []))
                context.communication_style = user_doc.get("communication_style", {})
                
        except Exception as e:
            logger.error(f"Error loading historical context: {e}")
    
    async def _update_context(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Update context based on user response."""
        session_id = request.get("session_id")
        user_response = request.get("user_response", "")
        response_time = request.get("response_time", 0)
        current_state = request.get("current_state")
        
        if session_id not in self.active_contexts:
            return {"error": "Session not found"}
        
        context = self.active_contexts[session_id]
        
        # Analyze response patterns
        analysis = await self._analyze_response(user_response, response_time, current_state)
        
        # Update context based on analysis
        context.response_patterns[current_state] = analysis.get("patterns", {})
        
        # Update knowledge gaps and strengths
        gaps = analysis.get("knowledge_gaps", [])
        strengths = analysis.get("strengths", [])
        
        context.knowledge_gaps.update(gaps)
        context.strengths.update(strengths)
        
        # Update communication style
        comm_style = analysis.get("communication_style", {})
        context.communication_style.update(comm_style)
        
        # Add to context history
        context.context_history.append({
            "timestamp": datetime.now().isoformat(),
            "state": current_state,
            "response_length": len(user_response),
            "response_time": response_time,
            "analysis": analysis
        })
        
        # Generate follow-up suggestions
        context.suggested_follow_ups = await self._generate_follow_up_suggestions(context, user_response)
        
        return {
            "success": True,
            "context_updates": {
                "knowledge_gaps": list(context.knowledge_gaps),
                "strengths": list(context.strengths),
                "communication_style": context.communication_style,
                "suggested_follow_ups": context.suggested_follow_ups
            }
        }
    
    async def _analyze_response(
        self, 
        user_response: str, 
        response_time: float, 
        current_state: str
    ) -> Dict[str, Any]:
        """Analyze user response for patterns and insights."""
        if not self.model:
            return {}
        
        try:
            with trace_ai_operation("response_analysis", settings.default_model, "context") as span:
                prompt = self._create_response_analysis_prompt(user_response, response_time, current_state)
                
                response = await self.model.generate_content_async(prompt)
                analysis = json.loads(response.text)
                
                span.set_attribute("analysis_success", True)
                return analysis
                
        except Exception as e:
            logger.error(f"Error analyzing response: {e}")
            return {}
    
    def _create_response_analysis_prompt(self, user_response: str, response_time: float, current_state: str) -> str:
        """Create prompt for response analysis."""
        return f"""
        Analyze this interview response and return insights as JSON.
        
        Current State: {current_state}
        Response Time: {response_time} seconds
        User Response: "{user_response}"
        
        Return JSON with this structure:
        {{
            "patterns": {{
                "response_length": "short|medium|long",
                "technical_depth": "shallow|medium|deep",
                "structure": "unstructured|somewhat_structured|well_structured",
                "confidence": "low|medium|high"
            }},
            "knowledge_gaps": ["specific gaps identified"],
            "strengths": ["specific strengths demonstrated"],
            "communication_style": {{
                "verbosity": "concise|moderate|verbose",
                "technical_language": "minimal|moderate|heavy",
                "examples_provided": true/false,
                "asks_clarifying_questions": true/false
            }}
        }}
        
        Base analysis on actual content. Be specific about gaps and strengths.
        """
    
    async def _generate_follow_up_suggestions(
        self, 
        context: InterviewContext, 
        user_response: str
    ) -> List[str]:
        """Generate follow-up question suggestions."""
        if not self.model:
            return []
        
        try:
            prompt = f"""
            Based on this interview context and user response, suggest 3 specific follow-up questions.
            
            Interview Type: {context.interview_type}
            FAANG Level: {context.faang_level}
            Current Knowledge Gaps: {list(context.knowledge_gaps)}
            Current Strengths: {list(context.strengths)}
            User Response: "{user_response}"
            
            Return as JSON array of strings:
            ["question 1", "question 2", "question 3"]
            
            Make questions specific and probe deeper into the response.
            """
            
            response = await self.model.generate_content_async(prompt)
            suggestions = json.loads(response.text)
            
            return suggestions if isinstance(suggestions, list) else []
            
        except Exception as e:
            logger.error(f"Error generating follow-up suggestions: {e}")
            return []
    
    async def _generate_context_summary(self, context: InterviewContext) -> Dict[str, Any]:
        """Generate a summary of the current context."""
        summary = {
            "user_profile": {
                "experience_level": context.resume_data.technical_level if context.resume_data else "unknown",
                "years_experience": context.resume_data.years_experience if context.resume_data else 0,
                "domain_expertise": context.resume_data.domain_expertise if context.resume_data else [],
                "leadership_experience": context.resume_data.leadership_experience if context.resume_data else False
            },
            "job_match": {},
            "interview_dynamics": {
                "knowledge_gaps": list(context.knowledge_gaps),
                "strengths": list(context.strengths),
                "communication_style": context.communication_style
            }
        }
        
        # Add job match information if available
        if context.job_context:
            summary["job_match"] = {
                "role_title": context.job_context.role_title,
                "company_stage": context.job_context.company_stage,
                "requirements_alignment": await self._assess_requirements_alignment(context)
            }
        
        return summary
    
    async def _assess_requirements_alignment(self, context: InterviewContext) -> Dict[str, Any]:
        """Assess how well user aligns with job requirements."""
        if not context.resume_data or not context.job_context:
            return {}
        
        # Simple alignment assessment
        user_skills = set()
        if context.resume_data.skills:
            for skill_category in context.resume_data.skills.values():
                user_skills.update([s.lower() for s in skill_category])
        
        job_requirements = set([req.lower() for req in context.job_context.requirements])
        
        matched_skills = user_skills.intersection(job_requirements)
        missing_skills = job_requirements - user_skills
        
        return {
            "matched_skills": list(matched_skills),
            "missing_skills": list(missing_skills),
            "alignment_score": len(matched_skills) / len(job_requirements) if job_requirements else 0
        }
    
    async def _generate_user_profile(self, context: InterviewContext) -> Dict[str, Any]:
        """Generate comprehensive user profile."""
        profile = {
            "session_id": context.session_id,
            "user_id": context.user_id,
            "interview_type": context.interview_type,
            "faang_level": context.faang_level
        }
        
        if context.resume_data:
            profile["resume_summary"] = {
                "experience_level": context.resume_data.technical_level,
                "years_experience": context.resume_data.years_experience,
                "domain_expertise": context.resume_data.domain_expertise,
                "leadership_experience": context.resume_data.leadership_experience,
                "company_types": context.resume_data.company_types
            }
        
        if context.job_context:
            profile["target_role"] = {
                "company": context.job_context.company_name,
                "title": context.job_context.role_title,
                "stage": context.job_context.company_stage
            }
        
        return profile
    
    async def _handle_notification(self, message: AgentMessage):
        """Handle notifications from other agents."""
        event = message.payload.get("event")
        
        if event == "state_change":
            session_id = message.session_id
            if session_id in self.active_contexts:
                context = self.active_contexts[session_id]
                
                # Update current focus areas based on new state
                new_state = message.payload.get("new_state")
                context.current_focus_areas = self._get_focus_areas_for_state(new_state)
                
                logger.info(f"Updated focus areas for state {new_state}: {context.current_focus_areas}")
    
    def _get_focus_areas_for_state(self, state: str) -> List[str]:
        """Get focus areas for interview state."""
        focus_map = {
            "scoping": ["problem_understanding", "requirements_gathering", "clarifying_questions"],
            "analysis": ["system_analysis", "trade_offs", "constraints", "assumptions"],
            "solutioning": ["architecture_design", "component_interaction", "scalability"],
            "metrics": ["performance_metrics", "monitoring", "success_criteria"],
            "challenging": ["edge_cases", "failure_scenarios", "optimization"]
        }
        
        return focus_map.get(state, ["general_assessment"])
    
    async def _get_context_summary(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Get summary of current context."""
        session_id = request.get("session_id")
        
        if session_id not in self.active_contexts:
            return {"error": "Session not found"}
        
        context = self.active_contexts[session_id]
        return await self._generate_context_summary(context)
    
    async def _get_relevant_experience(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Get relevant experience for current topic."""
        session_id = request.get("session_id")
        topic = request.get("topic", "")
        
        if session_id not in self.active_contexts:
            return {"error": "Session not found"}
        
        context = self.active_contexts[session_id]
        
        if not context.resume_data:
            return {"relevant_experience": []}
        
        # Find relevant experience based on topic
        relevant_exp = []
        topic_lower = topic.lower()
        
        for exp in context.resume_data.experience:
            description = exp.get("description", "").lower()
            title = exp.get("title", "").lower()
            technologies = [t.lower() for t in exp.get("technologies", [])]
            
            if (topic_lower in description or 
                topic_lower in title or 
                any(topic_lower in tech for tech in technologies)):
                relevant_exp.append(exp)
        
        return {"relevant_experience": relevant_exp}
    
    async def _identify_knowledge_gaps(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Identify knowledge gaps for current topic."""
        session_id = request.get("session_id")
        topic = request.get("topic", "")
        
        if session_id not in self.active_contexts:
            return {"error": "Session not found"}
        
        context = self.active_contexts[session_id]
        
        # Current gaps
        current_gaps = list(context.knowledge_gaps)
        
        # Topic-specific gaps based on user profile and job requirements
        topic_gaps = []
        
        if context.job_context and context.resume_data:
            job_skills = set([req.lower() for req in context.job_context.requirements])
            user_skills = set()
            
            if context.resume_data.skills:
                for skill_list in context.resume_data.skills.values():
                    user_skills.update([s.lower() for s in skill_list])
            
            topic_gaps = list(job_skills - user_skills)
        
        return {
            "current_gaps": current_gaps,
            "topic_specific_gaps": topic_gaps,
            "recommendations": await self._generate_gap_recommendations(current_gaps + topic_gaps)
        }
    
    async def _generate_gap_recommendations(self, gaps: List[str]) -> List[str]:
        """Generate recommendations to address knowledge gaps."""
        if not gaps or not self.model:
            return []
        
        try:
            prompt = f"""
            Based on these knowledge gaps, provide 3 specific recommendations for interview preparation:
            
            Knowledge Gaps: {gaps}
            
            Return as JSON array of strings:
            ["recommendation 1", "recommendation 2", "recommendation 3"]
            
            Make recommendations specific and actionable.
            """
            
            response = await self.model.generate_content_async(prompt)
            recommendations = json.loads(response.text)
            
            return recommendations if isinstance(recommendations, list) else []
            
        except Exception as e:
            logger.error(f"Error generating gap recommendations: {e}")
            return []