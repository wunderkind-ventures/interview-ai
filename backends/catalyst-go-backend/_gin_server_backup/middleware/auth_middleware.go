package middleware

// Placeholder for authentication middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
)

// FirebaseContextKey is the key used to store the Firebase user token in the Gin context.
const FirebaseContextKey = "firebaseUser"

// FirebaseAuth is a middleware that verifies Firebase ID tokens.
func FirebaseAuth(app *firebase.App, gcpProjectID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if app == nil {
			log.Println("Firebase app not initialized, skipping auth middleware.")
			c.Next()
			return
		}

		client, err := app.Auth(context.Background())
		if err != nil {
			log.Printf("Error getting Firebase Auth client: %v\n", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Firebase auth client error"})
			return
		}

		authHeader := c.Request.Header.Get("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		// Expecting "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format"})
			return
		}
		idToken := parts[1]

		token, err := client.VerifyIDToken(context.Background(), idToken)
		if err != nil {
			log.Printf("Error verifying Firebase ID token: %v\n", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Firebase ID token"})
			return
		}

		// You can optionally check token claims like issuer, audience, etc.
		// Example: Check if the token is issued for your project
		// expectedAudience := gcpProjectID // Or your Firebase project ID if different
		// if token.Audience != expectedAudience {
		// 	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token audience mismatch"})
		// 	return
		// }

		// Set the token in the context for handlers to access user info
		c.Set(FirebaseContextKey, token)
		c.Next()
	}
}

// GetFirebaseUser retrieves the Firebase user token from the Gin context.
// It's a helper function for handlers.
func GetFirebaseUser(c *gin.Context) *auth.Token {
	user, exists := c.Get(FirebaseContextKey)
	if !exists {
		return nil
	}
	return user.(*auth.Token)
}
