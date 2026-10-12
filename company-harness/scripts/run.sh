#!/usr/bin/env bash
# Un solo comando: levanta el/los servicio(s) y arranca DeepSeek Harness.
#
#   ./scripts/run.sh "<tarea>"          -> responde una tarea y sale (headless)
#   ./scripts/run.sh                    -> abre la Web UI (http://127.0.0.1:3080)
#   MODE=mcp ./scripts/run.sh "..."     -> usa el puente MCP en vez del plugin nativo
#
# Variables: MONEDA_DIR, DSH_DIR, PROFILE, CREG_PORT,
# CREG_MODE (direct|auto|browser), MODE (native|mcp).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONEDA="${MONEDA_DIR:-$HERE/../MONEDA}"
DSH="${DSH_DIR:-$HERE/../deepseek-harness}"
PROFILE="${PROFILE:-company}"
MODE="${MODE:-native}"
CREG_PORT="${CREG_PORT:-3100}"
CREG_MODE="${CREG_MODE:-direct}"
PNPM="${PNPM:-corepack pnpm@11.28.5}"
TMP="${TMPDIR:-/tmp}"

# El plugin nativo y el puente MCP leen la URL del servicio.
export CREG_URL="http://127.0.0.1:${CREG_PORT}"

[ -d "$MONEDA" ] || { echo "No encuentro el repo MONEDA en $MONEDA (usa MONEDA_DIR=...)"; exit 1; }
[ -d "$DSH" ] || { echo "No encuentro DeepSeek Harness en $DSH (usa DSH_DIR=...)"; exit 1; }

wait_health() { # url, label
  for _ in $(seq 1 80); do curl -sf "$1" >/dev/null 2>&1 && { echo "[company-harness] $2 listo"; return 0; }; sleep 0.25; done
  return 1
}

start_creg() {
  curl -sf "http://127.0.0.1:${CREG_PORT}/health" >/dev/null 2>&1 && { echo "[company-harness] CREG ya responde"; return 0; }
  if [ ! -d "$MONEDA/regulatorio/node_modules" ]; then
    echo "[company-harness] faltan dependencias de regulatorio; corre primero ./scripts/install.sh"; return 1
  fi
  echo "[company-harness] levantando el servicio CREG en :${CREG_PORT} (modo ${CREG_MODE}) ..."
  ( cd "$MONEDA/regulatorio" && PORT="$CREG_PORT" CREG_MODE="$CREG_MODE" nohup node server.js >"$TMP/company-harness-creg.log" 2>&1 & )
  wait_health "http://127.0.0.1:${CREG_PORT}/health" "CREG" || { echo "[company-harness] no pude levantar el CREG (mira $TMP/company-harness-creg.log)"; return 1; }
}

start_creg

cd "$DSH"

# Overlay MCP del servicio.
PATCH_FLAG=()
if [ "$MODE" = "mcp" ]; then
  PROFILE_FLAG=(--profile headless)
  PATCH_FLAG+=(--patch "$HERE/patches/creg.cordis.yml")
else
  PROFILE_FLAG=(--profile "$PROFILE")
fi

if [ "$#" -gt 0 ]; then
  echo "[company-harness] tarea: $*"
  exec $PNPM dsh "${PROFILE_FLAG[@]}" ${PATCH_FLAG[@]+"${PATCH_FLAG[@]}"} "$*"
else
  echo "[company-harness] abriendo la Web UI en http://127.0.0.1:3080 ..."
  exec $PNPM dsh web ${PATCH_FLAG[@]+"${PATCH_FLAG[@]}"}
fi
