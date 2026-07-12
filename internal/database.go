package internal

import (
	"context"
	"fmt"
	"time"
	"math"

	"github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
)

// Labels that are low-cardinality metadata → stored as tags.
var tagLabels = map[string]bool{
	"DevAddr":   true,
	"region":    true,
	"msgtype":   true,
	"DeviceEui": true,
	"SessID":    true,
	"doorid":    true,
	"muxid":     true,
	"regionid":  true,
	"routerid":  true,
}

var client *influxdb3.Client

// InitDB creates and stores a reusable InfluxDB client.  InfluxDB v3 Core
// auto-creates databases and tables on first write, so no explicit DDL is
// needed — just connect and start writing.
func InitDB() error {
	c, err := influxdb3.New(influxdb3.ClientConfig{
		Host:     "http://localhost:8181",
		Token:    "12345",
		Database: "itso",
	})
	if err != nil {
		return fmt.Errorf("InitDB: failed to create InfluxDB client: %w", err)
	}
	client = c
	return nil
}

// CloseDB closes the shared InfluxDB client.
func CloseDB() {
	if client != nil {
		client.Close()
		client = nil
	}
}

// EnsureMeasurement is a no-op for InfluxDB v3.
// InfluxDB v3 Core/Enterprise auto-creates tables on first write, and DDL
// (CREATE TABLE) is not supported through the Flight SQL query interface.
// Column types are already guaranteed by coerceNumeric in Write() which
// converts whole-number floats to int64 (BIGINT) before writing.
func EnsureMeasurement() error {
	if client == nil {
		return fmt.Errorf("EnsureMeasurement: client not initialised – call InitDB first")
	}
	return nil
}

// coerceNumeric inspects an any value decoded from JSON.  JSON numbers always
// arrive as float64; this helper converts whole-number floats to int64 so
// InfluxDB stores them as BIGINT instead of DOUBLE.
func coerceNumeric(v any) any {
	f, ok := v.(float64)
	if !ok {
		return v // string, bool, nil, or already another type
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return nil // skip non-finite values
	}
	if f == math.Trunc(f) {
		return int64(f)
	}
	return f
}

// Write writes parsed LoRaWAN message entries as a single InfluxDB point.
// Labels that represent metadata are stored as tags; measurement values are
// stored as fields with their original numeric types preserved (int64 for
// whole numbers, float64 otherwise).
func Write(message []MessageEntry) {
	if client == nil {
		fmt.Println("Write: InfluxDB client not initialised – call InitDB first")
		return
	}
	if len(message) == 0 {
		return
	}

	tags := map[string]string{}
	fields := map[string]any{}

	// Use the first entry's timestamp as the point time (all entries
	// from a single Parse call share the same timestamp).
	ts := message[0].Timestamp

	for _, entry := range message {
		if tagLabels[entry.Label] {
			tags[entry.Label] = fmt.Sprintf("%v", entry.Value)
		} else {
			fields[entry.Label] = coerceNumeric(entry.Value)
		}
	}

	// If there are no fields the point is meaningless — skip it.
	if len(fields) == 0 {
		fmt.Println("Write: no field values in message, skipping")
		return
	}

	point := influxdb3.NewPoint("stat", tags, fields, ts)

	err := client.WritePoints(context.Background(), []*influxdb3.Point{point})
	if err != nil {
		fmt.Printf("Failed to write points to InfluxDB: %v\n", err)
	}
}

// requireClient is a guard that ensures the InfluxDB client is initialised
// before any query or write operation.
func requireClient() error {
	if client == nil {
		return fmt.Errorf("database: client not initialised – call InitDB first")
	}
	return nil
}

// QueryDoorIDs returns the distinct set of doorid tag values from the "stat"
// measurement.
func QueryDoorIDs() ([]string, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	iter, err := client.Query(context.Background(),
		"SELECT DISTINCT doorid FROM stat")
	if err != nil {
		return nil, fmt.Errorf("QueryDoorIDs: %w", err)
	}

	var doorIDs []string
	for iter.Next() {
		row := iter.Value()
		if v, ok := row["doorid"]; ok {
			doorIDs = append(doorIDs, fmt.Sprintf("%v", v))
		}
	}

	return doorIDs, nil
}

// QueryUniqueRegions returns the distinct set of region tag values from the
// "stat" measurement.
func QueryUniqueRegions() ([]string, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	iter, err := client.Query(context.Background(),
		"SELECT DISTINCT region FROM stat")
	if err != nil {
		return nil, fmt.Errorf("QueryUniqueRegions: %w", err)
	}

	var regions []string
	for iter.Next() {
		row := iter.Value()
		if v, ok := row["region"]; ok {
			regions = append(regions, fmt.Sprintf("%v", v))
		}
	}

	return regions, nil
}

// QueryUniqueDeviceEUIs returns the distinct set of DeviceEui tag values from
// the "stat" measurement.
func QueryUniqueDeviceEUIs() ([]string, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	iter, err := client.Query(context.Background(),
		`SELECT DISTINCT "DeviceEui" FROM stat`)
	if err != nil {
		return nil, fmt.Errorf("QueryUniqueDeviceEUIs: %w", err)
	}

	var deviceEUIs []string
	for iter.Next() {
		row := iter.Value()
		if v, ok := row["DeviceEui"]; ok {
			deviceEUIs = append(deviceEUIs, fmt.Sprintf("%v", v))
		}
	}

	return deviceEUIs, nil
}

// ── Stats & recent entries ──────────────────────────────────────────

// Entry is a single row from the stat measurement.  Keys are column names;
// values are the raw Go types returned by the InfluxDB Flight SQL driver.
type Entry map[string]any

// QueryRecentEntries returns the most recent n entries from "stat", newest
// first.  If n <= 0 it defaults to 5.  Rows where any key field is null are
// skipped so the frontend always receives complete records.
func QueryRecentEntries(n int) ([]Entry, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}
	if n <= 0 {
		n = 5
	}

	// Fetch more than n to allow for filtering.
	iter, err := client.Query(context.Background(),
		fmt.Sprintf("SELECT * FROM stat ORDER BY time DESC LIMIT %d", n*3))
	if err != nil {
		return nil, fmt.Errorf("QueryRecentEntries: %w", err)
	}

	var entries []Entry
	for iter.Next() {
		row := Entry(iter.Value())
		if entryHasNull(row) {
			continue
		}
		entries = append(entries, row)
		if len(entries) >= n {
			break
		}
	}

	return entries, nil
}

// entryHasNull returns true if any value in the entry is nil.
func entryHasNull(e Entry) bool {
	if len(e) == 0 {
		return true
	}
	for _, v := range e {
		if v == nil {
			return true
		}
	}
	return false
}

// HourlyStats holds the entries-per-hour count and uplink / downlink
// breakdown from the stat measurement.
type HourlyStats struct {
	EntriesPerHour float64 `json:"entriesPerHour"`
	Estimated      bool    `json:"estimated"`
	Uplinks        int64   `json:"uplinks"`
	Downlinks      int64   `json:"downlinks"`
}

// QueryHourlyStats returns entries-per-hour (estimated if < 1 hour of data)
// plus total uplink and downlink counts.
func QueryHourlyStats() (*HourlyStats, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	stats := &HourlyStats{}

	// ── Entries in the last hour ──────────────────────────────────
	iter, err := client.Query(context.Background(),
		"SELECT COUNT(*) AS cnt FROM stat WHERE time >= now() - interval '1 hour'")
	if err != nil {
		return nil, fmt.Errorf("QueryHourlyStats count: %w", err)
	}

	var countInHour int64
	if iter.Next() {
		row := iter.Value()
		if v, ok := row["cnt"]; ok {
			countInHour = toInt64(v)
		}
	}

	if countInHour > 0 {
		stats.EntriesPerHour = float64(countInHour)
	} else {
		// Not enough data — estimate from interval between last 2 entries.
		stats.Estimated = true
		stats.EntriesPerHour = estimateEntriesPerHour()
	}

	// ── Uplink / downlink counts ──────────────────────────────────
	stats.Uplinks = countByMsgType("uplink")
	stats.Downlinks = countByMsgType("downlink")

	return stats, nil
}

// countByMsgType returns the total row count for a given msgtype tag value.
func countByMsgType(msgtype string) int64 {
	iter, err := client.Query(context.Background(),
		fmt.Sprintf("SELECT COUNT(*) AS cnt FROM stat WHERE msgtype = '%s'", msgtype))
	if err != nil {
		return 0
	}
	if iter.Next() {
		row := iter.Value()
		if v, ok := row["cnt"]; ok {
			return toInt64(v)
		}
	}
	return 0
}

// estimateEntriesPerHour uses the interval between the two most recent
// entries to project the hourly rate.  Returns 0 if fewer than 2 entries
// exist.
func estimateEntriesPerHour() float64 {
	iter, err := client.Query(context.Background(),
		"SELECT time FROM stat ORDER BY time DESC LIMIT 2")
	if err != nil {
		return 0
	}

	var times []int64
	for iter.Next() {
		row := iter.Value()
		if t, ok := row["time"]; ok {
			times = append(times, toInt64(t))
		}
	}

	if len(times) < 2 {
		return 0
	}

	// times[0] is newest, times[1] is second-newest.  The value is in
	// nanoseconds since Unix epoch.
	intervalSec := float64(times[0]-times[1]) / 1e9
	if intervalSec <= 0 {
		return 0
	}

	// Entries per second → per hour.
	return (1.0 / intervalSec) * 3600.0
}

// toInt64 coerces an any value to int64.
func toInt64(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	case int32:
		return int64(n)
	case uint64:
		return int64(n)
	default:
		return 0
	}
}

// ── Sensor drill-down ──────────────────────────────────────────────

// SensorDetail bundles the latest telemetry and recent entries for a
// single device EUI.
type SensorDetail struct {
	DeviceEui string  `json:"deviceEui"`
	Region    string  `json:"region"`
	Uplinks   int64   `json:"uplinks"`
	Downlinks int64   `json:"downlinks"`
	LatestRssi float64 `json:"latestRssi"`
	LatestSnr  float64 `json:"latestSnr"`
	Entries    []Entry `json:"entries"`
}

// SensorInfo is a compact row for the sensor list — EUI plus the timestamp
// of its most recent entry so the frontend can show when each device last
// reported.
type SensorInfo struct {
	DeviceEui  string `json:"deviceEui"`
	LatestTime int64  `json:"latestTime"`
}

// QuerySensorsByRegion returns every DeviceEui in a region together with the
// nanosecond timestamp of its most recent entry, newest first.
func QuerySensorsByRegion(region string) ([]SensorInfo, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	iter, err := client.Query(context.Background(),
		fmt.Sprintf("SELECT \"DeviceEui\", MAX(time) AS latest_time FROM stat WHERE region = '%s' GROUP BY \"DeviceEui\" ORDER BY latest_time DESC", region))
	if err != nil {
		return nil, fmt.Errorf("QuerySensorsByRegion: %w", err)
	}

	var sensors []SensorInfo
	for iter.Next() {
		row := iter.Value()
		eui := ""
		if v, ok := row["DeviceEui"]; ok {
			eui = fmt.Sprintf("%v", v)
		}
		var latestTime int64
		if v, ok := row["latest_time"]; ok {
			// InfluxDB v3 returns MAX(time) as a time.Time, not a raw int64.
			if t, ok := v.(time.Time); ok {
				latestTime = t.UnixNano()
			} else {
				latestTime = toInt64(v)
			}
		}
		if eui != "" {
			sensors = append(sensors, SensorInfo{DeviceEui: eui, LatestTime: latestTime})
		}
	}
	return sensors, nil
}

// QuerySensorDetail returns the latest telemetry and recent entries for a
// single DeviceEui.
func QuerySensorDetail(eui string) (*SensorDetail, error) {
	if err := requireClient(); err != nil {
		return nil, err
	}

	detail := &SensorDetail{DeviceEui: eui}

	// Latest 20 entries for this device.
	iter, err := client.Query(context.Background(),
		fmt.Sprintf("SELECT * FROM stat WHERE \"DeviceEui\" = '%s' ORDER BY time DESC LIMIT 20", eui))
	if err != nil {
		return nil, fmt.Errorf("QuerySensorDetail entries: %w", err)
	}

	for iter.Next() {
		row := iter.Value()
		detail.Entries = append(detail.Entries, Entry(row))

		// Snapshot region from the first (most recent) row.
		if detail.Region == "" {
			if r, ok := row["region"]; ok {
				detail.Region = fmt.Sprintf("%v", r)
			}
		}

		// Snapshot latest RSSI / SNR from the first row.
		if detail.LatestRssi == 0 {
			if v, ok := row["rssi"]; ok {
				detail.LatestRssi = toFloat64(v)
			}
		}
		if detail.LatestSnr == 0 {
			if v, ok := row["snr"]; ok {
				detail.LatestSnr = toFloat64(v)
			}
		}
	}

	// Uplink / downlink counts for this device.
	detail.Uplinks = countByMsgTypeAndEui("uplink", eui)
	detail.Downlinks = countByMsgTypeAndEui("downlink", eui)

	return detail, nil
}

func countByMsgTypeAndEui(msgtype, eui string) int64 {
	iter, err := client.Query(context.Background(),
		fmt.Sprintf("SELECT COUNT(*) AS cnt FROM stat WHERE msgtype = '%s' AND \"DeviceEui\" = '%s'", msgtype, eui))
	if err != nil {
		return 0
	}
	if iter.Next() {
		row := iter.Value()
		if v, ok := row["cnt"]; ok {
			return toInt64(v)
		}
	}
	return 0
}

func toFloat64(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	default:
		return 0
	}
}
