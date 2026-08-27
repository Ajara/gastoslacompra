package main

import (
	"log"
	"os"
	"path/filepath"

	"gastoslacompra/internal/db"
	"gastoslacompra/internal/httpapi"
)

func main() {
	dataDir := getenv("DATA_DIR", "./data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal(err)
	}

	database, err := db.Open(filepath.Join(dataDir, "lacompra.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	photosDir := filepath.Join(dataDir, "photos")
	if err := os.MkdirAll(photosDir, 0o755); err != nil {
		log.Fatal(err)
	}

	srv := httpapi.New(database, httpapi.Config{
		Addr:         getenv("ADDR", ":8080"),
		PhotosDir:    photosDir,
		OpenAIKey:    os.Getenv("OPENAI_API_KEY"),
		AnthropicKey: os.Getenv("ANTHROPIC_API_KEY"),
	})

	log.Printf("API escuchando en %s (sqlite %s)", srv.Addr, filepath.Join(dataDir, "lacompra.db"))
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
