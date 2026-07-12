ifeq ($(OS),Windows_NT)
	BIN := bin/itso.exe
else
	BIN := bin/itso
endif

.PHONY: build run run-all run-websocket run-api run-frontend

build:
	go build -o $(BIN) main.go
	@echo "Build complete. Run '$(BIN)' to execute the program."
	go install .

run: build
	./$(BIN) start

# ── Individual service launchers (used by run-all) ──────────────────

run-websocket:
	./$(BIN) start

run-api:
	./$(BIN) serve

run-frontend:
	npm --prefix ui run dev

# run-all: build, then launch websocket, API, and frontend in parallel.
# Press Ctrl-C to stop all three.
run-all: build
	@echo "Starting websocket listener, API server, and frontend..."
	@$(MAKE) -j3 run-websocket run-api run-frontend
