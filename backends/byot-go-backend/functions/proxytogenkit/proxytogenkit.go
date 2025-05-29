package proxytogenkit

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"interviewai.wkv.local/proxytogenkit/internal/auth"
	"interviewai.wkv.local/proxytogenkit/internal/httputils"
	"interviewai.wkv.local/proxytogenkit/internal/secrets"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

var (
	firebaseAppSingleton  *firebase.App
	secretClientSingleton *secretmanager.Client
	gcpProjectIDEnv       string
	nextjsBaseURLEnv      string
	defaultAPIKeyEnv      string
)

func init() {
	ctx := context.Background()
	gcpProjectIDEnv = os.Getenv("GCP_PROJECT_ID")
	if gcpProjectIDEnv == "" {
		log.Fatal("GCP_PROJECT_ID environment variable not set.")
	}
	nextjsBaseURLEnv = os.Getenv("NEXTJS_BASE_URL")
	if nextjsBaseURLEnv == "" {
		log.Fatal("NEXTJS_BASE_URL environment variable not set.")
	}
	defaultAPIKeyEnv = os.Getenv("DEFAULT_GEMINI_API_KEY") // Can be empty if not all flows require a default
	if defaultAPIKeyEnv == "" {
		log.Println("Warning: DEFAULT_GEMINI_API_KEY environment variable not set. Flows requiring a default key may fail.")
	}

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

	secretClientSingleton, err = secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("secretmanager.NewClient in init: %v", err)
	}
	log.Println("ProxyToGenkit: Firebase App and Secret Manager Client initialized.")
}

// ProxyToGenkitGCF is the HTTP Cloud Function for proxying requests to Genkit flows.
func ProxyToGenkitGCF(w http.ResponseWriter, r *http.Request) {
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

	// Extract flowName from path, e.g., /api/ai/genkit/[flowName]
	// For GCF, the path structure might be different when deployed, e.g., /ProxyToGenkitGCF/[flowName]
	// or the function is triggered by a path pattern that includes it.
	// Assuming the path is `/functionName/flowName` or similar from API Gateway.
	// For simplicity, let's assume flowName is a query parameter or part of the JSON body for now.
	// This needs to be adjusted based on how you configure API Gateway or Function URL trigger.
	// Let's expect flowName in the path like: /api/genkit/{flowName} (relative to function trigger path)
	// For this, you'd typically use an HTTP framework with routing in GCF or parse `r.URL.Path`.
	// To keep it simple for now, we'll take it from a query param: r.URL.Query().Get("flow")
	// However, the Gin version used a path param. Let's try to mimic that by parsing the path.
	// This is a common requirement and often handled by an API Gateway in front of the function.
	// For a direct Function URL, the path available is after the trigger base.
	// If Function URL is https://.../ProxyToGenkitGCF, then path is /
	// If https://.../ProxyToGenkitGCF/myFlow, then path is /myFlow
	// We will assume for now that API Gateway or a similar setup passes the flowName as the last part of the path.

	pathParts := PparsePath(r.URL.Path) // Needs a robust path parsing function
	var flowName string
	if len(pathParts) > 0 {
		flowName = pathParts[len(pathParts)-1]
	}
	if flowName == "" {
		// Fallback: try query parameter if path parsing is tricky without a framework
		flowName = r.URL.Query().Get("flowName")
		if flowName == "" {
			httputils.ErrorJSON(w, "Flow name not provided in path or query parameter", http.StatusBadRequest)
			return
		}
	}

	log.Printf("ProxyToGenkitGCF: User %s, attempting flow %s", userID, flowName)

	userAPIKey, err := secrets.GetUserAPIKey(r.Context(), secretClientSingleton, gcpProjectIDEnv, userID)
	apiKeyToUse := ""
	apiKeySource := ""

	if err == nil && userAPIKey != "" {
		apiKeyToUse = userAPIKey
		apiKeySource = "user"
		log.Printf("ProxyToGenkitGCF: Using API key from Secret Manager for user %s for flow %s", userID, flowName)
	} else {
		log.Printf("ProxyToGenkitGCF: No user-specific API key found for user %s (or error retrieving: %v). Falling back to default.", userID, err)
		if defaultAPIKeyEnv == "" {
			log.Printf("ProxyToGenkitGCF: DEFAULT_GEMINI_API_KEY not set. Cannot proceed with flow %s for user %s.", flowName, userID)
			httputils.ErrorJSON(w, "AI service not configured (no default key)", http.StatusInternalServerError)
			return
		}
		apiKeyToUse = defaultAPIKeyEnv
		apiKeySource = "default"
		log.Printf("ProxyToGenkitGCF: Using default API key for user %s for flow %s", userID, flowName)
	}

	requestBodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		httputils.ErrorJSON(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	// targetURL in Next.js app: e.g., http://localhost:3000/api/execute-flow/[flowName]
	targetURLStr := fmt.Sprintf("%s/api/execute-flow/%s", nextjsBaseURLEnv, url.PathEscape(flowName))

	proxyReq, err := http.NewRequestWithContext(r.Context(), "POST", targetURLStr, bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		httputils.ErrorJSON(w, "Failed to create proxy request", http.StatusInternalServerError)
		return
	}

	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("X-Internal-API-Key", apiKeyToUse)
	proxyReq.Header.Set("X-API-Key-Source", apiKeySource)
	// Potentially forward other relevant headers if needed, e.g., X-Cloud-Trace-Context for tracing
	if traceHeader := r.Header.Get("X-Cloud-Trace-Context"); traceHeader != "" {
		proxyReq.Header.Set("X-Cloud-Trace-Context", traceHeader)
	}

	httpClient := &http.Client{Timeout: 90 * time.Second} // Increased timeout for potentially long AI calls
	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		log.Printf("ProxyToGenkitGCF: Error proxying request to %s for flow %s, user %s: %v", targetURLStr, flowName, userID, err)
		httputils.ErrorJSON(w, "Failed to call AI service backend", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		httputils.ErrorJSON(w, "Failed to read AI service backend response", http.StatusInternalServerError)
		return
	}

	// Forward headers from the downstream response
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode) // Forward the status code
	_, err = w.Write(responseBody) // Forward the raw body
	if err != nil {
		log.Printf("ProxyToGenkitGCF: Error writing response body for flow %s, user %s: %v", flowName, userID, err)
		// Client response already started, can't send new error header
	}

	log.Printf("ProxyToGenkitGCF: Successfully proxied flow %s for user %s. Downstream status: %d", flowName, userID, resp.StatusCode)
}

// PparsePath is a placeholder for a robust path parsing logic if needed without a framework.
// For GCF, how you get path parameters depends on the trigger (HTTP Trigger, API Gateway).
// If using API Gateway with path parameters like /flows/{flowName}, it might come via a different mechanism.
// If using a direct Function URL, r.URL.Path is relative to the function's trigger path.
// Example: if trigger is /ProxyToGenkitGCF, and URL is /ProxyToGenkitGCF/myFlow, r.URL.Path is /myFlow
func PparsePath(path string) []string {
	// Basic parsing, not robust for all cases.
	// Consider using a proper router or relying on API Gateway for param extraction.
	if path == "/" || path == "" {
		return []string{}
	}
	// Trim leading/trailing slashes and split
	return strings.Split(strings.Trim(path, "/"), "/")
}
