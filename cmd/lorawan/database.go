package lorawan

import (
	"fmt"

	"github.com/riggy420/lorawan/internal"
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

var queryDoorIDsCmd = &cobra.Command{
	Use:   "query-doorids",
	Short: "Query distinct door IDs from the database",
	Run: func(cmd *cobra.Command, args []string) {
		// Initialise DB connection
		if err := internal.InitDB(); err != nil {
			fmt.Printf("Failed to initialise database: %v\n", err)
			return
		}
		defer internal.CloseDB()

		doorIDs, err := internal.QueryDoorIDs()
		if err != nil {
			fmt.Printf("Query failed: %v\n", err)
			return
		}

		if len(doorIDs) == 0 {
			fmt.Println("No door IDs found.")
			return
		}

		fmt.Printf("Found %d distinct door IDs:\n", len(doorIDs))
		for _, id := range doorIDs {
			fmt.Println(id)
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