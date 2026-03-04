package main

import (
	"log"
	"net/http"
	"os"

	"conference-to-stream/fishjam"
	"conference-to-stream/foundry"
	"conference-to-stream/handler"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	// Load .env from parent directory (conference-to-stream/.env) when running locally
	_ = godotenv.Load("../.env")

	fishjamID := os.Getenv("FISHJAM_ID")
	if fishjamID == "" {
		log.Fatal("FISHJAM_ID is required")
	}
	managementToken := os.Getenv("FISHJAM_MANAGEMENT_TOKEN")
	if managementToken == "" {
		log.Fatal("FISHJAM_MANAGEMENT_TOKEN is required")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fishjamClient := fishjam.NewClient(fishjamID, managementToken)
	foundryClient := foundry.NewClient()
	h := handler.New(fishjamClient, foundryClient)

	mux := http.NewServeMux()
	h.Route(mux)

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	})

	addr := ":" + port
	log.Printf("starting server on %s", addr)
	if err := http.ListenAndServe(addr, c.Handler(mux)); err != nil {
		log.Fatal(err)
	}
}
