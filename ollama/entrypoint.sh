#!/bin/sh

ollama serve &

# Wait until Ollama is ready
until ollama list >/dev/null 2>&1; do
    echo "Waiting for Ollama..."
    sleep 2
done

# Download model if it does not exist
ollama list | grep -q "llama3.2" || ollama pull llama3.2

wait