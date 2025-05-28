package handlers

// Placeholder for AI invocation handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"interview-ai/byot-go-backend/middleware"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"github.com/gin-gonic/gin"
)

// ProxyToGenkitFlow handles requests by forwarding them to the appropriate Genkit flow
// in the Next.js application, using a user-specific API key if available.
func ProxyToGenkitFlow(secretClient *secretmanager.Client, gcpProjectID string, nextjsBaseURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		firebaseUser := middleware.GetFirebaseUser(c)
		if firebaseUser == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}
		userID := firebaseUser.UID
		flowName := c.Param("flowName") // e.g., "customizeInterviewQuestions", "generateInterviewFeedback"

		if flowName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Flow name parameter is required"})
			return
		}

		// Try to get user's API key
		userAPIKey, err := GetUserAPIKey(c.Request.Context(), secretClient, gcpProjectID, userID)
		apiKeyToUse := ""
		apiKeySource := ""

		if err == nil && userAPIKey != "" {
			apiKeyToUse = userAPIKey
			apiKeySource = "user"
			log.Printf("Using API key from Secret Manager for user %s for flow %s", userID, flowName)
		} else {
			log.Printf("No user-specific API key found for user %s (or error retrieving: %v). Falling back to default.", userID, err)
			// Fallback to default API key from environment variable
			defaultKey := os.Getenv("DEFAULT_GEMINI_API_KEY")
			if defaultKey == "" {
				log.Printf("DEFAULT_GEMINI_API_KEY not set. Cannot proceed with flow %s for user %s.", flowName, userID)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service not configured (no default key)"})
				return
			}
			apiKeyToUse = defaultKey
			apiKeySource = "default"
			log.Printf("Using default API key for user %s for flow %s", userID, flowName)
		}

		// Read the original request body to forward it
		var requestBodyBytes []byte
		if c.Request.Body != nil {
			requestBodyBytes, err = io.ReadAll(c.Request.Body)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read request body"})
				return
			}
			// Restore the request body so it can be read again if needed by other middleware (though not typical for proxy)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBodyBytes))
		}

		// Construct the target URL for the Genkit flow in the Next.js app
		// Assuming Next.js server actions for Genkit are exposed at a path like /api/genkit-proxy/[flowName]
		// or that Genkit flows are directly callable via HTTP if configured that way.
		// For now, let's assume your Next.js app has an endpoint that can take the flow name and data.
		// The structure of this URL depends on how your Next.js Genkit flows are exposed.
		// A common pattern for server actions is that they are called via POST to a route path.
		// If `genkit start` exposes flows at `http://localhost:3500/flows/[flowName]`, then the target is that.
		// But `PROJECT_CONTEXT.md` says: "Genkit flows (...) are invoked as Next.js server actions"
		// This implies the Next.js app itself hosts these. We need a way for Go to call these Next.js server actions.
		// One way: Next.js exposes a generic proxy endpoint that this Go service calls.
		// e.g., POST to `nextjsBaseURL + /api/internal-genkit-proxy`
		// The body would be { flowName: "actualFlowName", originalBody: ..., apiKey: ... }
		// Let's simplify and assume the Next.js app has an endpoint like: `POST /api/execute-flow/[flowName]`
		targetURL := fmt.Sprintf("%s/api/execute-flow/%s", nextjsBaseURL, flowName)

		// Create a new request to the Next.js/Genkit endpoint
		proxyReq, err := http.NewRequestWithContext(c.Request.Context(), "POST", targetURL, bytes.NewBuffer(requestBodyBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proxy request"})
			return
		}

		// Copy headers from original request (optional, but can be useful)
		// proxyReq.Header = c.Request.Header.Clone()
		// For simplicity, only set Content-Type and our special API key header.
		proxyReq.Header.Set("Content-Type", "application/json") // Assuming Genkit flows expect JSON
		proxyReq.Header.Set("X-Internal-API-Key", apiKeyToUse)  // Send the chosen API key
		proxyReq.Header.Set("X-API-Key-Source", apiKeySource)   // For debugging/logging in Next.js

		// Send the request
		httpClient := &http.Client{Timeout: 60 * time.Second} // Customizable timeout
		resp, err := httpClient.Do(proxyReq)
		if err != nil {
			log.Printf("Error proxying request to %s for flow %s, user %s: %v", targetURL, flowName, userID, err)
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Failed to call AI service"})
			return
		}
		defer resp.Body.Close()

		// Read the response from the Genkit flow
		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read AI service response"})
			return
		}

		// Forward the status code and response body from the Genkit flow
		// We need to be careful if the response from Genkit isn't JSON.
		// For now, assume it is or can be passed through.
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
		log.Printf("Successfully proxied flow %s for user %s. Downstream status: %d", flowName, userID, resp.StatusCode)
	}
}
