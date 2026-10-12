#!/usr/bin/env bash
# Setup de ENERSINC Harness: congela dsh, aplica la marca ENERSINC a la Web UI,
# instala todo y deja los perfiles con las herramientas creg_* activas por defecto.
#
#   ./scripts/setup.sh
#
# Variables:
#   DSH_HOME            directorio del harness del usuario (default: ~/.dsh)
#   DSH_CLIENT_TITLE    título de la pestaña del navegador (default: "ENERSINC Harness")
#   ENERSINC_SKIP_BRAND =1 para omitir el overlay de marca
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck disable=SC1091
source ./dsh.lock
DSH="$HERE/vendor/deepseek-harness"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PNPM="${PNPM:-corepack pnpm@11.28.5}"
export DSH_CLIENT_TITLE="${DSH_CLIENT_TITLE:-ENERSINC Harness}"

echo "[1/7] Congelando DeepSeek Harness ($DSH_VERSION / $DSH_COMMIT) ..."
if [ ! -d "$DSH/.git" ]; then
  mkdir -p "$HERE/vendor"
  git clone --branch "$DSH_TAG" --depth 1 "$DSH_REPOSITORY" "$DSH"
fi
got="$( cd "$DSH" && git rev-parse HEAD )"
if [ "$got" != "$DSH_COMMIT" ]; then
  echo "  AVISO: el commit descargado ($got) no coincide con dsh.lock ($DSH_COMMIT)."
else
  echo "  commit verificado: $got"
fi

echo "[2/7] Aplicando la marca ENERSINC a la Web UI ..."
if [ "${ENERSINC_SKIP_BRAND:-0}" = "1" ]; then
  echo "  omitido (ENERSINC_SKIP_BRAND=1)"
else
  node "$HERE/scripts/brand/apply.mjs" --harness "$DSH"
fi

echo "[3/7] Instalando y compilando el harness (DSH_CLIENT_TITLE=$DSH_CLIENT_TITLE) ..."
( cd "$DSH" && $PNPM install --no-frozen-lockfile && $PNPM run build )

echo "[4/7] Configurando .env ..."
if [ ! -f .env ]; then cp .env.example .env; echo "  creado .env (pega tu DEEPSEEK_API_KEY)"; fi
[ -f "$DSH/.env" ] || cp .env "$DSH/.env" 2>/dev/null || true

echo "[5/7] Dependencias del workspace y del servicio CREG ..."
$PNPM install
if [ ! -d services/creg/node_modules ]; then
  ( cd services/creg && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null 2>&1 )
  echo "  servicio CREG instalado (modo direct, sin Chromium)"
fi

echo "[6/7] Creando perfiles enersinc (web) y enersinc-cli (headless) con CREG activo ..."
( cd "$DSH" && $PNPM dsh --profile enersinc     --from-default-profile web      --dump-config >/dev/null 2>&1 || true )
( cd "$DSH" && $PNPM dsh --profile enersinc-cli --from-default-profile headless --dump-config >/dev/null 2>&1 || true )
( cd "$DSH" && $PNPM dsh plugin --profile enersinc     add "$HERE/packages/dsh-bundle-creg" ) \
  || echo "  aviso: no pude registrar el bundle creg en el perfil enersinc (¿ya estaba?)."
( cd "$DSH" && $PNPM dsh plugin --profile enersinc-cli add "$HERE/packages/dsh-bundle-creg" ) \
  || echo "  aviso: no pude registrar el bundle creg en el perfil enersinc-cli (¿ya estaba?)."

echo "[7/7] Skills y overlay MCP ..."
mkdir -p "$DSH_HOME/skills"
cp -R "$HERE/skills/." "$DSH_HOME/skills/"
sed "s#__ENERSINC_HARNESS__#$HERE#g" "$HERE/patches/creg.cordis.yml.tmpl" > "$HERE/patches/creg.cordis.yml"

echo
echo "Listo. La capacidad CREG queda activa por defecto en el perfil 'enersinc'."
echo "Prueba:"
echo "  $HERE/scripts/run.sh \"Usa creg_ask para preguntar 'Que es la CREG?'\""
echo "  $HERE/scripts/web.sh    # interfaz web (logo ENERSINC incluido)"
