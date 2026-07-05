package lorawan

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
)

var connectionCmd = &cobra.Command{
	Use:   "database",
	Short: "Check database Connection Cmd",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Checking Database Connection...")
		err := CheckConnection()
		if err != nil {
			fmt.Printf("Failed: %v\n", err)
		} else {
			fmt.Println("Success")
		}
	},
}

func CheckConnection() error {
	url := "http://localhost:8181?token=12345"
	client, err := influxdb3.NewFromConnectionString(url)
	if err != nil {
		return fmt.Errorf("failed to create InfluxDB client: %w", err)
	}
	defer client.Close()

	version, err := client.GetServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to InfluxDB server: %w", err)
	}

	fmt.Printf("Successfully connected to InfluxDB server (version: %s)\n", version)
	return nil
}

func deferClose() {
	client, err := influxdb3.New(influxdb3.ClientConfig{
		Host:  "http://localhost:8181",
		Token: "12345",
		Database: "itso",
	})
	if err != nil {
		fmt.Printf("Failed to create InfluxDB client: %v\n", err)
		return
	}
	defer client.Close()
}