# CREG AI Client — Skill para Asistentes de IA

Skill para usar el **Cliente CREG Colombia**, una herramienta que permite consultar al asistente de IA de la **Comisión de Regulación de Energía y Gas (CREG)** sobre regulación energética colombiana.

## ¿Qué puedes hacer con esta skill?

Hacer preguntas sobre regulación energética colombiana y obtener respuestas detalladas, estructuradas con título, contenido, enlaces y listas. El sistema usa un navegador Chromium invisible para conectarse al gestor normativo CREG.

---

## Requisitos previos

```bash
cd services/creg
npm install
npx playwright install chromium  # Solo la primera vez
```

> ⚠️ La **primera ejecución** es más lenta porque Playwright inicia Chromium. Las siguientes son más rápidas.

## Modo 1: CLI Directo (Consulta Rápida)

```bash
node creg-client.js "tu pregunta aquí"
```

**Ejemplo:**
```bash
node creg-client.js "¿Qué es el Mecanismo de Sostenimiento de la Confiabilidad?"
```

**Usando el wrapper** (guarda la respuesta en `responses/` como archivo `.md`):
```bash
./creg-wrapper.sh "tu pregunta aquí"
```

**Tiempo de respuesta:** 30-180 segundos (la página CREG tarda en generar la respuesta).

---

## Modo 2: Servidor API (Integración con otras IAs)

Para que otras IAs o aplicaciones consuman el servicio por HTTP:

### Iniciar el servidor
```bash
cd services/creg
node server.js
```

### Endpoints disponibles

#### `GET /health` — Verificar estado
```bash
curl http://localhost:3000/health
```
```json
{ "status": "ok", "pool": { "size": 2, "active": 0, "queued": 0, "cacheSize": 5 } }
```

#### `POST /api/ask` — Hacer una pregunta
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué es la CREG?"}'
```

**Parámetros:**
| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| question | string | Sí | — | Pregunta (máx 2000 chars) |
| timeout | integer | No | 180000 | Timeout en ms (30s-300s) |

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "title": "Concepto: ...",
    "content": "Respuesta detallada...",
    "rawHtml": "<div>...</div>",
    "links": [{ "text": "Ver norma", "href": "https://..." }],
    "lists": [["Item 1", "Item 2"]]
  }
}
```

#### `GET /api/stats` — Estadísticas del pool
```bash
curl http://localhost:3000/api/stats
```
Devuelve estado del pool de navegadores, cola y caché.

#### `POST /api/pool/recycle` — Reciclar navegadores
```bash
curl -X POST http://localhost:3000/api/pool/recycle -H "Content-Type: application/json" -d '{}'
```

#### `GET /api/cache/clear` — Limpiar caché
```bash
curl http://localhost:3000/api/cache/clear
```

---

## Integración desde código (para otras IAs)

### Python
```python
import requests

def ask_creg(question, timeout=180000):
    resp = requests.post(
        "http://localhost:3000/api/ask",
        json={"question": question, "timeout": timeout},
        timeout=timeout/1000 + 10
    )
    data = resp.json()
    if data.get("success"):
        return data["data"]["content"]
    raise Exception(data.get("error", "Unknown error"))
```

### JavaScript / Node.js
```javascript
async function askCreg(question, timeout = 180000) {
  const r = await fetch("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, timeout })
  });
  const data = await r.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}
```

---

## Configuración por variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | 3000 | Puerto del servidor |
| `POOL_SIZE` | 2 | Navegadores en paralelo |
| `QUEUE_LIMIT` | 10 | Máximo en cola de espera |
| `TIMEOUT` | 180000 | Timeout por request (ms) |
| `CACHE_MAX_AGE` | 3600000 | Vida del caché (ms, 1 hora) |
| `MAX_FAILED` | 3 | Fallos antes de reciclar browser |
| `HEALTH_INTERVAL` | 60000 | Cada cuánto revisar salud (ms) |
| `BASE_URL` | (CREG) | URL del gestor normativo CREG |

---

## Arquitectura

```
Cliente HTTP → Express.js → Pool de Browsers Chromium → CREG Website
                              ├── Pool 1 (browser)
                              ├── Pool 2 (browser)
                              └── Pool N (browser)
```

- **Pool**: Múltiples navegadores headless para atender requests en paralelo
- **Cola**: Cuando el pool está ocupado, los requests se encolan
- **Caché**: Respuestas almacenadas por 1 hora (hash de la pregunta normalizada)
- **Health Checks**: Cada 60s se verifica que los browsers estén vivos
- **Auto-recuperación**: Si un browser falla >3 veces, se recicla automáticamente

---

## Manejo de errores

| Código | Error | Causa | Solución |
|--------|-------|-------|----------|
| 400 | "Question is required" | No se envió pregunta | Incluir campo `question` |
| 429 | "Server busy" | Cola llena | Reintentar en 2-3s |
| 500 | "No iframe found" | CREG no respondió | Reintentar (el cliente ya lo hace automático 3 veces) |
| 504 | Timeout | Respuesta muy lenta | Aumentar timeout o reintentar |

El cliente ya incluye **3 reintentos automáticos** con exponential backoff (~2-3s → ~4-5s).

---

## Buenas prácticas para otras IAs

1. **Preguntas consistentes** para maximizar hits de caché (ignora mayúsculas y espacios)
2. **Timeout de 180s** para preguntas normales, **300s** para preguntas complejas
3. Si recibes error 504 (timeout), reintenta con la misma pregunta
4. El sistema responde sobre: regulación energía/gas, tarifas, confiabilidad, mercados, normativa CREG
5. Una vez inicies el servidor con `node server.js`, úsalo por HTTP — no inicies múltiples instancias del CLI

---

## Docker

```bash
# Build
docker build -t creg-api .

# Run (requiere --shm-size=2gb para Chromium)
docker run -d \
  --name creg-api \
  -p 3000:3000 \
  --shm-size=2gb \
  creg-api

# Con variables de entorno
docker run -d \
  --name creg-api \
  -p 3000:3000 \
  --shm-size=2gb \
  -e POOL_SIZE=3 \
  -e TIMEOUT=300000 \
  creg-api
```
