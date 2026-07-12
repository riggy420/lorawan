package lorawan

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"sync"

	"github.com/gorilla/websocket"
)

// WSClient connects to a remote WebSocket server.
type WSClient struct {
	url  string
	conn *websocket.Conn
	mu   sync.Mutex
	send chan []byte
	OnMsg func([]byte)
	wg   sync.WaitGroup
}

// NewWSClient creates a new WebSocket client for the given URL.
func NewWSClient(rawURL string) *WSClient {
	return &WSClient{
		url:  rawURL,
		send: make(chan []byte, 64),
	}
}

// Connect dials the WebSocket server and starts read/write pumps.
func (c *WSClient) Connect(ctx context.Context) error {
	u, err := url.Parse(c.url)
	if err != nil {
		return fmt.Errorf("invalid ws url: %w", err)
	}

	log.Printf("websocket: connecting to %s", u.String())

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	log.Printf("websocket: connected to %s", u.String())

	c.wg.Add(2)
	go c.readPump(ctx)
	go c.writePump(ctx)

	return nil
}

func (c *WSClient) readPump(ctx context.Context) {
	defer c.wg.Done()
	defer func() {
		c.mu.Lock()
		c.conn = nil
		c.mu.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		c.mu.Lock()
		conn := c.conn
		c.mu.Unlock()
		if conn == nil {
			return
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			if ctx.Err() == nil {
				log.Printf("websocket: read error: %v", err)
			}
			return
		}

		var pretty interface{}
		if json.Unmarshal(message, &pretty) == nil {
			formatted, _ := json.MarshalIndent(pretty, "", "  ")
			log.Printf("websocket: received:\n%s", formatted)
		} else {
			log.Printf("websocket: received: %s", message)
		}

		if c.OnMsg != nil {
			c.OnMsg(message)
		}
	}
}

func (c *WSClient) writePump(ctx context.Context) {
	defer c.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			c.mu.Lock()
			conn := c.conn
			c.mu.Unlock()
			if conn == nil {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("websocket: write error: %v", err)
				return
			}
		}
	}
}

// Send enqueues a message to be written to the connection.
func (c *WSClient) Send(msg []byte) {
	select {
	case c.send <- msg:
	default:
		log.Println("websocket: send buffer full, dropping message")
	}
}

// Close shuts down the connection and waits for pumps to exit.
func (c *WSClient) Close() {
	c.mu.Lock()
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()

	if conn != nil {
		conn.Close()
	}

	close(c.send)
	c.wg.Wait()
}
