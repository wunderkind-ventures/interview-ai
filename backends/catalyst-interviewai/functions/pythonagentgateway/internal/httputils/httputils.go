package httputils

import (
	"encoding/json"
	"log"
	"net/http"
)

// SetCORSHeaders sets CORS headers for cross-origin requests
func SetCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours
}

// ErrorJSON sends an error response in JSON format
func ErrorJSON(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	errorResponse := map[string]interface{}{
		"error":   message,
		"code":    statusCode,
		"success": false,
	}

	if err := json.NewEncoder(w).Encode(errorResponse); err != nil {
		log.Printf("Failed to encode error response: %v", err)
	}
}

// ResponseJSON sends a successful response in JSON format
func ResponseJSON(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Failed to encode response: %v", err)
		ErrorJSON(w, "Internal server error", http.StatusInternalServerError)
	}
}

// SuccessJSON sends a standardized success response
func SuccessJSON(w http.ResponseWriter, message string, data interface{}) {
	response := map[string]interface{}{
		"success": true,
		"message": message,
		"data":    data,
	}
	ResponseJSON(w, response, http.StatusOK)
}

// CreatedJSON sends a standardized created response
func CreatedJSON(w http.ResponseWriter, message string, data interface{}) {
	response := map[string]interface{}{
		"success": true,
		"message": message,
		"data":    data,
	}
	ResponseJSON(w, response, http.StatusCreated)
}

// ParseJSONBody parses JSON request body into the provided interface
func ParseJSONBody(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// ValidateRequiredFields checks if required fields are present in a map
func ValidateRequiredFields(data map[string]interface{}, fields []string) []string {
	var missing []string
	
	for _, field := range fields {
		if value, exists := data[field]; !exists || value == nil || value == "" {
			missing = append(missing, field)
		}
	}
	
	return missing
}