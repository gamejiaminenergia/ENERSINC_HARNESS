# Capacidad CREG

La **CREG** (Comisión de Regulación de Energía y Gas de Colombia) tiene un
asistente de IA. Este repo lo envuelve en un servicio local y lo expone al
harness como herramientas que el modelo puede llamar.

## Servicio

`services/creg/` es un servidor Express (`server.js`) sobre `creg-client.js`.

| Endpoint | Descripción |
| --- | --- |
| `GET /health` | estado del servicio (modo y pool) |
| `POST /api/ask` | `{ "question": "..." }` → respuesta del asistente CREG |
| `GET /api/stats` | métricas de pool, cola y caché |

Por defecto escucha en `:3100` (`CREG_PORT`) — se usa 3100 porque el 3000 suele
estar ocupado.

### Modos de consulta (`CREG_MODE`)

| Modo | Comportamiento |
| --- | --- |
| `direct` *(default)* | consulta la API que usa la web; **sin navegador/Chromium** |
| `auto` | API directa y, si falla, navegador headless |
| `browser` | navegador headless (requiere `npx playwright install chromium`) |

## Integración con el harness

### Camino nativo (default)

El bundle `packages/dsh-bundle-creg` registra tres herramientas Cordis:

| Herramienta | Para qué |
| --- | --- |
| `creg_ask` | preguntar a la CREG (12–180 s) |
| `creg_health` | comprobar que el servicio responde |
| `creg_stats` | métricas del servicio |

`scripts/setup.cjs` (el instalador) lo añade a los perfiles `enersinc` y
`enersinc-cli`:

```bash
pnpm dsh plugin --profile enersinc add ./packages/dsh-bundle-creg
```

La `baseUrl` sale de `CREG_URL` (default `http://127.0.0.1:3100`).

### Camino MCP (opcional)

```bash
MODE=mcp ./scripts/run.sh "Pregunta a la CREG qué es el Mecanismo de Sostenibilidad"
```

Monta `patches/creg.cordis.yml` (generado desde `.tmpl`), que arranca el puente
`packages/mcp-creg` y publica las herramientas como `mcp__creg__*`. El timeout
de llamada es alto (300 s) porque `ask` puede tardar.

## Skill

`skills/uso-de-creg/SKILL.md` enseña al modelo **cuándo** y **cómo** usar las
herramientas (y qué no inventar). El instalador (`scripts/setup.cjs`) copia
`skills/` a
`$DSH_HOME/skills`.

## Variables

| Variable | Default | Uso |
| --- | --- | --- |
| `CREG_URL` | `http://127.0.0.1:3100` | URL del servicio (plugin y MCP) |
| `CREG_MODE` | `direct` | `direct` \| `auto` \| `browser` |
| `CREG_PORT` | `3100` | puerto del servicio local |
| `POOL_SIZE` | `2` | tamaño del pool (modo navegador) |
| `TIMEOUT` | `180000` | timeout por consulta (ms) |
