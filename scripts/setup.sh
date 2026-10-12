#!/usr/bin/env bash
# Setup del ENERSINC Harness (envoltorio). Toda la lógica vive en setup.cjs para
# que sea idéntica en Windows, macOS y Linux.
#
#   ./scripts/setup.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$HERE/scripts/setup.cjs" "$@"
