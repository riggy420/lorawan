# LoRaWAN Sector Parsing & YAML Config

## Overview
Separate incoming WebSocket LoRaWAN data into message-type sectors in `parse.go`, and externalize WebSocket URLs into a YAML config loaded via Viper.

## Config (`config.yaml`)
- Single `websocket.urls` list
- Loaded at startup by Viper in `cmd/lorawan/config.go`
- Replaces hardcoded URL in `start.go`

## Parse (`internal/parse.go`)
- `MessageType` enum: JoinRequest, JoinAccept, Uplink, Downlink, MACCommand, Unknown
- `ParsedMessage` struct: raw JSON, type, timestamp
- `Parse(raw []byte) (*ParsedMessage, error)` classifies by message type field
- Per-type logging with prefixes (`[UPLINK]`, `[JOIN]`, etc.)
- Structure open for per-type DB tables later

## Updated `start.go`
- Viper reads `config.yaml` → URL list
- One `WSClient` per URL
- Each `WSClient.OnMsg` → `internal.Parse()` on incoming data

## Files
| File | Action |
|---|---|
| `config.yaml` | Create |
| `cmd/lorawan/config.go` | Create |
| `internal/parse.go` | Fill |
| `cmd/lorawan/start.go` | Edit |
