package lorawan

import (
	"fmt"
	"github.com/spf13/cobra"
	"context"
)

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the LoRaWAN server",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Starting LoRaWAN server...")
		// Add your server start logic here
		startServer()
	},
}

func startServer() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() 

	// waitgroup to track goroutines
	var wg sync.WaitGroup

	//status channel to receive status updates from goroutines
	statusChan := make(chan string)

	// print Something
	fmt.Println("Starting LoRaWAN server...")

}
