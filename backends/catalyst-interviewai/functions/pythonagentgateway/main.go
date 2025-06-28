package pythonagentgateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"interviewai.wkv.local/pythonagentgateway/internal/auth"
	"interviewai.wkv.local/pythonagentgateway/internal/config"
	"interviewai.wkv.local/pythonagentgateway/internal/httputils"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

var (
	firebaseAppSingleton  *firebase.App
	secretClientSingleton *secretmanager.Client
	serviceConfig         *config.ServiceConfig
)

func init() {
	ctx := context.Background()
	
	// Load service configuration
	serviceConfig = config.LoadServiceConfig()
	serviceConfig.LogConfiguration()
	
	// Validate required configuration
	if serviceConfig.GCPProjectID == "" && !serviceConfig.UseLocalService {
		log.Fatal("GCP_PROJECT_ID environment variable not set and not using local service.")
	}

	// Initialize Firebase
	saKeyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
	var err error
	var firebaseOpt option.ClientOption
	if saKeyPath != "" {
		firebaseOpt = option.WithCredentialsFile(saKeyPath)
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil, firebaseOpt)
	} else {
		firebaseAppSingleton, err = firebase.NewApp(ctx, nil)
	}
	if err != nil {
		log.Fatalf("firebase.NewApp in init: %v", err)
	}

	// Initialize Secret Manager
	secretClientSingleton, err = secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("secretmanager.NewClient in init: %v", err)
	}
	
	log.Println("PythonAgentGateway: Firebase App and Secret Manager Client initialized.")
}

// StartInterviewGCF handles POST /api/agents/interview/start
func StartInterviewGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}

	userID := authedUser.UID
	log.Printf("StartInterview: User %s starting interview", userID)

	// Parse request body
	var requestBody map[string]interface{}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		httputils.ErrorJSON(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(bodyBytes, &requestBody); err != nil {
		httputils.ErrorJSON(w, "Invalid JSON in request body", http.StatusBadRequest)
		return
	}

	// Add user context to request
	requestBody["user_id"] = userID
	requestBody["type"] = "start_interview"

	// Forward to Python agent service
	response, err := forwardToPythonAgents("POST", "/interview/start", requestBody, userID)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to start interview: %v", err), http.StatusInternalServerError)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// InterviewResponseGCF handles POST /api/agents/interview/{sessionId}/respond
func InterviewResponseGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}

	userID := authedUser.UID
	
	// Extract session ID from path
	sessionID := extractSessionIDFromPath(r.URL.Path)
	if sessionID == "" {
		httputils.ErrorJSON(w, "Session ID not found in path", http.StatusBadRequest)
		return
	}

	log.Printf("InterviewResponse: User %s, Session %s", userID, sessionID)

	// Parse request body
	var requestBody map[string]interface{}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		httputils.ErrorJSON(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(bodyBytes, &requestBody); err != nil {
		httputils.ErrorJSON(w, "Invalid JSON in request body", http.StatusBadRequest)
		return
	}

	// Add context to request
	requestBody["session_id"] = sessionID
	requestBody["user_id"] = userID
	requestBody["type"] = "user_response"

	// Forward to Python agent service
	response, err := forwardToPythonAgents("POST", fmt.Sprintf("/interview/%s/respond", sessionID), requestBody, userID)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to process response: %v", err), http.StatusInternalServerError)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// InterviewStatusGCF handles GET /api/agents/interview/{sessionId}/status
func InterviewStatusGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}

	userID := authedUser.UID
	
	// Extract session ID from path
	sessionID := extractSessionIDFromPath(r.URL.Path)
	if sessionID == "" {
		httputils.ErrorJSON(w, "Session ID not found in path", http.StatusBadRequest)
		return
	}

	log.Printf("InterviewStatus: User %s, Session %s", userID, sessionID)

	// Forward to Python agent service
	response, err := forwardToPythonAgents("GET", fmt.Sprintf("/interview/%s/status", sessionID), nil, userID)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to get status: %v", err), http.StatusInternalServerError)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// EndInterviewGCF handles POST /api/agents/interview/{sessionId}/end
func EndInterviewGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		httputils.ErrorJSON(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}

	userID := authedUser.UID
	
	// Extract session ID from path
	sessionID := extractSessionIDFromPath(r.URL.Path)
	if sessionID == "" {
		httputils.ErrorJSON(w, "Session ID not found in path", http.StatusBadRequest)
		return
	}

	log.Printf("EndInterview: User %s, Session %s", userID, sessionID)

	requestBody := map[string]interface{}{
		"session_id": sessionID,
		"user_id":    userID,
		"type":       "end_interview",
	}

	// Forward to Python agent service
	response, err := forwardToPythonAgents("POST", fmt.Sprintf("/interview/%s/end", sessionID), requestBody, userID)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to end interview: %v", err), http.StatusInternalServerError)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// GetReportGCF handles GET /api/agents/report/{sessionId}
func GetReportGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}

	authedUser, err := auth.VerifyToken(r, firebaseAppSingleton)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
		return
	}

	userID := authedUser.UID
	
	// Extract session ID from path
	sessionID := extractSessionIDFromPath(r.URL.Path)
	if sessionID == "" {
		httputils.ErrorJSON(w, "Session ID not found in path", http.StatusBadRequest)
		return
	}

	log.Printf("GetReport: User %s, Session %s", userID, sessionID)

	// Get report format from query params
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	// Forward to Python agent service
	response, err := forwardToPythonAgents("GET", fmt.Sprintf("/report/%s?format=%s", sessionID, format), nil, userID)
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to get report: %v", err), http.StatusInternalServerError)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// AgentHealthGCF handles GET /api/agents/health
func AgentHealthGCF(w http.ResponseWriter, r *http.Request) {
	httputils.SetCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		httputils.ErrorJSON(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}

	// Health endpoint might not require auth for monitoring purposes
	log.Printf("AgentHealth: Health check requested")

	// Forward to Python agent service
	response, err := forwardToPythonAgents("GET", "/health", nil, "system")
	if err != nil {
		httputils.ErrorJSON(w, fmt.Sprintf("Failed to get health status: %v", err), http.StatusServiceUnavailable)
		return
	}

	httputils.ResponseJSON(w, response, http.StatusOK)
}

// Helper functions

func extractSessionIDFromPath(path string) string {
	// Extract session ID from paths like:
	// /api/agents/interview/{sessionId}/respond
	// /api/agents/interview/{sessionId}/status
	// /api/agents/interview/{sessionId}/end
	// /api/agents/report/{sessionId}
	
	parts := strings.Split(strings.Trim(path, "/"), "/")
	
	// Look for common patterns
	for i, part := range parts {
		if (part == "interview" || part == "report") && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	
	return ""
}

func forwardToPythonAgents(method, endpoint string, body interface{}, userID string) (map[string]interface{}, error) {
	// Construct target URL using service configuration
	targetURL := fmt.Sprintf("%s%s", serviceConfig.PythonAgentBaseURL, endpoint)
	
	var requestBody io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		requestBody = bytes.NewBuffer(bodyBytes)
	}

	// Create HTTP request
	req, err := http.NewRequest(method, targetURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", userID)
	req.Header.Set("X-Request-Source", "go-gateway")

	// Create HTTP client with timeout (adjust based on local vs cloud)
	timeout := 90 * time.Second
	if serviceConfig.UseLocalService {
		timeout = 30 * time.Second // Faster timeout for local development
	}
	
	client := &http.Client{
		Timeout: timeout,
	}

	// Execute request
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response JSON
	var responseJSON map[string]interface{}
	if err := json.Unmarshal(responseBody, &responseJSON); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %w", err)
	}

	// Check for non-2xx status codes
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Python agent returned error %d: %v", resp.StatusCode, responseJSON)
	}

	log.Printf("Successfully forwarded %s %s for user %s", method, endpoint, userID)
	return responseJSON, nil
}

