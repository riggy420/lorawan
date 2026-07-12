package lorawan

import (
	// "fmt"
	// "context"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:    "lorawan",
	Short:  "LoRaWan ",
	Long:   `LoRaWan is a CLI tool for managing and looking at the data from the HKUST`,
	Run: func(cmd *cobra.Command, args []string) {
		// Show help if no subcommands or flags are provided
		if len(args) == 0 {
			cmd.Help()
		}
	},
}
