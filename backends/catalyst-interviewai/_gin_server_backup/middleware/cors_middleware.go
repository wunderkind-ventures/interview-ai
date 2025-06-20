package middleware

// Placeholder for CORS middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware sets up and returns a CORS middleware.
// For development, it's often permissive. For production, tighten origins.
func CORSMiddleware() gin.HandlerFunc {
	return cors.New(cors.Config{
		// AllowOrigins:  []string{"http://localhost:3000", "https://your-production-frontend.com"},
		AllowAllOrigins:  true, // For development, can be true. For prod, specify origins.
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}
