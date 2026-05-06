package main

import (
	"log"
	"net/http"
	"os"

	"circuit-analyzer/handler"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/analyze", handler.HandleAnalyze)
	mux.HandleFunc("/api/examples", handler.HandleNetlistExamples)
	mux.HandleFunc("/api/info", handler.HandleInfo)

	// Serve frontend static files
	fs := http.FileServer(http.Dir("./frontend/dist"))
	mux.Handle("/", fs)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8011"
	}

	log.Printf("Circuit Analyzer listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler.CORS(mux)))
}
