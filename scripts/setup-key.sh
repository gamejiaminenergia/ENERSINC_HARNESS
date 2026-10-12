#!/usr/bin/env bash
# Pide la llave del modelo y la guarda (envoltorio de setup.cjs --key).
#
#   ./scripts/setup-key.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$HERE/scripts/setup.cjs" --key
