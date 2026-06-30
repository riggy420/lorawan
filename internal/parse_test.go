package internal

import (
	"encoding/json"
	"testing"
)

func TestParse(t *testing.T) {
	raw := []byte(`{
		"DevAddr": "01020304",
		"Freq": 868.1,
		"upinfo": [
			{
				"ArrTime": 1625097600,
				"RX1DRoff": 2,
				"RxDelay": 1,
				"doorid": "door-01",
				"muxid": "mux-05",
				"regionid": "region-eu",
				"routerid": "router-3",
				"rssi": -45,
				"rtt": 120,
				"rxtime": "2023-01-01T00:00:00Z",
				"snr": 9.5,
				"xtime": 123456
			}
		]
	}`)

	entries, err := Parse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 2 top-level + 12 upinfo = 14 entries
	if len(entries) != 14 {
		t.Fatalf("expected 14 entries, got %d", len(entries))
	}

	wantLabels := map[string]bool{
		"DevAddr": true, "Freq": true,
		"ArrTime": true, "RX1DRoff": true, "RxDelay": true,
		"doorid": true, "muxid": true, "regionid": true, "routerid": true,
		"rssi": true, "rtt": true, "rxtime": true, "snr": true, "xtime": true,
	}

	for _, e := range entries {
		delete(wantLabels, e.Label)
	}
	for label := range wantLabels {
		t.Errorf("missing entry for label: %s", label)
	}

	checkValue(t, entries, "DevAddr", "01020304")
	checkValue(t, entries, "rssi", float64(-45))
	checkValue(t, entries, "snr", 9.5)
}

func TestParseMultipleUpInfo(t *testing.T) {
	raw := []byte(`{
		"DevAddr": "abcd",
		"upinfo": [
			{"rssi": -40, "snr": 10.0},
			{"rssi": -50, "snr": 8.0}
		]
	}`)

	entries, err := Parse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// DevAddr + 2 fields * 2 items = 5 entries
	if len(entries) != 5 {
		t.Fatalf("expected 5 entries, got %d", len(entries))
	}

	rssiCount := 0
	for _, e := range entries {
		if e.Label == "rssi" {
			rssiCount++
		}
	}
	if rssiCount != 2 {
		t.Errorf("expected 2 rssi entries, got %d", rssiCount)
	}
}

func checkValue(t *testing.T, entries []MessageEntry, label string, want any) {
	t.Helper()
	for _, e := range entries {
		if e.Label == label {
			if e.Value != want {
				t.Errorf("%s: expected %v (%T), got %v (%T)", label, want, want, e.Value, e.Value)
			}
			return
		}
	}
	t.Errorf("%s: entry not found", label)
}

func TestParseInvalidJSON(t *testing.T) {
	_, err := Parse([]byte(`{invalid}`))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestParseEmptyFields(t *testing.T) {
	raw := []byte(`{"DevAddr": "abc"}`)
	entries, err := Parse(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
}

func TestMessageEntryJSON(t *testing.T) {
	e := MessageEntry{
		Label: "DevAddr",
		Value: "01020304",
	}
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	var out MessageEntry
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if out.Label != e.Label {
		t.Errorf("label mismatch: %s != %s", out.Label, e.Label)
	}
}
