package httputils

// HTTP utility helpers for GCF

import (
	"encoding/json"
	"net/http"
)

// SetCORSHeaders sets permissive CORS headers. Adjust origins for production.
func SetCORSHeaders(w http.ResponseWriter, r *http.Request) {
	// Get the origin from the request
	origin := r.Header.Get("Origin")
	
	// In development, allow localhost origins
	// In production, you should restrict this to your actual domain
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://localhost:9002", 
		"https://interview-ai.ngrok.app",
		// Add your production domain here
	}
	
	// Check if the origin is allowed
	allowed := false
	for _, allowedOrigin := range allowedOrigins {
		if origin == allowedOrigin {
			allowed = true
			break
		}
	}
	
	// If no origin or not in allowed list, allow all for now (adjust for production)
	if origin == "" || !allowed {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
	
	// Only set credentials to true if not using wildcard origin
	if origin != "" && allowed {
		w.Header().Set("Access-Control-Allow-Credentials", "true")
	}
}

// ErrorJSON writes a JSON error response.
func ErrorJSON(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// RespondJSON writes a JSON success response.
func RespondJSON(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}
