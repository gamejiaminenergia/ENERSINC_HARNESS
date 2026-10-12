#!/bin/bash

# CREG CLI Wrapper - Simple interface for CREG AI client
# Usage: ./creg-wrapper.sh "your question"

# Check if question is provided
if [ $# -eq 0 ] || [ -z "$1" ]; then
    echo "Error: Question is required"
    echo "Usage: ./creg-wrapper.sh \"your question\""
    exit 1
fi

QUESTION="$1"
RESPONSES_DIR="responses"

# Create responses directory if it doesn't exist
mkdir -p "$RESPONSES_DIR"

# Generate filename from question (simple hash)
FILENAME=$(echo "$QUESTION" | md5sum | cut -d' ' -f1)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESPONSES_DIR/query-$FILENAME-$TIMESTAMP.md"

echo "Pregunta: $QUESTION"
echo "Guardando respuesta en: $OUTPUT_FILE"

# Run the CREG client and save the answer to the output file
node creg-client.js "$QUESTION" | tee "$OUTPUT_FILE"

echo "✓ Respuesta guardada en: $OUTPUT_FILE"
exit 0
