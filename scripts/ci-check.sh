#!/usr/bin/env bash
# Verificaciones de CI para ENERSINC Harness (sin depender de la red).
#
#   bash scripts/ci-check.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
fails=0
check() { # describe, command...
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  ✓ %s\n' "$desc"
  else
    printf '  ✗ %s\n' "$desc"; fails=$((fails + 1))
  fi
}

echo "[1/4] Sintaxis de los scripts de shell"
for f in install.sh scripts/setup.sh scripts/setup-key.sh scripts/run.sh scripts/web.sh scripts/doctor.sh scripts/ci-check.sh; do
  check "bash -n $f" bash -n "$f"
done

echo "[2/4] Sintaxis de los módulos Node"
for f in install.cjs scripts/setup.cjs scripts/brand/apply.mjs scripts/brand/gen-logo.mjs; do
  check "node --check $f" node --check "$f"
done

echo "[3/4] El generador de logo produce el componente"
tmp_logo="$(mktemp -d)"
if node scripts/brand/gen-logo.mjs \
     --svg branding/enersinc-logo.svg \
     --out "$tmp_logo/EnersincLogo.tsx" >/dev/null 2>&1 \
   && grep -q 'export function EnersincLogo' "$tmp_logo/EnersincLogo.tsx"; then
  printf '  ✓ gen-logo.mjs\n'
else
  printf '  ✗ gen-logo.mjs\n'; fails=$((fails + 1))
fi
rm -rf "$tmp_logo"

echo "[4/4] apply.mjs contra un checkout de harness de prueba"
tmp="$(mktemp -d)"
mkdir -p "$tmp/packages/client/ui-brand-official"
cat > "$tmp/tsconfig.client.json" <<'JSON'
{
  "references": [
    { "path": "./packages/client/ui-sidebar" },
    { "path": "./packages/client/ui-brand-official" },
    { "path": "./packages/client/ui-approval" }
  ]
}
JSON
cat > "$tmp/tsconfig.base.json" <<'JSON'
{
  "compilerOptions": {
    "paths": {
      "@deepseek-ai/dsh-client-ui-sidebar": ["./packages/client/ui-sidebar/src"],
      "@deepseek-ai/dsh-client-ui-brand-official": ["./packages/client/ui-brand-official/src"],
      "@deepseek-ai/dsh-client-ui-approval": ["./packages/client/ui-approval/src"]
    }
  }
}
JSON
if node scripts/brand/apply.mjs --harness "$tmp" >/dev/null 2>&1 \
   && [ -f "$tmp/packages/client/ui-brand-enersinc/package.json" ] \
   && grep -q 'ui-brand-enersinc' "$tmp/tsconfig.client.json" \
   && grep -q '@enersinc/dsh-client-ui-brand-enersinc' "$tmp/tsconfig.base.json"; then
  printf '  ✓ overlay aplicado correctamente\n'
else
  printf '  ✗ overlay NO aplicado correctamente\n'; fails=$((fails + 1))
fi
# idempotencia
if node scripts/brand/apply.mjs --harness "$tmp" >/dev/null 2>&1 \
   && [ "$(grep -c 'ui-brand-enersinc' "$tmp/tsconfig.client.json")" -eq 1 ]; then
  printf '  ✓ overlay idempotente\n'
else
  printf '  ✗ overlay no idempotente\n'; fails=$((fails + 1))
fi
rm -rf "$tmp"

echo
if [ "$fails" -eq 0 ]; then
  echo "ci-check: todo ok"
else
  echo "ci-check: $fails fallo(s)"
  exit 1
fi
