package auth

// Firebase authentication helpers for GCF

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

// VerifyToken extracts and verifies a Firebase ID token from an HTTP request.
// It requires the Firebase App instance to be initialized and passed.
func VerifyToken(r *http.Request, app *firebase.App) (*auth.Token, error) {
	if app == nil {
		return nil, fmt.Errorf("Firebase app not initialized")
	}

	client, err := app.Auth(context.Background())
	if err != nil {
		return nil, fmt.Errorf("error getting Firebase Auth client: %w", err)
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("authorization header required")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, fmt.Errorf("invalid Authorization header format")
	}
	idToken := parts[1]

	token, err := client.VerifyIDToken(context.Background(), idToken)
	if err != nil {
		return nil, fmt.Errorf("invalid Firebase ID token: %w", err)
	}

	// Optional: Add audience/issuer checks if needed, using gcpProjectID from env
	// gcpProjectID := os.Getenv("GCP_PROJECT_ID")
	// if token.Audience != gcpProjectID { ... }

	return token, nil
}