#!/bin/bash

set -e

IMAGE_NAME="creg-api"
CONTAINER_NAME="creg-api-container"
PORT=3000

echo "=== Build imagen Docker ==="
docker build -t $IMAGE_NAME ./clients/creg-client

echo "=== Verificando si contenedor existente está corriendo ==="
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Contenedor existente encontrado, eliminando..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
fi

echo "=== Iniciando contenedor ==="
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:3000 \
    --shm-size=2gb \
    $IMAGE_NAME

echo "=== Esperando a que inicie ==="
sleep 5

echo "=== Verificando salud ==="
curl -s http://localhost:$PORT/health || echo "Contenedor iniciando..."

echo ""
echo "=== API lista en http://localhost:$PORT ==="
echo ""
echo "Ejemplo de uso:"
echo "curl -X POST http://localhost:$PORT/api/ask \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"question\": \"¿Qué es el Mecanismo de Sostenimiento?\"}'"