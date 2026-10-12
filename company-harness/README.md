# company-harness

Complementos del equipo para **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)**
(`dsh`). Cada capacidad es un **plugin + skill** que se enchufa al harness.

> **Principio rector:** complementamos `dsh`; **nos adaptamos a él, no al revés.**
> No tocamos su núcleo. Todo lo nuestro es plugin + skill + perfil.

## Capacidades

| Capacidad | Servicio | Herramientas | Ruta de datos |
| --- | --- | --- | --- |
| **CREG** | `MONEDA/regulatorio/` (Express, :3100) | `creg_health`, `creg_ask`, `creg_stats` | asistente CREG |

## Qué hay aquí

| Pieza | Ruta |
| --- | --- |
| Puente **MCP** (camino rápido) | `packages/mcp-creg/` |
| Plugin **nativo** (bundle instalable) | `packages/dsh-bundle-creg/` |
| **Skill** | `skills/uso-de-creg/` |
| Overlay **MCP** | `patches/creg.cordis.yml` |
| **Scripts** | `scripts/install.sh`, `scripts/run.sh` |

## Requisitos

- Node ≥ 24 y `pnpm` (los scripts usan `corepack pnpm@11.28.5`).
- **DeepSeek Harness** clonado y compilado (por defecto: `../deepseek-harness`).
- **`MONEDA`** a lado (por defecto: `../MONEDA`).
- Una **`DEEPSEEK_API_KEY`** en `deepseek-harness/.env`.

## Arrancar

```bash
./scripts/install.sh                       # perfil company + plugin + skill + deps del CREG

./scripts/run.sh "Pregunta a la CREG qué es el Mecanismo de Sostenimiento de la Confiabilidad"

# interfaz web (sin argumentos)
./scripts/run.sh
```

Variables útiles: `MODE=native|mcp`, `CREG_PORT` (3100),
`CREG_MODE=direct|auto|browser` (default `direct`, sin Chromium).

## Los dos caminos

| | Camino rápido (MCP) | Camino nativo (perfil) |
| --- | --- | --- |
| Cómo | `MODE=mcp ./scripts/run.sh …` | `./scripts/run.sh …` |
| Tools | `mcp__creg__*` | `creg_*` |
| Ventaja | Cero código Cordis; valida rápido | PTC, tarjetas de UI, config nativa |
| Cuándo | Probar | Distribuir al equipo |

## Verificación

```bash
# CREG: respuesta real del asistente
./scripts/run.sh "Usa creg_ask para preguntar '¿Qué es la CREG?'"
```

## Notas

- **Puerto CREG = 3100** a propósito: el 3000 suele estar ocupado (p. ej. por `jevlog`).
- El modelo CREG por defecto es **`direct`** (sin Chromium). `browser` requiere
  `npx playwright install chromium`.
- **Nada de esto toca** el núcleo de `dsh` ni el código de `MONEDA` (solo se
  *ejecutan* sus servicios).
