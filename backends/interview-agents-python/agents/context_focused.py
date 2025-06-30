"""Context Agent - Focused on Phase 1 JTBD definition for document parsing."""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
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
class ParsedDocument:
    """Structured JSON output from document parsing."""
    experience: List[Dict[str, Any]]
    skills: List[str]
    education: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    certifications: List[Dict[str, Any]]
    contact_info: Dict[str, str]
    summary: str
    parsing_confidence: float = 0.0


class ContextAgentFocused(BaseAgent):
    """
    Context Agent aligned with Phase 1 JTBD definition.
    
    JTBD: To parse unstructured user-provided documents (e.g., resumes) and 
    transform them into a structured JSON summary of key experiences, skills, and projects.
    
    Boundaries & Anti-Goals:
    - Does not interpret the quality or effectiveness of the source document's content
    - Operates only during the pre-interview setup phase
    - Does not provide ongoing context management during interviews
    
    Inputs: A raw document file (e.g., PDF, DOCX)
    Outputs: A structured JSON object for use by other agents
    """
    
    def __init__(self, session_tracker: Optional[SessionTracker] = None):
        super().__init__(AgentName.CONTEXT, session_tracker)
        
        # AI client setup
        self._setup_ai_client()
        
        # Document parsing patterns and templates
        self.parsing_patterns = self._setup_parsing_patterns()
        
        logger.info("Context Agent (Focused) initialized")
    
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
    
    def _setup_parsing_patterns(self) -> Dict[str, Any]:
        """Setup patterns for document parsing."""
        return {
            "experience_keywords": [
                "experience", "work history", "employment", "professional experience",
                "career", "positions", "roles", "work experience"
            ],
            "skills_keywords": [
                "skills", "technical skills", "technologies", "programming languages",
                "tools", "frameworks", "expertise", "competencies"
            ],
            "education_keywords": [
                "education", "degree", "university", "college", "school",
                "academic", "qualification", "certification"
            ],
            "projects_keywords": [
                "projects", "personal projects", "side projects", "portfolio",
                "github", "repositories", "work samples"
            ],
            "contact_patterns": {
                "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                "phone": r"[\+]?[1-9]?[\d\s\-\(\)]{10,}",
                "linkedin": r"linkedin\.com/in/[a-zA-Z0-9\-]+"
            }
        }
    
    @trace_agent_operation("process_request", AgentName.CONTEXT)
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process document parsing requests."""
        action = request.get("action")
        
        handlers = {
            "parse_document": self._parse_document,
            "parse_resume": self._parse_resume,
            "extract_structured_data": self._extract_structured_data,
            "validate_parsing": self._validate_parsing_result
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
            request = {
                "action": message.payload.get("action", "parse_document"),
                **message.payload
            }
            
            result = await self.process_request(request)
            
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
        
        return None
    
    async def _parse_document(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Parse a document into structured JSON format."""
        document_content = request.get("document_content", "")
        document_type = request.get("document_type", "resume")
        
        if not document_content:
            return {"error": "No document content provided"}
        
        # Route to specific parsing method based on document type
        if document_type.lower() in ["resume", "cv"]:
            return await self._parse_resume({"resume_content": document_content})
        else:
            return {"error": f"Unsupported document type: {document_type}"}
    
    async def _parse_resume(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Parse resume content into structured JSON."""
        resume_content = request.get("resume_content", "")
        
        if not resume_content:
            return {"error": "No resume content provided"}
        
        # Use AI-powered parsing if available, fallback to rule-based
        if self.model:
            parsed_data = await self._ai_resume_parsing(resume_content)
        else:
            parsed_data = await self._rule_based_resume_parsing(resume_content)
        
        # Return structured JSON as specified in JTBD
        return {
            "experience": parsed_data.experience,
            "skills": parsed_data.skills,
            "education": parsed_data.education,
            "projects": parsed_data.projects,
            "certifications": parsed_data.certifications,
            "contact_info": parsed_data.contact_info,
            "summary": parsed_data.summary,
            "parsing_confidence": parsed_data.parsing_confidence,
            "parsed_at": datetime.now().isoformat()
        }
    
    async def _ai_resume_parsing(self, resume_content: str) -> ParsedDocument:
        """Use AI to parse resume content."""
        try:
            with trace_ai_operation("resume_parsing", settings.default_model, "context") as span:
                prompt = self._create_resume_parsing_prompt(resume_content)
                
                response = await self.model.generate_content_async(prompt)
                parsed_json = json.loads(response.text)
                
                # Create ParsedDocument from AI response
                parsed_data = ParsedDocument(
                    experience=parsed_json.get("experience", []),
                    skills=parsed_json.get("skills", []),
                    education=parsed_json.get("education", []),
                    projects=parsed_json.get("projects", []),
                    certifications=parsed_json.get("certifications", []),
                    contact_info=parsed_json.get("contact_info", {}),
                    summary=parsed_json.get("summary", ""),
                    parsing_confidence=parsed_json.get("confidence", 0.8)
                )
                
                span.set_attribute("parsing_success", True)
                span.set_attribute("confidence", parsed_data.parsing_confidence)
                
                return parsed_data
                
        except Exception as e:
            logger.error(f"Error in AI resume parsing: {e}")
            return await self._rule_based_resume_parsing(resume_content)
    
    def _create_resume_parsing_prompt(self, resume_content: str) -> str:
        """Create prompt for AI resume parsing."""
        return f"""
        Parse this resume content into structured JSON format. Extract only information explicitly present.
        
        Resume Content:
        {resume_content}
        
        Return JSON with this exact structure:
        {{
            "experience": [
                {{
                    "company": "Company Name",
                    "title": "Job Title",
                    "start_date": "Start Date",
                    "end_date": "End Date or Present",
                    "description": "Job description/responsibilities",
                    "technologies": ["tech1", "tech2"]
                }}
            ],
            "skills": ["skill1", "skill2", "skill3"],
            "education": [
                {{
                    "institution": "School Name",
                    "degree": "Degree Type",
                    "field": "Field of Study",
                    "graduation_date": "Date",
                    "gpa": "GPA if mentioned"
                }}
            ],
            "projects": [
                {{
                    "name": "Project Name",
                    "description": "Project description",
                    "technologies": ["tech1", "tech2"],
                    "url": "Project URL if available"
                }}
            ],
            "certifications": [
                {{
                    "name": "Certification Name",
                    "issuer": "Issuing Organization",
                    "date": "Date obtained"
                }}
            ],
            "contact_info": {{
                "email": "email@example.com",
                "phone": "phone number",
                "linkedin": "LinkedIn URL",
                "location": "City, State"
            }},
            "summary": "Brief professional summary from resume",
            "confidence": 0.0-1.0
        }}
        
        Rules:
        - Only extract information explicitly stated in the resume
        - Use null or empty arrays for missing sections
        - Preserve original text as much as possible
        - Don't infer or add information not present
        - Focus on factual extraction, not interpretation
        """
    
    async def _rule_based_resume_parsing(self, resume_content: str) -> ParsedDocument:
        """Fallback rule-based resume parsing."""
        
        # Initialize structure
        parsed_data = ParsedDocument(
            experience=[],
            skills=[],
            education=[],
            projects=[],
            certifications=[],
            contact_info={},
            summary="",
            parsing_confidence=0.3  # Lower confidence for rule-based
        )
        
        # Split content into sections
        sections = self._identify_resume_sections(resume_content)
        
        # Parse each section
        for section_name, section_content in sections.items():
            if section_name == "experience":
                parsed_data.experience = self._parse_experience_section(section_content)
            elif section_name == "skills":
                parsed_data.skills = self._parse_skills_section(section_content)
            elif section_name == "education":
                parsed_data.education = self._parse_education_section(section_content)
            elif section_name == "projects":
                parsed_data.projects = self._parse_projects_section(section_content)
        
        # Extract contact information
        parsed_data.contact_info = self._extract_contact_info(resume_content)
        
        # Generate summary
        parsed_data.summary = self._generate_summary(resume_content)
        
        return parsed_data
    
    def _identify_resume_sections(self, content: str) -> Dict[str, str]:
        """Identify and extract resume sections."""
        sections = {}
        current_section = None
        current_content = []
        
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line is a section header
            line_lower = line.lower()
            section_detected = None
            
            for section, keywords in self.parsing_patterns.items():
                if isinstance(keywords, list):
                    for keyword in keywords:
                        if keyword in line_lower:
                            section_detected = section.replace("_keywords", "")
                            break
                    if section_detected:
                        break
            
            if section_detected:
                # Save previous section
                if current_section and current_content:
                    sections[current_section] = '\n'.join(current_content)
                
                # Start new section
                current_section = section_detected
                current_content = []
            else:
                # Add to current section
                if current_section:
                    current_content.append(line)
        
        # Save last section
        if current_section and current_content:
            sections[current_section] = '\n'.join(current_content)
        
        return sections
    
    def _parse_experience_section(self, content: str) -> List[Dict[str, Any]]:
        """Parse experience section."""
        experiences = []
        
        # Simple pattern matching for experience entries
        # This is a basic implementation - would need more sophisticated parsing for production
        lines = content.split('\n')
        current_experience = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for company/title patterns
            if any(word in line.lower() for word in ['at', 'company', 'inc', 'corp', 'ltd']):
                if current_experience:
                    experiences.append(current_experience)
                current_experience = {
                    "company": line,
                    "title": "",
                    "start_date": "",
                    "end_date": "",
                    "description": "",
                    "technologies": []
                }
            else:
                # Add to description
                if current_experience:
                    current_experience["description"] += line + " "
        
        if current_experience:
            experiences.append(current_experience)
        
        return experiences
    
    def _parse_skills_section(self, content: str) -> List[str]:
        """Parse skills section."""
        skills = []
        
        # Split by common delimiters
        delimiters = [',', '•', '|', '\n', ';']
        skill_text = content
        
        for delimiter in delimiters:
            skill_text = skill_text.replace(delimiter, ',')
        
        # Extract individual skills
        skill_items = [skill.strip() for skill in skill_text.split(',')]
        skills = [skill for skill in skill_items if skill and len(skill) > 1]
        
        return skills
    
    def _parse_education_section(self, content: str) -> List[Dict[str, Any]]:
        """Parse education section."""
        # Basic education parsing
        return [{
            "institution": "Education details extracted from resume",
            "degree": "",
            "field": "",
            "graduation_date": "",
            "gpa": ""
        }]
    
    def _parse_projects_section(self, content: str) -> List[Dict[str, Any]]:
        """Parse projects section."""
        # Basic project parsing
        return [{
            "name": "Project details extracted from resume",
            "description": content[:200] + "..." if len(content) > 200 else content,
            "technologies": [],
            "url": ""
        }]
    
    def _extract_contact_info(self, content: str) -> Dict[str, str]:
        """Extract contact information using regex patterns."""
        contact_info = {}
        
        # Extract email
        email_match = re.search(self.parsing_patterns["contact_patterns"]["email"], content)
        if email_match:
            contact_info["email"] = email_match.group(0)
        
        # Extract phone
        phone_match = re.search(self.parsing_patterns["contact_patterns"]["phone"], content)
        if phone_match:
            contact_info["phone"] = phone_match.group(0)
        
        # Extract LinkedIn
        linkedin_match = re.search(self.parsing_patterns["contact_patterns"]["linkedin"], content)
        if linkedin_match:
            contact_info["linkedin"] = linkedin_match.group(0)
        
        return contact_info
    
    def _generate_summary(self, content: str) -> str:
        """Generate a brief summary from resume content."""
        # Take first paragraph or first 200 characters as summary
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if len(line) > 50:  # Likely a summary paragraph
                return line[:200] + "..." if len(line) > 200 else line
        
        return content[:200] + "..." if len(content) > 200 else content
    
    async def _extract_structured_data(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract structured data from any document type."""
        document_content = request.get("document_content", "")
        target_schema = request.get("target_schema", {})
        
        if not document_content:
            return {"error": "No document content provided"}
        
        # This is a generic extraction method that could be extended
        # for other document types beyond resumes
        
        return {
            "extracted_data": {},
            "confidence": 0.5,
            "extraction_method": "generic"
        }
    
    async def _validate_parsing_result(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the parsing result for completeness."""
        parsed_data = request.get("parsed_data", {})
        
        required_fields = ["experience", "skills", "education"]
        missing_fields = []
        
        for field in required_fields:
            if field not in parsed_data or not parsed_data[field]:
                missing_fields.append(field)
        
        return {
            "valid": len(missing_fields) == 0,
            "missing_fields": missing_fields,
            "completeness_score": (len(required_fields) - len(missing_fields)) / len(required_fields)
        }