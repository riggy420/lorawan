package lorawan

import (
	"fmt"
	"log"

	"github.com/spf13/viper"
)

// Config holds the application configuration loaded from config.yaml.
type Config struct {
	Websocket WebsocketConfig `mapstructure:"websocket"`
}

// WebsocketConfig holds WebSocket client URLs.
type WebsocketConfig struct {
	URLs []string `mapstructure:"urls"`
}

// LoadConfig reads and parses config.yaml from the current directory.
func LoadConfig() (*Config, error) {
	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config.yaml: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	log.Printf("config: loaded %d websocket URL(s)", len(cfg.Websocket.URLs))
	return &cfg, nil
}
