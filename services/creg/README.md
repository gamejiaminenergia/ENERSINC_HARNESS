# CREG AI Client

Cliente para interactuar con el asistente de IA de la Comisión de Regulación de Energía y Gas (CREG) de Colombia.

> La web de la CREG migró a "Alejandría 2.0" (Angular): ya no publica la
> respuesta en un iframe. Este cliente es compatible con la versión nueva y
> además consulta la API que usa esa web, sin abrir navegador.

## Modos de consulta

| Modo | Descripción |
|------|-------------|
| `auto` (default) | API directa y, si falla, navegador headless |
| `direct` | Sólo API directa (~12-20 s, sin Chromium) |
| `browser` | Sólo navegador headless (comportamiento histórico) |

Se elige con la variable de entorno `CREG_MODE`, por ejemplo:

```bash
CREG_MODE=direct node creg-client.js "¿Qué es la CREG?"
```

## Uso

```bash
npm install
npx playwright install chromium   # sólo si vas a usar el modo browser
node creg-client.js "tu pregunta aquí"
```

## Ejemplo

```bash
node creg-client.js "Qué es el Mecanismo de Sostenimiento de la Confiabilidad?"
```

## API

```javascript
const CregAI = require('./creg-client');

const client = new CregAI({ headless: false, mode: 'auto' }); // mostrar navegador

// Una pregunta
const response = await client.ask('Tu pregunta');
console.log(client.format(response));

// Cerrar navegador
await client.close();
```

## Opciones

- `mode`: String (default: `auto`) - `auto`, `direct` o `browser`
- `headless`: Boolean (default: true) - Mostrar navegador o no
- `timeout`: Number (default: 180000) - Timeout en ms

## Respuestas

`ask()` devuelve `{ title, content, rawHtml, links, lists }`. El wrapper
`./creg-wrapper.sh "pregunta"` guarda la respuesta en `responses/`.
