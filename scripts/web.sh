#!/usr/bin/env bash
# Interfaz web del harness. Levanta el servicio CREG y abre la UI en el navegador.
#
#   ./scripts/web.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck disable=SC1091
[ -f .env ] && { set -a; . ./.env; set +a; }
DSH="$HERE/vendor/deepseek-harness"
PNPM="${PNPM:-corepack pnpm@11.28.5}"
CREG_PORT="${CREG_PORT:-3100}"
CREG_MODE="${CREG_MODE:-direct}"
export CREG_URL="${CREG_URL:-http://127.0.0.1:${CREG_PORT}}"

[ -d "$DSH" ] || { echo "Falta el harness; corre ./scripts/setup.sh"; exit 1; }

if ! curl -sf "http://127.0.0.1:${CREG_PORT}/health" >/dev/null 2>&1; then
  echo "[enersinc] levantando el servicio CREG en :${CREG_PORT} (modo ${CREG_MODE}) ..."
  ( cd "$HERE/services/creg" && PORT="$CREG_PORT" CREG_MODE="$CREG_MODE" nohup node server.js >/tmp/enersinc-creg.log 2>&1 & )
  for _ in $(seq 1 80); do curl -sf "http://127.0.0.1:${CREG_PORT}/health" >/dev/null 2>&1 && break; sleep 0.25; done
fi
curl -sf "http://127.0.0.1:${CREG_PORT}/health" >/dev/null 2>&1 \
  || { echo "[enersinc] no pude levantar el CREG (mira /tmp/enersinc-creg.log)"; exit 1; }
echo "[enersinc] servicio CREG listo en :${CREG_PORT}"

cd "$DSH"
exec $PNPM dsh --profile enersinc --no-open
