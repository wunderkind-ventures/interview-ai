"""BigQuery analytics client for tracking interview sessions and metrics."""

import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import uuid4
from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError

logger = logging.getLogger(__name__)


class AnalyticsClient:
    """Client for writing analytics data to BigQuery."""
    
    def __init__(self, project_id: str, environment: str = "dev"):
        """Initialize BigQuery client.
        
        Args:
            project_id: GCP project ID
            environment: Environment name (dev, stage, prod)
        """
        self.project_id = project_id
        self.environment = environment
        self.dataset_id = f"interview_analytics_{environment}"
        
        try:
            self.client = bigquery.Client(project=project_id)
            self._table_prefix = f"{project_id}.{self.dataset_id}"
            logger.info(f"Initialized BigQuery analytics client for {self.dataset_id}")
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery client: {e}")
            self.client = None
    
    def _get_table(self, table_name: str) -> Optional[bigquery.Table]:
        """Get a BigQuery table reference."""
        if not self.client:
            return None
        
        table_id = f"{self._table_prefix}.{table_name}"
        try:
            return self.client.get_table(table_id)
        except Exception as e:
            logger.error(f"Failed to get table {table_id}: {e}")
            return None
    
    def log_interview_session(self, session_data: Dict[str, Any]) -> bool:
        """Log a new interview session.
        
        Args:
            session_data: Dictionary containing session information
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False
        
        try:
            table = self._get_table("interview_sessions")
            if not table:
                return False
            
            rows = [{
                "session_id": session_data.get("session_id"),
                "user_id": session_data.get("user_id"),
                "started_at": datetime.utcnow(),
                "status": "active",
                "interview_type": session_data.get("interview_type", "behavioral"),
                "target_role": session_data.get("target_role"),
                "company": session_data.get("company"),
                "metadata": session_data
            }]
            
            errors = self.client.insert_rows_json(table, rows)
            if errors:
                logger.error(f"Failed to insert interview session: {errors}")
                return False
                
            logger.info(f"Logged interview session: {session_data.get('session_id')}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging interview session: {e}")
            return False
    
    def log_agent_interaction(
        self,
        session_id: str,
        source_agent: str,
        interaction_type: str,
        content: Optional[str] = None,
        target_agent: Optional[str] = None,
        processing_time_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log an agent interaction.
        
        Args:
            session_id: Interview session ID
            source_agent: Name of the source agent
            interaction_type: Type of interaction (message, request, response, error)
            content: Content of the interaction
            target_agent: Name of the target agent (if applicable)
            processing_time_ms: Processing time in milliseconds
            success: Whether the interaction was successful
            error_message: Error message if failed
            metadata: Additional metadata
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False
        
        try:
            table = self._get_table("agent_interactions")
            if not table:
                return False
            
            rows = [{
                "interaction_id": str(uuid4()),
                "session_id": session_id,
                "timestamp": datetime.utcnow(),
                "source_agent": source_agent,
                "target_agent": target_agent,
                "interaction_type": interaction_type,
                "content": content,
                "processing_time_ms": processing_time_ms,
                "success": success,
                "error_message": error_message,
                "metadata": metadata or {}
            }]
            
            errors = self.client.insert_rows_json(table, rows)
            if errors:
                logger.error(f"Failed to insert agent interaction: {errors}")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Error logging agent interaction: {e}")
            return False
    
    def log_evaluation_score(
        self,
        response_id: str,
        session_id: str,
        overall_score: float,
        evaluator_agent: str,
        clarity_score: Optional[float] = None,
        relevance_score: Optional[float] = None,
        depth_score: Optional[float] = None,
        structure_score: Optional[float] = None,
        strengths: Optional[List[str]] = None,
        improvements: Optional[List[str]] = None,
        feedback_text: Optional[str] = None
    ) -> bool:
        """Log an evaluation score.
        
        Args:
            response_id: ID of the response being evaluated
            session_id: Interview session ID
            overall_score: Overall score (0-100)
            evaluator_agent: Name of the evaluating agent
            clarity_score: Clarity score (0-100)
            relevance_score: Relevance score (0-100)
            depth_score: Depth score (0-100)
            structure_score: Structure score (0-100)
            strengths: List of identified strengths
            improvements: List of areas for improvement
            feedback_text: Detailed feedback text
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False
        
        try:
            table = self._get_table("evaluation_scores")
            if not table:
                return False
            
            rows = [{
                "evaluation_id": str(uuid4()),
                "response_id": response_id,
                "session_id": session_id,
                "evaluated_at": datetime.utcnow(),
                "overall_score": overall_score,
                "clarity_score": clarity_score,
                "relevance_score": relevance_score,
                "depth_score": depth_score,
                "structure_score": structure_score,
                "strengths": strengths or [],
                "improvements": improvements or [],
                "feedback_text": feedback_text,
                "evaluator_agent": evaluator_agent
            }]
            
            errors = self.client.insert_rows_json(table, rows)
            if errors:
                logger.error(f"Failed to insert evaluation score: {errors}")
                return False
                
            logger.info(f"Logged evaluation score for response {response_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging evaluation score: {e}")
            return False
    
    def log_session_summary(
        self,
        session_id: str,
        overall_performance: str,
        key_strengths: List[str],
        areas_for_improvement: List[str],
        recommended_actions: List[str],
        summary_text: str,
        generated_by: str,
        confidence_score: Optional[float] = None
    ) -> bool:
        """Log a session summary.
        
        Args:
            session_id: Interview session ID
            overall_performance: Overall performance assessment
            key_strengths: List of key strengths
            areas_for_improvement: List of improvement areas
            recommended_actions: List of recommended actions
            summary_text: Full summary text
            generated_by: Agent that generated the summary
            confidence_score: Confidence in the assessment (0-100)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False
        
        try:
            table = self._get_table("session_summaries")
            if not table:
                return False
            
            rows = [{
                "session_id": session_id,
                "generated_at": datetime.utcnow(),
                "overall_performance": overall_performance,
                "key_strengths": key_strengths,
                "areas_for_improvement": areas_for_improvement,
                "recommended_actions": recommended_actions,
                "summary_text": summary_text,
                "confidence_score": confidence_score,
                "generated_by": generated_by
            }]
            
            errors = self.client.insert_rows_json(table, rows)
            if errors:
                logger.error(f"Failed to insert session summary: {errors}")
                return False
                
            logger.info(f"Logged session summary for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging session summary: {e}")
            return False
    
    def update_session_status(
        self,
        session_id: str,
        status: str,
        ended_at: Optional[datetime] = None,
        duration_seconds: Optional[int] = None,
        question_count: Optional[int] = None,
        completion_rate: Optional[float] = None
    ) -> bool:
        """Update session status (by inserting a new row).
        
        Args:
            session_id: Interview session ID
            status: New status (active, completed, abandoned)
            ended_at: End timestamp
            duration_seconds: Total duration in seconds
            question_count: Number of questions asked
            completion_rate: Percentage of questions completed
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False
        
        try:
            table = self._get_table("interview_sessions")
            if not table:
                return False
            
            rows = [{
                "session_id": session_id,
                "user_id": None,  # Will be filled by view/query
                "started_at": datetime.utcnow(),  # Required field
                "ended_at": ended_at,
                "status": status,
                "interview_type": None,  # Will be filled by view/query
                "duration_seconds": duration_seconds,
                "question_count": question_count,
                "completion_rate": completion_rate,
                "metadata": {"update_type": "status_update"}
            }]
            
            errors = self.client.insert_rows_json(table, rows)
            if errors:
                logger.error(f"Failed to update session status: {errors}")
                return False
                
            logger.info(f"Updated session status for {session_id} to {status}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating session status: {e}")
            return False


# Global analytics client instance
_analytics_client = None


def get_analytics_client() -> Optional[AnalyticsClient]:
    """Get or create the global analytics client instance."""
    global _analytics_client
    
    if _analytics_client is None:
        project_id = os.getenv("GCP_PROJECT_ID")
        environment = os.getenv("ENVIRONMENT", "dev")
        
        if project_id:
            try:
                _analytics_client = AnalyticsClient(project_id, environment)
            except Exception as e:
                logger.error(f"Failed to create analytics client: {e}")
                return None
        else:
            logger.warning("GCP_PROJECT_ID not set, analytics disabled")
            return None
    
    return _analytics_client