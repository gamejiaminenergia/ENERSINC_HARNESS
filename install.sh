#!/usr/bin/env sh
# ENERSINC Harness — instalador para macOS / Linux / Git Bash (Windows).
#
#   curl -fsSL https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.sh | sh
#
# Clona (o actualiza) este repo y ejecuta el setup completo: congela DeepSeek
# Harness, aplica la marca ENERSINC a la Web UI, y deja la capacidad CREG activa
# por defecto en el perfil `enersinc`.
#
# Variables de entorno:
#   ENERSINC_HOME       directorio del checkout   (default: ~/.enersinc-harness)
#   ENERSINC_REPO       URL git del repo          (default: github.com/gamejia/enersinc-harness)
#   ENERSINC_REF        rama o tag                (default: main)
#   DSH_CLIENT_TITLE    título de la pestaña       (default: ENERSINC Harness)
#   ENERSINC_SKIP_BRAND =1 omite el overlay de marca
set -eu

REPO="${ENERSINC_REPO:-https://github.com/gamejia/enersinc-harness.git}"
REF="${ENERSINC_REF:-main}"
HOME_DIR="${ENERSINC_HOME:-$HOME/.enersinc-harness}"

say() { printf '%s\n' "$*"; }
err() { printf '%s\n' "$*" >&2; }
die() { err "✗ $*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "falta '$1'. $2"; }

say "[enersinc] verificando requisitos ..."
need git "Instálalo desde https://git-scm.com/downloads"
need node "Instala Node.js >= 24 (recomendado: nvm, https://github.com/nvm-sh/nvm)"
need bash "El setup del harness corre con bash (en Windows, Git Bash)."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || die "Node $(node -v) es demasiado viejo; se requiere >= 22 (recomendado 24)."

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
else
  err "aviso: no encontré 'corepack'; el setup intentará usarlo igual (viene con Node)."
fi

say "[enersinc] destino: $HOME_DIR"
if [ -d "$HOME_DIR/.git" ]; then
  say "[enersinc] actualizando a '$REF' ..."
  git -C "$HOME_DIR" fetch --depth 1 origin "$REF"
  git -C "$HOME_DIR" checkout -q --detach FETCH_HEAD
else
  say "[enersinc] clonando $REPO ('$REF') ..."
  mkdir -p "$(dirname "$HOME_DIR")"
  git clone --branch "$REF" --depth 1 "$REPO" "$HOME_DIR"
fi

say "[enersinc] ejecutando el setup (marca ENERSINC + CREG por defecto) ..."
cd "$HOME_DIR"
exec bash ./scripts/setup.sh
