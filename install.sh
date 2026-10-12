#!/usr/bin/env sh
# ENERSINC Harness — instalador para macOS / Linux / Git Bash (Windows).
# Descarga/actualiza este repo y ejecuta el setup (Node).
#
#   curl -fsSL https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.sh | sh
#
# En Windows, usa install.ps1 (o el comando universal con Node que está en el README).
#
# Variables de entorno:
#   ENERSINC_HOME   directorio del checkout  (default: ~/.enersinc-harness)
#   ENERSINC_REPO   URL git del repo         (default: github.com/gamejia/enersinc-harness)
#   ENERSINC_REF    rama o tag               (default: main)
set -eu

REPO="${ENERSINC_REPO:-https://github.com/gamejia/enersinc-harness.git}"
REF="${ENERSINC_REF:-main}"
HOME_DIR="${ENERSINC_HOME:-$HOME/.enersinc-harness}"

say() { printf '%s\n' "$*"; }
die() { printf '%s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "✗ falta '$1'. $2"; }

say "[enersinc] verificando requisitos ..."
need git "Instálalo desde https://git-scm.com/downloads"
need node "Instala Node.js >= 22 (recomendado 24): https://nodejs.org"

major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 22 ] || die "✗ Node $(node -v) es muy viejo; se requiere >= 22 (recomendado 24)."

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

exec node "$HOME_DIR/scripts/setup.cjs"
