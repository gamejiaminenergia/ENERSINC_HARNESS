#!/usr/bin/env bash
# Diagnóstico del ENERSINC Harness: requisitos, checkout de dsh, marca y CREG.
#
#   ./scripts/doctor.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH="$HERE/vendor/deepseek-harness"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
CREG_URL="${CREG_URL:-http://127.0.0.1:${CREG_PORT:-3100}}"
BRAND="$DSH/packages/client/ui-brand-enersinc"

pass=0
fail=0
ok()   { printf '  ✓ %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  ✗ %s\n' "$1"; fail=$((fail + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }

echo "ENERSINC Harness — doctor"
echo "repo: $HERE"

echo "[requisitos]"
have git && ok "git $(git --version | awk '{print $3}')" || bad "git no encontrado"
if have node; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 22 ] && ok "node $(node -v)" || bad "node $(node -v) (< 22)"
else
  bad "node no encontrado"
fi
have corepack && ok "corepack" || bad "corepack no encontrado (viene con Node)"

echo "[harness]"
[ -d "$DSH/.git" ] && ok "checkout de dsh presente" || bad "falta $DSH (corre ./scripts/setup.sh)"
if [ -f "$DSH/apps/web/dist/index.html" ]; then
  ok "web compilada (apps/web/dist)"
else
  bad "web sin compilar (corre ./scripts/setup.sh)"
fi

echo "[marca ENERSINC]"
if [ -d "$BRAND" ]; then
  ok "plugin copiado en packages/client/ui-brand-enersinc"
  grep -q 'ui-brand-enersinc' "$DSH/tsconfig.client.json" 2>/dev/null \
    && ok "tsconfig.client.json referencia el plugin" \
    || bad "tsconfig.client.json sin la referencia de marca"
  grep -q '@enersinc/dsh-client-ui-brand-enersinc' "$DSH/tsconfig.base.json" 2>/dev/null \
    && ok "tsconfig.base.json tiene los path mappings" \
    || bad "tsconfig.base.json sin los path mappings de marca"
else
  bad "overlay de marca no aplicado (corre ./scripts/setup.sh)"
fi

echo "[CREG]"
if [ -d "$HERE/services/creg/node_modules" ]; then
  ok "dependencias del servicio CREG instaladas"
else
  bad "servicio CREG sin dependencias (corre ./scripts/setup.sh)"
fi
if curl -sf "$CREG_URL/health" >/dev/null 2>&1; then
  ok "servicio CREG responde en $CREG_URL"
elif have node && [ -d "$HERE/services/creg/node_modules" ]; then
  ok "servicio CREG instalado pero no está corriendo (lo levanta scripts/run.sh o web.sh)"
else
  bad "servicio CREG no disponible"
fi

echo
echo "resultado: $pass ok, $fail problema(s)"
[ "$fail" -eq 0 ]
