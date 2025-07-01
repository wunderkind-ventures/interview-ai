package bigquery

import (
	"fmt"

	"github.com/pulumi/pulumi-gcp/sdk/v7/go/gcp/bigquery"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type BigQueryAnalyticsArgs struct {
	Project     string
	Environment string
	Region      string
}

type BigQueryAnalytics struct {
	Dataset                     *bigquery.Dataset
	InterviewSessionsTable      *bigquery.Table
	UserResponsesTable          *bigquery.Table
	EvaluationScoresTable       *bigquery.Table
	PromptPerformanceTable      *bigquery.Table
	AgentInteractionsTable      *bigquery.Table
	SessionSummariesTable       *bigquery.Table
}

func NewBigQueryAnalytics(ctx *pulumi.Context, name string, args *BigQueryAnalyticsArgs, opts ...pulumi.ResourceOption) (*BigQueryAnalytics, error) {
	analytics := &BigQueryAnalytics{}

	// Create the dataset
	datasetId := fmt.Sprintf("interview_analytics_%s", args.Environment)
	dataset, err := bigquery.NewDataset(ctx, datasetId, &bigquery.DatasetArgs{
		DatasetId:   pulumi.String(datasetId),
		Project:     pulumi.String(args.Project),
		Location:    pulumi.String(args.Region),
		Description: pulumi.String(fmt.Sprintf("Interview AI analytics dataset for %s environment", args.Environment)),
		Labels: pulumi.StringMap{
			"environment": pulumi.String(args.Environment),
			"managed_by":  pulumi.String("pulumi"),
		},
	}, opts...)
	if err != nil {
		return nil, err
	}
	analytics.Dataset = dataset

	// Create interview_sessions table
	sessionsTable, err := bigquery.NewTable(ctx, "interview_sessions", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("interview_sessions"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "session_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Unique identifier for the interview session"
			},
			{
				"name": "user_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Firebase user ID"
			},
			{
				"name": "started_at",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the interview started"
			},
			{
				"name": "ended_at",
				"type": "TIMESTAMP",
				"mode": "NULLABLE",
				"description": "When the interview ended"
			},
			{
				"name": "status",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Current status: active, completed, abandoned"
			},
			{
				"name": "interview_type",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Type of interview: behavioral, technical, case_study"
			},
			{
				"name": "target_role",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Target role for the interview"
			},
			{
				"name": "company",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Target company"
			},
			{
				"name": "duration_seconds",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Total interview duration in seconds"
			},
			{
				"name": "question_count",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Number of questions asked"
			},
			{
				"name": "completion_rate",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Percentage of questions completed"
			},
			{
				"name": "metadata",
				"type": "JSON",
				"mode": "NULLABLE",
				"description": "Additional session metadata"
			}
		]`),
		TimePartitioning: &bigquery.TableTimePartitioningArgs{
			Type:  pulumi.String("DAY"),
			Field: pulumi.String("started_at"),
		},
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.InterviewSessionsTable = sessionsTable

	// Create user_responses table
	responsesTable, err := bigquery.NewTable(ctx, "user_responses", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("user_responses"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "response_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Unique identifier for the response"
			},
			{
				"name": "session_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Reference to interview session"
			},
			{
				"name": "user_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Firebase user ID"
			},
			{
				"name": "question_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Question identifier"
			},
			{
				"name": "question_text",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "The question asked"
			},
			{
				"name": "response_text",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "User's response"
			},
			{
				"name": "response_timestamp",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the response was submitted"
			},
			{
				"name": "response_time_seconds",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Time taken to respond in seconds"
			},
			{
				"name": "word_count",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Number of words in response"
			},
			{
				"name": "is_final_answer",
				"type": "BOOLEAN",
				"mode": "REQUIRED",
				"description": "Whether this is the final answer or a revision"
			},
			{
				"name": "revision_count",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Number of times the answer was revised"
			}
		]`),
		TimePartitioning: &bigquery.TableTimePartitioningArgs{
			Type:  pulumi.String("DAY"),
			Field: pulumi.String("response_timestamp"),
		},
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.UserResponsesTable = responsesTable

	// Create evaluation_scores table
	scoresTable, err := bigquery.NewTable(ctx, "evaluation_scores", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("evaluation_scores"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "evaluation_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Unique identifier for the evaluation"
			},
			{
				"name": "response_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Reference to user response"
			},
			{
				"name": "session_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Reference to interview session"
			},
			{
				"name": "evaluated_at",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the evaluation was performed"
			},
			{
				"name": "overall_score",
				"type": "FLOAT",
				"mode": "REQUIRED",
				"description": "Overall score (0-100)"
			},
			{
				"name": "clarity_score",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Clarity of response (0-100)"
			},
			{
				"name": "relevance_score",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Relevance to question (0-100)"
			},
			{
				"name": "depth_score",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Depth of answer (0-100)"
			},
			{
				"name": "structure_score",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Structure quality (0-100)"
			},
			{
				"name": "strengths",
				"type": "STRING",
				"mode": "REPEATED",
				"description": "Identified strengths"
			},
			{
				"name": "improvements",
				"type": "STRING",
				"mode": "REPEATED",
				"description": "Areas for improvement"
			},
			{
				"name": "feedback_text",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Detailed feedback"
			},
			{
				"name": "evaluator_agent",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Which agent performed the evaluation"
			}
		]`),
		TimePartitioning: &bigquery.TableTimePartitioningArgs{
			Type:  pulumi.String("DAY"),
			Field: pulumi.String("evaluated_at"),
		},
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.EvaluationScoresTable = scoresTable

	// Create prompt_performance table
	promptTable, err := bigquery.NewTable(ctx, "prompt_performance", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("prompt_performance"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "prompt_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Unique identifier for the prompt version"
			},
			{
				"name": "prompt_type",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Type of prompt: question_generation, evaluation, feedback"
			},
			{
				"name": "prompt_version",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Version identifier"
			},
			{
				"name": "created_at",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the prompt was created"
			},
			{
				"name": "usage_count",
				"type": "INTEGER",
				"mode": "REQUIRED",
				"description": "Number of times used"
			},
			{
				"name": "average_user_satisfaction",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Average user satisfaction rating (1-5)"
			},
			{
				"name": "average_completion_rate",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Average completion rate when using this prompt"
			},
			{
				"name": "average_response_quality",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Average quality of responses generated"
			},
			{
				"name": "error_rate",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Rate of errors or failures"
			},
			{
				"name": "is_active",
				"type": "BOOLEAN",
				"mode": "REQUIRED",
				"description": "Whether this prompt is currently active"
			},
			{
				"name": "parent_prompt_id",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "ID of parent prompt if this is a mutation"
			},
			{
				"name": "prompt_text",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "The actual prompt text"
			},
			{
				"name": "metadata",
				"type": "JSON",
				"mode": "NULLABLE",
				"description": "Additional metadata about the prompt"
			}
		]`),
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.PromptPerformanceTable = promptTable

	// Create agent_interactions table
	agentTable, err := bigquery.NewTable(ctx, "agent_interactions", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("agent_interactions"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "interaction_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Unique identifier for the interaction"
			},
			{
				"name": "session_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Reference to interview session"
			},
			{
				"name": "timestamp",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the interaction occurred"
			},
			{
				"name": "source_agent",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Agent that initiated the interaction"
			},
			{
				"name": "target_agent",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Agent that received the message"
			},
			{
				"name": "interaction_type",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Type: message, request, response, error"
			},
			{
				"name": "content",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Content of the interaction"
			},
			{
				"name": "processing_time_ms",
				"type": "INTEGER",
				"mode": "NULLABLE",
				"description": "Time to process in milliseconds"
			},
			{
				"name": "success",
				"type": "BOOLEAN",
				"mode": "REQUIRED",
				"description": "Whether the interaction was successful"
			},
			{
				"name": "error_message",
				"type": "STRING",
				"mode": "NULLABLE",
				"description": "Error message if failed"
			},
			{
				"name": "metadata",
				"type": "JSON",
				"mode": "NULLABLE",
				"description": "Additional interaction metadata"
			}
		]`),
		TimePartitioning: &bigquery.TableTimePartitioningArgs{
			Type:  pulumi.String("DAY"),
			Field: pulumi.String("timestamp"),
		},
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.AgentInteractionsTable = agentTable

	// Create session_summaries table
	summariesTable, err := bigquery.NewTable(ctx, "session_summaries", &bigquery.TableArgs{
		DatasetId: dataset.DatasetId,
		TableId:   pulumi.String("session_summaries"),
		Project:   pulumi.String(args.Project),
		Schema: pulumi.String(`[
			{
				"name": "session_id",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Reference to interview session"
			},
			{
				"name": "generated_at",
				"type": "TIMESTAMP",
				"mode": "REQUIRED",
				"description": "When the summary was generated"
			},
			{
				"name": "overall_performance",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Overall performance assessment"
			},
			{
				"name": "key_strengths",
				"type": "STRING",
				"mode": "REPEATED",
				"description": "Key strengths identified"
			},
			{
				"name": "areas_for_improvement",
				"type": "STRING",
				"mode": "REPEATED",
				"description": "Areas needing improvement"
			},
			{
				"name": "recommended_actions",
				"type": "STRING",
				"mode": "REPEATED",
				"description": "Recommended next steps"
			},
			{
				"name": "summary_text",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Full summary text"
			},
			{
				"name": "confidence_score",
				"type": "FLOAT",
				"mode": "NULLABLE",
				"description": "Confidence in the assessment (0-100)"
			},
			{
				"name": "generated_by",
				"type": "STRING",
				"mode": "REQUIRED",
				"description": "Agent that generated the summary"
			}
		]`),
	}, pulumi.Parent(dataset))
	if err != nil {
		return nil, err
	}
	analytics.SessionSummariesTable = summariesTable

	return analytics, nil
}