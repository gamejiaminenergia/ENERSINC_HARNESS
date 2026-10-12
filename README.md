# ENERSINC Harness

[![Harness](https://img.shields.io/badge/DeepSeek%20Harness-dsh--v0.2.1--alpha.2-0D86C9)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](https://nodejs.org)
[![Plataformas](https://img.shields.io/badge/OS-macOS%20%7C%20Linux%20%7C%20Windows-9cf)](#instalación)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **DeepSeek Harness** congelado, con la **marca ENERSINC** en la Web UI y la
> capacidad **CREG** (regulación energética colombiana) activa por defecto.

Este repo **no forkea** el harness: lo usa tal cual y demuestra que **se deja
modificar** — la marca ENERSINC se integra como un *plugin de cliente* en el
sistema de slots del Web UI, y la CREG como un *bundle* de herramientas nativas
(`creg_ask`, `creg_health`, `creg_stats`).

```
┌──────────────────────────────────────────────────────────────┐
│  🐳 DeepSeek Harness ──│── ENERSINC        ← marca en la UI   │
│  herramientas: creg_ask · creg_health · creg_stats            │
└──────────────────────────────────────────────────────────────┘
```

---

## Instalación

Un solo comando (clona este repo, congela el harness, aplica la marca y deja la
CREG lista y activa por defecto):

### macOS · Linux · Git Bash (Windows)

```sh
curl -fsSL https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.sh | sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.ps1 | iex
```

El instalador deja todo en `~/.enersinc-harness` (configurable con
`ENERSINC_HOME`). Al terminar:

- **crea los perfiles** `enersinc` (Web UI) y `enersinc-cli` (headless),
- **engancha** el bundle CREG en ambos perfiles,
- **instala** las dependencias del servicio CREG (modo `direct`, sin Chromium),
- **compila** el harness con el logo ENERSINC integrado.

> La primera instalación clona y compila DeepSeek Harness: tarda unos minutos y
> necesita red. Después arranca en segundos.

### Requisitos

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | ≥ 22 (recomendado 24) | el build usa *type stripping* nativo |
| pnpm | vía `corepack` | el instalador lo activa |
| git | cualquiera | para clonar el harness y este repo |
| bash | — | en Windows, viene con Git for Bash |

## Uso

```bash
cd ~/.enersinc-harness

# Interfaz web (levanta CREG y abre el navegador)
./scripts/web.sh

# Una tarea headless
./scripts/run.sh "Usa creg_ask para preguntar '¿Qué es la CREG?'"

# Diagnóstico del entorno
./scripts/doctor.sh
```

En Windows:

```powershell
cd $env:USERPROFILE\.enersinc-harness
powershell -ExecutionPolicy Bypass -File scripts\web.ps1
powershell -ExecutionPolicy Bypass -File scripts\run.ps1 "Usa creg_ask para preguntar '¿Qué es la CREG?'"
```

Antes de usar el modelo, pega tu llave en `.env`:

```dotenv
DEEPSEEK_API_KEY=sk-...
```

## Cómo se modifica la Web UI (la marca ENERSINC)

La Web UI de `dsh` compone su barra lateral con **slots**
(`sidebar.brand.mark`, `sidebar.brand.name`). Un plugin de cliente dinámico
registrado en un slot de un solo ocupante **se renderiza por encima** del
entregado de fábrica. Eso es todo lo que usamos:

```text
branding/dsh-client-ui-brand-enersinc/   ← el plugin (fuente de verdad)
        │  scripts/brand/apply.mjs lo copia a
        ▼
vendor/deepseek-harness/packages/client/ui-brand-enersinc/
        │  el build (tsdown) emite lib/client.js
        ▼
Web UI:  🐳 (marca DeepSeek intacta)  +  ENERSINC (logo nuevo)
```

- No se toca el núcleo de `dsh`: sólo se **añade** un paquete al workspace.
- El logo vive en `branding/enersinc-logo.svg` y se regenera a React con
  `pnpm brand:logo`.
- Detalles en [`docs/BRANDING.md`](docs/BRANDING.md) y en el
  [`README` del plugin](branding/dsh-client-ui-brand-enersinc/README.md).

Puedes desactivar la marca con `ENERSINC_SKIP_BRAND=1 ./scripts/setup.sh`, o
cambiar el título de la pestaña con `DSH_CLIENT_TITLE="Mi título"`.

## La capacidad CREG

El servicio `services/creg/` (Express + cliente CREG) se expone al harness de
dos formas:

| Camino | Cómo | Herramientas |
| --- | --- | --- |
| **Nativo** (default) | bundle `packages/dsh-bundle-creg` en el perfil | `creg_ask`, `creg_health`, `creg_stats` |
| **MCP** (opcional) | `MODE=mcp` monta el overlay `patches/creg.cordis.yml` | `mcp__creg__*` |

Modos del cliente: `CREG_MODE=direct` (default, sin navegador),
`auto` (API con respaldo en navegador) o `browser`. Ver
[`docs/CREG.md`](docs/CREG.md) y [`services/creg/README.md`](services/creg/README.md).

## Estructura del repo

```
install.sh · install.ps1     instaladores de una línea (POSIX / Windows)
dsh.lock                     versión congelada de DeepSeek Harness
scripts/
  setup.sh                   congela dsh, aplica la marca, configura CREG
  run.sh · web.sh            ejecución headless / interfaz web
  run.ps1 · web.ps1          equivalentes Windows
  doctor.sh                  diagnóstico del entorno
  brand/apply.mjs            aplica el overlay de marca al checkout de dsh
  brand/gen-logo.mjs         regenera el componente React del logo
branding/
  enersinc-logo.svg          logo fuente (sin metadatos C2PA)
  dsh-client-ui-brand-enersinc/  plugin de cliente (marca en la Web UI)
packages/
  dsh-bundle-creg/           plugin nativo con las herramientas creg_*
  mcp-creg/                  puente MCP hacia el servicio CREG
patches/creg.cordis.yml.tmpl overlay MCP (plantilla)
services/creg/               servicio CREG (Express + cliente)
skills/uso-de-creg/          skill que enseña al modelo a usar las creg_*
docs/                        arquitectura, marca y CREG
```

## Cómo citar el harness

Este proyecto complementa DeepSeek Harness (MIT) y se apoya en su modelo de
plugins y slots. La versión congelada está en [`dsh.lock`](dsh.lock); actualizarla
es deliberado: cambia el tag, corre `./scripts/setup.sh` y verifica con
`./scripts/doctor.sh`.

## Licencia

[MIT](LICENSE). "DeepSeek Harness" es una marca de DeepSeek; este es un proyecto
independiente de ENERSINC, no afiliado ni patrocinado por DeepSeek.
