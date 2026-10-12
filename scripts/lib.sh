# shellcheck shell=bash
# Utilidades compartidas por los scripts del ENERSINC Harness.
# Se cargan con: . "$HERE/scripts/lib.sh"

# Escribe/actualiza CLAVE=VALOR en un archivo tipo .env (sin depender de sed BSD/GNU).
set_env() { # archivo clave valor
  node - "$1" "$2" "$3" <<'NODE'
const fs = require('fs')
const [file, key, value] = process.argv.slice(2)
let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
const line = `${key}=${value}`
const re = new RegExp(`^${key}=.*$`, 'm')
text = re.test(text) ? text.replace(re, line) : text + (text && !text.endsWith('\n') ? '\n' : '') + `${line}\n`
fs.writeFileSync(file, text)
NODE
}

# Muestra el mensaje que explica para qué es la llave.
announce_key_need() {
  echo
  echo "  Hace falta tu llave de DeepSeek para que el asistente pueda responder."
  echo "  Empieza con 'sk-'. Pegala abajo y pulsa Enter (no se vera en pantalla)."
}

# Lee la llave por el terminal real; funciona aunque el script venga por una
# tuberia (como en `curl ... | sh`). Imprime la llave (o vacio si no hay terminal).
read_api_key() {
  local key="" old_tty=""
  if [ -t 0 ]; then
    read -rs -p '  Llave: ' key && printf '\n' || printf '\n'
  elif [ -r /dev/tty ]; then
    printf '  Llave: ' > /dev/tty
    old_tty="$(stty -g < /dev/tty 2>/dev/null || true)"
    stty -echo < /dev/tty 2>/dev/null || true
    IFS= read -r key < /dev/tty || key=""
    if [ -n "$old_tty" ]; then stty "$old_tty" < /dev/tty 2>/dev/null || true; else stty echo < /dev/tty 2>/dev/null || true; fi
    printf '\n' > /dev/tty
  fi
  printf '%s' "$key"
}

# Asegura que el archivo .env tenga la llave; la pide si falta.
#   save_api_key_from_prompt <archivo-env> [forzar]
# Devuelve 0 si quedo una llave, 1 si el usuario no la dio.
save_api_key_from_prompt() {
  local file="$1" force="${2:-}" key="" existing=""
  if [ ! -f "$file" ]; then
    if [ -f "$(dirname "$file")/.env.example" ]; then cp "$(dirname "$file")/.env.example" "$file"; else : > "$file"; fi
  fi
  existing="$(sed -n 's/^DEEPSEEK_API_KEY=//p' "$file" | head -1)"
  key="${DEEPSEEK_API_KEY:-$existing}"
  [ -n "$force" ] && key=""
  if [ -z "$key" ]; then
    announce_key_need
    key="$(read_api_key)"
    echo
  fi
  [ -n "$key" ] || return 1
  set_env "$file" DEEPSEEK_API_KEY "$key"
  return 0
}
