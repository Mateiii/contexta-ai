#!/bin/sh

ollama serve &

# Wait until Ollama is ready
until ollama list >/dev/null 2>&1; do
    echo "Waiting for Ollama..."
    sleep 2
done

# Download Gemma if it does not exist
ollama list | grep -q "gemma3:12b" || ollama pull gemma3:12b

# Download embedding model if it does not exist
ollama list | grep -q "nomic-embed-text" || ollama pull nomic-embed-text

wait