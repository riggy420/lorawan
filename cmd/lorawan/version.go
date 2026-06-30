package lorawan

import (
	"fmt"
	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number of LoRaWAN server",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("LoRaWAN server version 1.0.0")
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}