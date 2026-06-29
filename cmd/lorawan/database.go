package lorawan

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "lorawan",
	Short: "LoRaWAN server CLI",
}

func init() {
	rootCmd.AddCommand(startCmd)
}

func Execute() {
	rootCmd.Execute()
}
