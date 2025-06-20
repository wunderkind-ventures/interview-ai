package httputils

// HTTP utility helpers for GCF

import (
	"encoding/json"
	"net/http"
)

// SetCORSHeaders sets permissive CORS headers. Adjust origins for production.
func SetCORSHeaders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // Or specific origins
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
	w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
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
