package internal

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// MessageEntry represents a single parsed field from a LoRaWAN uplink message.
type MessageEntry struct {
	Label     string    `json:"label"`
	Value     any       `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

// --- raw JSON structures for unmarshaling ---

type upinfoItem struct {
	ArrTime  any `json:"ArrTime"`
	RX1DRoff any `json:"RX1DRoff"`
	RxDelay  any `json:"RxDelay"`
	DoorID   any `json:"doorid"`
	MuxID    any `json:"muxid"`
	RegionID any `json:"regionid"`
	RouterID any `json:"routerid"`
	RSSI     any `json:"rssi"`
	RTT      any `json:"rtt"`
	RxTime   any `json:"rxtime"`
	SNR      any `json:"snr"`
	XTime    any `json:"xtime"`
}

type messageRaw struct {
	DevAddr any          `json:"DevAddr"`
	Freq    any          `json:"Freq"`
	UpInfo  []upinfoItem `json:"upinfo"`
}

// Parse extracts top-level and upinfo fields into separate labeled entries.
// upinfo is expected as an array; each element's fields are extracted individually.
func Parse(raw []byte) ([]MessageEntry, error) {
	var msg messageRaw
	if err := json.Unmarshal(raw, &msg); err != nil {
		return nil, fmt.Errorf("parse: invalid JSON: %w", err)
	}

	now := time.Now()
	var entries []MessageEntry

	// --- top-level fields ---
	if msg.DevAddr != nil {
		entries = append(entries, MessageEntry{
			Label:     "DevAddr",
			Value:     msg.DevAddr,
			Timestamp: now,
		})
	}

	if msg.Freq != nil {
		entries = append(entries, MessageEntry{
			Label:     "Freq",
			Value:     msg.Freq,
			Timestamp: now,
		})
	}

	// --- upinfo array sub-fields ---
	for _, ui := range msg.UpInfo {
		addEntry := func(label string, val any) {
			if val != nil {
				entries = append(entries, MessageEntry{
					Label:     label,
					Value:     val,
					Timestamp: now,
				})
			}
		}

		addEntry("ArrTime", ui.ArrTime)
		addEntry("RX1DRoff", ui.RX1DRoff)
		addEntry("RxDelay", ui.RxDelay)
		addEntry("doorid", ui.DoorID)
		addEntry("muxid", ui.MuxID)
		addEntry("regionid", ui.RegionID)
		addEntry("routerid", ui.RouterID)
		addEntry("rssi", ui.RSSI)
		addEntry("rtt", ui.RTT)
		addEntry("rxtime", ui.RxTime)
		addEntry("snr", ui.SNR)
		addEntry("xtime", ui.XTime)
	}

	log.Printf("parse: extracted %d field(s) from %d upinfo item(s)", len(entries), len(msg.UpInfo))
	return entries, nil
}
