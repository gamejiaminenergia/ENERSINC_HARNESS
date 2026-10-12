#!/usr/bin/env bash
# Setup de ENERSINC Harness: congela dsh, aplica la marca ENERSINC a la Web UI,
# instala todo, deja los perfiles con las herramientas creg_* activas por defecto
# y pide (si hace falta) la llave del modelo.
#
#   ./scripts/setup.sh
#
# Variables:
#   DEEPSEEK_API_KEY    si ya la tienes, se usa y no se pregunta
#   DSH_HOME            carpeta del harness del usuario (default: ~/.dsh)
#   DSH_CLIENT_TITLE    titulo de la pestana del navegador (default: ENERSINC Harness)
#   ENERSINC_SKIP_BRAND =1 para omitir el overlay de marca
#   ENERSINC_FORCE_KEY  =1 para volver a preguntar la llave aunque ya exista
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck source=scripts/lib.sh
. "$HERE/scripts/lib.sh"

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

echo "[2/7] Aplicando la marca ENERSINC a la interfaz ..."
if [ "${ENERSINC_SKIP_BRAND:-0}" = "1" ]; then
  echo "  omitido (ENERSINC_SKIP_BRAND=1)"
else
  node "$HERE/scripts/brand/apply.mjs" --harness "$DSH"
fi

echo "[3/7] Instalando y compilando el harness (DSH_CLIENT_TITLE=$DSH_CLIENT_TITLE) ..."
( cd "$DSH" && $PNPM install --no-frozen-lockfile && $PNPM run build )

echo "[4/7] Configurando tu llave del modelo ..."
if save_api_key_from_prompt "$HERE/.env" "${ENERSINC_FORCE_KEY:-}"; then
  echo "  llave guardada en este equipo. No se comparte con nadie."
else
  echo "  AVISO: seguimos sin llave. Cuando la tengas, corre: ./scripts/setup-key.sh"
fi
cp -f "$HERE/.env" "$DSH/.env" 2>/dev/null || true

echo "[5/7] Dependencias del servicio CREG ..."
$PNPM install
if [ ! -d services/creg/node_modules ]; then
  ( cd services/creg && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null 2>&1 )
  echo "  servicio CREG instalado (modo direct, sin navegador)"
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
echo "¡Listo! Ya puedes hablar con el asistente."
echo
echo "  Para abrir la ventana del asistente (interfaz web):"
echo "      $HERE/scripts/web.sh"
echo
echo "  Para hacerle una pregunta y ver la respuesta aqui mismo:"
echo "      $HERE/scripts/run.sh \"Pregunta a la CREG que es la CREG\""
