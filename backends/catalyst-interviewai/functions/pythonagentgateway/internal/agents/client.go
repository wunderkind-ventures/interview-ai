package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AgentClient handles communication with Python ADK agents
type AgentClient struct {
	baseURL    string
	httpClient *http.Client
	timeout    time.Duration
}

// AgentRequest represents a request to the Python agents
type AgentRequest struct {
	Type      string                 `json:"type"`
	SessionID string                 `json:"session_id,omitempty"`
	UserID    string                 `json:"user_id"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// AgentResponse represents a response from Python agents
type AgentResponse struct {
	Success   bool                   `json:"success"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Error     string                 `json:"error,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

// HealthStatus represents the health status of agents
type HealthStatus struct {
	Status        string                    `json:"status"`
	Timestamp     string                    `json:"timestamp"`
	Agents        map[string]AgentStatus    `json:"agents"`
	Infrastructure map[string]interface{}   `json:"infrastructure"`
}

// AgentStatus represents individual agent status
type AgentStatus struct {
	Name               string `json:"name"`
	Status             string `json:"status"`
	LastActivity       string `json:"lastActivity"`
	UptimeSeconds      int64  `json:"uptimeSeconds"`
	MessageQueueSize   int    `json:"messageQueueSize"`
	CircuitBreakerHealth map[string]interface{} `json:"circuitBreakerHealth"`
}

// NewAgentClient creates a new client for Python agents
func NewAgentClient(baseURL string, timeout time.Duration) *AgentClient {
	if timeout == 0 {
		timeout = 90 * time.Second // Default timeout for agent operations
	}

	return &AgentClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		timeout: timeout,
	}
}

// StartInterview starts a new interview session
func (c *AgentClient) StartInterview(ctx context.Context, userID string, request map[string]interface{}) (*AgentResponse, error) {
	agentReq := AgentRequest{
		Type:   "start_interview",
		UserID: userID,
		Data:   request,
	}

	return c.makeRequest(ctx, "POST", "/interview/start", agentReq)
}

// SubmitResponse submits a user response to the interview
func (c *AgentClient) SubmitResponse(ctx context.Context, sessionID, userID string, response map[string]interface{}) (*AgentResponse, error) {
	agentReq := AgentRequest{
		Type:      "user_response",
		SessionID: sessionID,
		UserID:    userID,
		Data:      response,
	}

	return c.makeRequest(ctx, "POST", fmt.Sprintf("/interview/%s/respond", sessionID), agentReq)
}

// GetSessionStatus gets the current status of an interview session
func (c *AgentClient) GetSessionStatus(ctx context.Context, sessionID, userID string) (*AgentResponse, error) {
	agentReq := AgentRequest{
		Type:      "get_status",
		SessionID: sessionID,
		UserID:    userID,
	}

	return c.makeRequest(ctx, "GET", fmt.Sprintf("/interview/%s/status", sessionID), agentReq)
}

// EndInterview ends an interview session
func (c *AgentClient) EndInterview(ctx context.Context, sessionID, userID string) (*AgentResponse, error) {
	agentReq := AgentRequest{
		Type:      "end_interview",
		SessionID: sessionID,
		UserID:    userID,
	}

	return c.makeRequest(ctx, "POST", fmt.Sprintf("/interview/%s/end", sessionID), agentReq)
}

// GetReport retrieves the interview report
func (c *AgentClient) GetReport(ctx context.Context, sessionID, userID, format string) (*AgentResponse, error) {
	endpoint := fmt.Sprintf("/report/%s", sessionID)
	if format != "" {
		endpoint += "?format=" + format
	}

	agentReq := AgentRequest{
		Type:      "get_report",
		SessionID: sessionID,
		UserID:    userID,
	}

	return c.makeRequest(ctx, "GET", endpoint, agentReq)
}

// GetHealth checks the health of the Python agent infrastructure
func (c *AgentClient) GetHealth(ctx context.Context) (*HealthStatus, error) {
	resp, err := c.makeRequest(ctx, "GET", "/health", nil)
	if err != nil {
		return nil, err
	}

	// Convert response to HealthStatus
	healthData, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal health data: %w", err)
	}

	var health HealthStatus
	if err := json.Unmarshal(healthData, &health); err != nil {
		return nil, fmt.Errorf("failed to unmarshal health status: %w", err)
	}

	return &health, nil
}

// makeRequest makes an HTTP request to the Python agent service
func (c *AgentClient) makeRequest(ctx context.Context, method, endpoint string, body interface{}) (*AgentResponse, error) {
	// Construct URL
	url := c.baseURL + endpoint

	// Prepare request body
	var requestBody io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		requestBody = bytes.NewBuffer(bodyBytes)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, url, requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Request-Source", "go-gateway")

	// Make request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var agentResp AgentResponse
	if err := json.Unmarshal(responseBody, &agentResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for HTTP errors
	if resp.StatusCode >= 400 {
		return &agentResp, fmt.Errorf("agent returned error %d: %s", resp.StatusCode, agentResp.Error)
	}

	return &agentResp, nil
}

// SetUserContext adds user context headers to requests
func (c *AgentClient) SetUserContext(req *http.Request, userID string) {
	req.Header.Set("X-User-ID", userID)
	req.Header.Set("X-Request-Source", "go-gateway")
}

// IsHealthy checks if the agent service is healthy
func (c *AgentClient) IsHealthy(ctx context.Context) bool {
	health, err := c.GetHealth(ctx)
	if err != nil {
		return false
	}
	return health.Status == "healthy"
}

// WaitForReady waits for the agent service to be ready
func (c *AgentClient) WaitForReady(ctx context.Context, maxWait time.Duration) error {
	deadline := time.Now().Add(maxWait)
	
	for time.Now().Before(deadline) {
		if c.IsHealthy(ctx) {
			return nil
		}
		
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
			// Continue checking
		}
	}
	
	return fmt.Errorf("agent service not ready after %v", maxWait)
}