# CREG API - Documentación Completa

## Descripción

API REST dockerizada que conecta con el asistente de IA de la Comisión de Regulación de Energía y Gas (CREG) de Colombia. Permite realizar preguntas sobre regulación energética colombiana y obtener respuestas detalladas.

## URL Base

```
http://localhost:3000
```

##快速start

```bash
# Verificar que está corriendo
curl http://localhost:3000/health

# Hacer una pregunta
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué es la CREG?"}'
```

---

## Endpoints

### 1. Health Check

Verifica que la API esté funcionando y muestra el estado del pool.

```http
GET /health
```

**Ejemplo:**
```bash
curl http://localhost:3000/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "mode": "auto",
  "pool": {
    "size": 2,
    "maxConcurrent": 4,
    "active": 0,
    "queued": 0,
    "cacheSize": 5,
    "available": 0
  }
}
```

---

### 2. Realizar Pregunta

Envía una pregunta al asistente CREG y retorna la respuesta.

```http
POST /api/ask
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "question": "Tu pregunta aquí",
  "timeout": 180000
}
```

**Parámetros:**

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| question | string | Sí | - | La pregunta sobre regulación energética |
| timeout | integer | No | 180000 | Timeout en ms (mín: 30000, máx: 300000) |

**Límites:**
- Longitud máxima de pregunta: 2000 caracteres
- Cola máxima: 10 requests (retorna 429 si está llena)

**Ejemplo completo:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "¿Qué es el Mecanismo de Sostenimiento de la Confiabilidad?",
    "timeout": 240000
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "title": "Concepto: Mecanismo para el Sostenimiento de la Confiabilidad",
    "content": "El Mecanismo para el Sostenimiento de la Confiabilidad...",
    "rawHtml": "<div>...</div>"
  },
  "cached": false
}
```

**Respuesta desde cache:**
```json
{
  "success": true,
  "data": { ... },
  "cached": true
}
```

**Respuesta de error (400):**
```json
{
  "success": false,
  "error": "Question is required"
}
```

```json
{
  "success": false,
  "error": "Question too long (max 2000 chars)"
}
```

**Respuesta de error (429):**
```json
{
  "success": false,
  "error": "Server busy, try again later"
}
```

**Respuesta de error (500):**
```json
{
  "success": false,
  "error": "No iframe found"
}
```

---

### 3. Estadísticas

Obtiene estadísticas del pool, cola y cache.

```http
GET /api/stats
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/stats
```

**Respuesta:**
```json
{
  "pool": {
    "total": 2,
    "active": 1,
    "free": 1
  },
  "queue": {
    "current": 0,
    "max": 10
  },
  "cache": {
    "entries": 5,
    "maxAgeMs": 3600000
  }
}
```

---

### 4. Limpiar Cache

Limpia todas las respuestas en cache.

```http
GET /api/cache/clear
```

**Ejemplo:**
```bash
curl http://localhost:3000/api/cache/clear
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Cache cleared"
}
```

---

## Ejemplos de Uso

### curl

```bash
# Pregunta básica
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué es la CREG?"}'

# Con timeout personalizado
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Cómo funciona el mercado de energía?", "timeout": 300000}'
```

### Python

```python
import requests
import json

# Pregunta básica
response = requests.post(
    "http://localhost:3000/api/ask",
    json={"question": "¿Qué es la CREG?"}
)
data = response.json()

if data["success"]:
    print(data["data"]["content"])
else:
    print(f"Error: {data['error']}")

# Con timeout
response = requests.post(
    "http://localhost:3000/api/ask",
    json={"question": "¿Cómo funciona el mercado de energía?", "timeout": 300000}
)
```

### JavaScript/Node.js

```javascript
// Usando fetch
const response = await fetch("http://localhost:3000/api/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "¿Qué es la CREG?" })
});
const data = await response.json();

if (data.success) {
  console.log(data.data.content);
  if (data.cached) console.log("(Desde cache)");
} else {
  console.error(data.error);
}

// Con timeout
const response = await fetch("http://localhost:3000/api/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    question: "¿Cómo funciona el mercado de energía?",
    timeout: 300000 
  })
});
```

### Python con manejo de errores y reintentos

```python
import requests
import time

def ask_creg(question, max_retries=3, timeout=180000):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "http://localhost:3000/api/ask",
                json={"question": question, "timeout": timeout},
                timeout=timeout / 1000 + 10
            )
            data = response.json()
            
            if data["success"]:
                return {
                    "content": data["data"]["content"],
                    "cached": data.get("cached", False)
                }
            elif "Server busy" in data.get("error", ""):
                time.sleep(2)
                continue
            else:
                return {"error": data["error"]}
        except requests.exceptions.Timeout:
            time.sleep(5)
            continue
    
    return {"error": "Max retries exceeded"}

result = ask_creg("¿Qué es el Mecanismo de Sostenimiento?")
if "content" in result:
    print(result["content"])
```

### JavaScript con axios

```javascript
const axios = require('axios');

async function askCreg(question, timeout = 180000) {
  try {
    const response = await axios.post(
      "http://localhost:3000/api/ask",
      { question, timeout },
      { timeout: timeout + 10000 }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return { success: false, error: error.message };
  }
}

askCreg("¿Qué es la CREG?").then(console.log);
```

---

## Configuración

### Variables de Entorno

Puedes configurar la API usando variables de entorno:

| Variable | Default | Descripción |
|----------|---------|-------------|
| PORT | 3000 | Puerto donde corre la API |
| CREG_MODE | auto | `auto` (API directa con respaldo en navegador), `direct` (sólo API) o `browser` (sólo Chromium) |
| CREG_API_URL | (endpoint CREG) | Endpoint del asistente usado por la web de la CREG |
| MAX_CONCURRENT | 4 (auto/direct) | Consultas simultáneas máximas |
| POOL_SIZE | 2 | Número de navegadores en el pool (sólo modo `browser`) |
| QUEUE_LIMIT | 10 | Máximo de requests en cola |
| TIMEOUT | 180000 | Timeout default en ms |
| CACHE_MAX_AGE | 3600000 | Tiempo de vida del cache en ms (1 hora) |

**Modos de consulta**

- `auto` (default): consulta directamente el endpoint que usa la web de la CREG
  (respuestas de ~12-20 s, sin abrir navegador). Si esa llamada falla, cae
  automáticamente al navegador headless.
- `direct`: sólo API directa. Es el modo más rápido y liviano; falla si el
  endpoint cambia.
- `browser`: sólo Chromium headless (comportamiento histórico). Necesita
  `--shm-size=2gb` y carga ~15 MB de la página en cada arranque del pool.

En `auto` y `direct` el pool de Chromium ya no se inicializa al arrancar: los
navegadores se abren únicamente si la API directa falla.

**Ejemplo con Docker:**
```bash
docker run -d \
  --name creg-api \
  -p 3000:3000 \
  -e CREG_MODE=auto \
  -e MAX_CONCURRENT=4 \
  -e TIMEOUT=300000 \
  -e CACHE_MAX_AGE=7200000 \
  --shm-size=2gb \
  creg-api
```

---

## Errores Comunes

| Código | Error | Causa | Solución |
|--------|-------|-------|----------|
| 400 | "Question is required" | No se envió la pregunta | Incluir el campo `question` en el body |
| 400 | "Question too long" | Pregunta excede 2000 caracteres | Reducir longitud de la pregunta |
| 429 | "Server busy" | Cola llena | Reintentar en unos segundos |
| 500 | "No iframe found" | La página de CREG no respondió | Reintentar la pregunta |
| 500 | Timeout | La respuesta tardó demasiado | Aumentar el timeout |

---

## Consideraciones para IA Asistente

### Mejores Prácticas

1. **Cache**: Las preguntas similares (ignorando mayúsculas y espacios extras) se responden del cache instantáneamente. Usar preguntas consistentes para maximizar cache hits.

2. **Timeouts**: 
   - Las respuestas típicas toman 30-90 segundos
   - Para preguntas complejas, usar timeout de 300000 (5 min)
   - El timeout máximo permitido es 300000 ms

3. **Errores temporales**: Si falla con error 500, reintentar con la misma pregunta (puede ser error temporal de la página CREG).

4. **Rate limiting**: Si la cola está llena (429), esperar 2-3 segundos antes de reintentar.

5. **Contenido válido**: El asistente CREG responde sobre:
   - Regulación de energía eléctrica en Colombia
   - Regulación de gas natural
   - Tarifas y precios
   - Confiabilidad del sistema eléctrico
   - Mercados de energía
   - Normativa CREG

### Cómo Integrar en un Asistente

```python
class CregAssistant:
    def __init__(self, api_url="http://localhost:3000"):
        self.api_url = api_url
        self.cache = {}
    
    def ask(self, question):
        # Usar cache si ya se preguntó algo similar
        question_key = question.lower().strip()
        if question_key in self.cache:
            return self.cache[question_key]
        
        response = requests.post(
            f"{self.api_url}/api/ask",
            json={"question": question}
        )
        data = response.json()
        
        if data["success"]:
            self.cache[question_key] = data["data"]["content"]
            return data["data"]["content"]
        else:
            raise Exception(data["error"])
```

---

## Comandos de Administración

```bash
# Ver logs en tiempo real
docker logs -f creg-api-container

# Ver logs de los últimos 100 líneas
docker logs --tail 100 creg-api-container

# Detener el contenedor
docker stop creg-api-container

# Iniciar el contenedor
docker start creg-api-container

# Reiniciar el contenedor
docker restart creg-api-container

# Ver estado
docker ps | grep creg

# Ver uso de recursos
docker stats creg-api-container

# Eliminar y recrear (reinstalación completa)
docker rm -f creg-api-container
./clients/creg-client/deploy.sh
```

---

## Arquitectura

```
                    ┌─────────────────┐
                    │   Cliente API    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Express.js   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌─────▼─────┐       ┌─────▼─────┐
    │ Pool 1  │        │ Pool 2   │  ... │ Pool N    │
    │Browser  │        │Browser   │       │Browser    │
    └────┬────┘        └─────┬─────┘       └─────┬─────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │  CREG Website  │
                    │  (gestorno...) │
                    └─────────────────┘
```

- **Pool**: Múltiples navegadores chromium para atender requests en paralelo
- **Cola**: Cuando el pool está ocupado, los requests se encolan
- **Cache**: Respuestas almacenadas por 1 hora para evitar repetir llamadas

---

## Puerto

Puerto por defecto: `3000`
