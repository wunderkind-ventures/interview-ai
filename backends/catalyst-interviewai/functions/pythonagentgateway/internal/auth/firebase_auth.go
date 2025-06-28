package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

// VerifyToken extracts and verifies Firebase ID token from Authorization header
func VerifyToken(r *http.Request, firebaseApp *firebase.App) (*auth.Token, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("authorization header missing")
	}

	// Extract Bearer token
	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(authHeader, bearerPrefix) {
		return nil, fmt.Errorf("authorization header must start with 'Bearer '")
	}

	idToken := strings.TrimPrefix(authHeader, bearerPrefix)
	if idToken == "" {
		return nil, fmt.Errorf("ID token is empty")
	}

	// Get Firebase Auth client
	authClient, err := firebaseApp.Auth(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get Firebase Auth client: %w", err)
	}

	// Verify the ID token
	token, err := authClient.VerifyIDToken(context.Background(), idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify ID token: %w", err)
	}

	return token, nil
}

// GetUserRecord retrieves complete user record from Firebase Auth
func GetUserRecord(firebaseApp *firebase.App, uid string) (*auth.UserRecord, error) {
	authClient, err := firebaseApp.Auth(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get Firebase Auth client: %w", err)
	}

	user, err := authClient.GetUser(context.Background(), uid)
	if err != nil {
		return nil, fmt.Errorf("failed to get user record: %w", err)
	}

	return user, nil
}