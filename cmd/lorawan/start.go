package lorawan

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/riggy420/lorawan/internal"
	"github.com/spf13/cobra"
)

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the LoRaWAN server",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Starting LoRaWAN server...")
		startServer()
	},
}

func startServer() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load config from config.yaml
	cfg, err := LoadConfig()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if len(cfg.Websocket.URLs) == 0 {
		log.Fatal("config: no websocket URLs configured")
	}

	var wg sync.WaitGroup
	statusChan := make(chan string, 8)

	fmt.Println("Starting LoRaWAN server...")

	// Create a WSClient per configured URL
	clients := make([]*WSClient, 0, len(cfg.Websocket.URLs))

	for _, rawURL := range cfg.Websocket.URLs {
		wsClient := NewWSClient(rawURL)

		// Wire up the parser to handle incoming messages
		url := rawURL // capture for closure
		wsClient.OnMsg = func(raw []byte) {
			entries, err := internal.Parse(raw)
			if err != nil {
				log.Printf("[%s] parse error: %v", url, err)
				return
			}
			for _, entry := range entries {
				log.Printf("[%s] %s: %v", url, entry.Label, entry.Value)
			}

			log.Printf("[%s] parsed %d entries", url, len(entries))
			internal.Write(entries)
		}

		clients = append(clients, wsClient)

		wg.Add(1)
		go func(wsc *WSClient, u string) {
			defer wg.Done()
			if err := wsc.Connect(ctx); err != nil {
				statusChan <- fmt.Sprintf("WebSocket error [%s]: %v", u, err)
				log.Printf("websocket [%s]: error: %v", u, err)
				cancel()
				return
			}
			statusChan <- fmt.Sprintf("WebSocket: connected to %s", u)
		}(wsClient, rawURL)
	}

	// Status logger
	wg.Add(1)
	go func() {
		defer wg.Done()
		for msg := range statusChan {
			log.Printf("status: %s", msg)
		}
	}()

	// Wait for shutdown signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-sig:
		log.Println("received shutdown signal")
	case <-ctx.Done():
		log.Println("context cancelled")
	}

	cancel()
	log.Println("shutting down...")

	for _, wsClient := range clients {
		wsClient.Close()
	}

	close(statusChan)
	wg.Wait()

	fmt.Println("Shutdown complete.")
}
