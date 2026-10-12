#!/usr/bin/env bash
# Instala los complementos (CREG) en un perfil de DeepSeek Harness.
#
#   ./scripts/install.sh
#   PROFILE=company DSH_DIR=../deepseek-harness ./scripts/install.sh
#
# Pasos: inicializa el perfil, instala los bundles (plugin nativo), copia los
# skills a $DSH_HOME/skills, regenera los overlays MCP y asegura las
# dependencias del servicio CREG.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH="${DSH_DIR:-$HERE/../deepseek-harness}"
MONEDA="${MONEDA_DIR:-$HERE/../MONEDA}"
PROFILE="${PROFILE:-company}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PNPM="${PNPM:-corepack pnpm@11.28.5}"

[ -d "$DSH" ] || { echo "No encuentro DeepSeek Harness en $DSH (usa DSH_DIR=...)"; exit 1; }

echo "[1/5] Inicializando el perfil '$PROFILE' desde la plantilla headless ..."
( cd "$DSH" && $PNPM dsh --profile "$PROFILE" --from-default-profile headless --dump-config >/dev/null 2>&1 || true )

echo "[2/5] Instalando los bundles (CREG) ..."
( cd "$DSH" && $PNPM dsh plugin --profile "$PROFILE" add "$HERE/packages/dsh-bundle-creg" )

echo "[3/5] Copiando skills a $DSH_HOME/skills ..."
mkdir -p "$DSH_HOME/skills"
cp -R "$HERE/skills/." "$DSH_HOME/skills/"

echo "[4/5] Regenerando el overlay MCP ..."
sed "s#__COMPANY_HARNESS__#$HERE#g" "$HERE/patches/creg.cordis.yml.tmpl" > "$HERE/patches/creg.cordis.yml"

echo "[5/5] Asegurando dependencias del servicio CREG ..."
if [ -d "$MONEDA/regulatorio" ] && [ ! -d "$MONEDA/regulatorio/node_modules" ]; then
  echo "  instalando dependencias de regulatorio (sin descargar Chromium; se usa modo direct) ..."
  ( cd "$MONEDA/regulatorio" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null 2>&1 ) \
    && echo "  listo" || echo "  aviso: no pude instalar regulatorio; creg_* no funcionara hasta instalarlo"
fi

echo
echo "Listo. Prueba con:"
echo "  $HERE/scripts/run.sh \"Que es el Mecanismo de Sostenimiento de la Confiabilidad\""
