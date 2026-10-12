#!/usr/bin/env bash
# Pide la llave del modelo y la guarda. Usalo cuando te cambien la llave o si
# el instalador no la pidio.
#
#   ./scripts/setup-key.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck source=scripts/lib.sh
. "$HERE/scripts/lib.sh"
DSH="$HERE/vendor/deepseek-harness"

if save_api_key_from_prompt "$HERE/.env" force; then
  echo "  llave guardada en este equipo. No se comparte con nadie."
  [ -d "$DSH" ] && cp -f "$HERE/.env" "$DSH/.env" 2>/dev/null || true
else
  echo "  no se guardo ninguna llave."
  exit 1
fi
