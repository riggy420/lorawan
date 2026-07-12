package lorawan

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/riggy420/lorawan/internal"
	"github.com/spf13/cobra"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the data pipeline API server",
	Run: func(cmd *cobra.Command, args []string) {
		// Initialise DB connection
		if err := internal.InitDB(); err != nil {
			log.Fatalf("failed to initialise database: %v", err)
		}
		defer internal.CloseDB()

		addr := ":8082"
		fmt.Printf("Starting API server on %s\n", addr)

		// Handle graceful shutdown
		go func() {
			sig := make(chan os.Signal, 1)
			signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
			<-sig
			fmt.Println("\nshutting down...")
			os.Exit(0)
		}()

		if err := internal.StartServer(addr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	},
}
