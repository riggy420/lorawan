package lorawan

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

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

	var wg sync.WaitGroup
	statusChan := make(chan string, 8)

	fmt.Println("Starting LoRaWAN server...")

	wsClient := NewWSClient("ws://loranet01.ust.hk:7002/owner-c::2")

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := wsClient.Connect(ctx); err != nil {
			statusChan <- fmt.Sprintf("WebSocket error: %v", err)
			log.Printf("websocket: error: %v", err)
			cancel()
			return
		}
		statusChan <- "WebSocket: connected to loranet01.ust.hk:7002"
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for msg := range statusChan {
			log.Printf("status: %s", msg)
		}
	}()

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

	wsClient.Close()
	close(statusChan)
	wg.Wait()

	fmt.Println("Shutdown complete.")
}
