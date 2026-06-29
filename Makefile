ifeq ($(OS),Windows_NT)
	BIN := bin/itso.exe
else
	BIN := bin/itso
endif

.PHONY: build run

build:
	go build -o $(BIN) main.go
	@echo "Build complete. Run '$(BIN)' to execute the program."

run: build
	./$(BIN) start
