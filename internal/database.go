package internal 

import (
	"context"
	"fmt"
	"github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
	"time"
)

func Write(message []MessageEntry) {
	// fmt.Println("Writing to InfluxDB...")

	s1 := map[string]string{}
	s2 := map[string]interface{}{}
	for _ , entry := range message {
		s1[entry.Label] = entry.Label
	}
	for _ , entry := range message {
		stringValue := fmt.Sprintf("%v", entry.Value)
		s2[entry.Label] = stringValue
	}

	newpoints := influxdb3.NewPoint(
		"stat",
		s1,
		s2,
		time.Now(),
	)

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

	points := []*influxdb3.Point{newpoints}

	err = client.WritePoints(context.Background(), points)
	if err != nil {
		fmt.Printf("Failed to write points to InfluxDB: %v\n", err)
		return
	}
}

func query() {

}