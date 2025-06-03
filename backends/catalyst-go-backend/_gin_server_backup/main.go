package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"interview-ai/catalyst-go-backend/handlers"
	"interview-ai/catalyst-go-backend/middleware"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	firebase "firebase.google.com/go/v4"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/option"
)

const (
	// Replace with your Google Cloud Project ID
	gcpProjectID = "interviewai-mzf86"
	// Replace with the path to your Firebase service account key JSON file
	// This is needed if your backend needs to verify Firebase ID tokens
	// For GCP hosted services, you might use workload identity instead.
	firebaseServiceAccountKeyPath = ".local/serviceAccountKey.json"
	// Base URL of your Next.js application
	nextjsBaseURL = os.Getenv("NEXTJS_BASE_URL")
	if nextjsBaseURL == "" {
		nextjsBaseURL = "http://localhost:3000" // TODO: replace with the actual URL of your Next.js application
	}
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Firebase Admin SDK (optional, if you need to verify Firebase ID tokens)
	// For production, consider how you'll provide credentials (e.g., Workload Identity on GCP)
	var firebaseApp *firebase.App
	var err error
	if firebaseServiceAccountKeyPath != "" {
		opt := option.WithCredentialsFile(firebaseServiceAccountKeyPath)
		firebaseApp, err = firebase.NewApp(ctx, nil, opt)
		if err != nil {
			log.Fatalf("error initializing Firebase app: %v\n", err)
		}
		log.Println("Firebase Admin SDK initialized successfully.")
	} else {
		log.Println("Firebase Admin SDK not initialized (no service account key path provided).")
	}

	// Initialize Secret Manager client
	secretClient, err := secretmanager.NewClient(ctx)
	if err != nil {
		log.Fatalf("Failed to create secretmanager client: %v", err)
	}
	defer secretClient.Close()
	log.Println("Google Secret Manager client initialized successfully.")

	// Setup Gin router
	router := gin.Default()

	// --- Middleware ---
	// CORS (adjust as needed for your frontend URL)
	router.Use(middleware.CORSMiddleware())
	// Firebase Auth Middleware (applied selectively or globally)
	// For now, we'll apply it per-route group or per-route where authentication is needed.
	// Example: authMiddleware := middleware.FirebaseAuth(firebaseApp)

	// --- API Routes ---
	api := router.Group("/api")
	{
		userRoutes := api.Group("/user")
		// Apply Firebase Auth middleware to routes that require user authentication
		// For catalyst, key management should be authenticated.
		if firebaseApp != nil {
			userRoutes.Use(middleware.FirebaseAuth(firebaseApp, gcpProjectID))
		}
		{
			// Endpoint 1: POST /api/user/set-api-key
			userRoutes.POST("/set-api-key", handlers.SetAPIKey(secretClient, gcpProjectID))
			// Endpoint 2: POST /api/user/remove-api-key
			userRoutes.POST("/remove-api-key", handlers.RemoveAPIKey(secretClient, gcpProjectID))
			// Endpoint 3: GET /api/user/api-key-status
			userRoutes.GET("/api-key-status", handlers.GetAPIKeyStatus(secretClient, gcpProjectID))
		}

		aiRoutes := api.Group("/ai")
		// AI routes might also need authentication, depending on your model
		if firebaseApp != nil {
			aiRoutes.Use(middleware.FirebaseAuth(firebaseApp, gcpProjectID))
		}
		{
			// This will be the endpoint your Next.js frontend calls.
			// It will then call your existing Genkit flows.
			// We'll use a generic handler for now and refine it.
			// The :flowName part allows us to dynamically call different Genkit flows.
			aiRoutes.POST("/genkit/:flowName", handlers.ProxyToGenkitFlow(secretClient, gcpProjectID, nextjsBaseURL))
		}
	}

	// --- Server Setup ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port if not specified
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()
	log.Printf("Server listening on port %s", port)

	// Wait for interrupt signal to gracefully shut down the server with a timeout.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
