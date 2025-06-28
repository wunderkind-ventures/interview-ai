package config

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// ServiceConfig holds configuration for the Python agent service connection
type ServiceConfig struct {
	PythonAgentBaseURL string
	Environment        string
	GCPProjectID       string
	UseLocalService    bool
}

// LoadServiceConfig loads configuration from environment variables
func LoadServiceConfig() *ServiceConfig {
	config := &ServiceConfig{
		Environment:  getEnvWithDefault("ENVIRONMENT", "development"),
		GCPProjectID: os.Getenv("GCP_PROJECT_ID"),
	}

	// Determine Python agent service URL
	config.PythonAgentBaseURL = determinePythonAgentURL()
	config.UseLocalService = isLocalService(config.PythonAgentBaseURL)

	return config
}

// determinePythonAgentURL determines the Python agent service URL based on environment
func determinePythonAgentURL() string {
	// Priority order for determining service URL:
	// 1. Explicit PYTHON_AGENT_BASE_URL
	// 2. PYTHON_AGENT_SERVICE_URL (Pulumi output style)
	// 3. Environment-specific patterns
	// 4. Local development default

	// Check explicit environment variables
	envVars := []string{
		"PYTHON_AGENT_BASE_URL",
		"PYTHON_AGENT_SERVICE_URL",
		"PYTHON_ADK_AGENT_SERVICE_URL",
		"ADK_AGENT_URL",
	}

	for _, envVar := range envVars {
		if url := os.Getenv(envVar); url != "" {
			log.Printf("Using Python agent URL from %s: %s", envVar, url)
			return strings.TrimSuffix(url, "/")
		}
	}

	// Check for environment-specific patterns
	environment := getEnvWithDefault("ENVIRONMENT", "development")
	projectID := os.Getenv("GCP_PROJECT_ID")

	// Cloud Run service URL pattern
	if projectID != "" {
		// Updated to match the actual deployed service name
		cloudRunURL := fmt.Sprintf("https://python-adk-agents-%s-s5blxcobka-uc.a.run.app", environment)
		
		// Check if this is likely a cloud deployment by looking for other cloud-specific env vars
		if isCloudDeployment() {
			log.Printf("Using inferred Cloud Run URL: %s", cloudRunURL)
			return cloudRunURL
		}
	}

	// Local development default
	localURL := getEnvWithDefault("LOCAL_PYTHON_AGENT_URL", "http://localhost:8080")
	log.Printf("Using local development URL: %s", localURL)
	return localURL
}

// isLocalService determines if the service URL points to a local instance
func isLocalService(url string) bool {
	localPatterns := []string{
		"localhost",
		"127.0.0.1",
		"0.0.0.0",
		"host.docker.internal",
	}

	urlLower := strings.ToLower(url)
	for _, pattern := range localPatterns {
		if strings.Contains(urlLower, pattern) {
			return true
		}
	}
	return false
}

// isCloudDeployment checks if we're running in a cloud environment
func isCloudDeployment() bool {
	cloudIndicators := []string{
		"K_SERVICE",           // Cloud Run
		"FUNCTION_NAME",       // Cloud Functions
		"GAE_APPLICATION",     // App Engine
		"GOOGLE_CLOUD_PROJECT", // General GCP
	}

	for _, indicator := range cloudIndicators {
		if os.Getenv(indicator) != "" {
			return true
		}
	}
	return false
}

// getEnvWithDefault gets an environment variable with a default value
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetLocalDevelopmentConfig returns configuration for local development
func GetLocalDevelopmentConfig() *ServiceConfig {
	return &ServiceConfig{
		PythonAgentBaseURL: "http://localhost:8080",
		Environment:        "development",
		GCPProjectID:       "local-dev",
		UseLocalService:    true,
	}
}

// GetCloudDevelopmentConfig returns configuration for cloud development
func GetCloudDevelopmentConfig(projectID, environment string) *ServiceConfig {
	region := getEnvWithDefault("GCP_REGION", "us-central1")
	cloudRunURL := fmt.Sprintf("https://pythonagents-%s-%s.a.run.app", environment, region)
	
	return &ServiceConfig{
		PythonAgentBaseURL: cloudRunURL,
		Environment:        environment,
		GCPProjectID:       projectID,
		UseLocalService:    false,
	}
}

// LogConfiguration logs the current configuration for debugging
func (sc *ServiceConfig) LogConfiguration() {
	log.Printf("Service Configuration:")
	log.Printf("  Environment: %s", sc.Environment)
	log.Printf("  GCP Project ID: %s", sc.GCPProjectID)
	log.Printf("  Python Agent URL: %s", sc.PythonAgentBaseURL)
	log.Printf("  Using Local Service: %t", sc.UseLocalService)
}