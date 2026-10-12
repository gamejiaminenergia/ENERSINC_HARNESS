'use strict'
/**
 * Setup del ENERSINC Harness, escrito en Node para correr IGUAL en Windows,
 * macOS y Linux (Debian y derivados). Es la única implementación del setup:
 * install.sh, install.ps1 e install.cjs solo lo invocan.
 *
 *   node scripts/setup.cjs        # setup completo
 *   node scripts/setup.cjs --key  # solo pedir/guardar la llave
 *
 * Variables: DEEPSEEK_API_KEY, DSH_HOME, DSH_DIR, DSH_CLIENT_TITLE,
 *            ENERSINC_SKIP_BRAND=1, ENERSINC_FORCE_KEY=1.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const readline = require('node:readline')
const { spawnSync } = require('node:child_process')

const IS_WIN = process.platform === 'win32'
const PNPM_SPEC = 'pnpm@11.28.5'
const KEY_ONLY = process.argv.includes('--key')
const FORCE_KEY = process.env.ENERSINC_FORCE_KEY === '1'

const SCRIPT_DIR = path.dirname(fs.realpathSync(__filename))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const DSH = process.env.DSH_DIR ? path.resolve(process.env.DSH_DIR) : path.join(REPO_ROOT, 'vendor', 'deepseek-harness')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const DSH_CLIENT_TITLE = process.env.DSH_CLIENT_TITLE || 'ENERSINC Harness'
const ENV_FILE = path.join(REPO_ROOT, '.env')

const log = (m) => process.stdout.write(`${m}\n`)
const fail = (m) => { process.stderr.write(`[enersinc] ${m}\n`); process.exit(1) }

/** Comilla un argumento para cmd.exe (Windows). */
function winQuote(value) {
  const s = String(value)
  return /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s
}

/** Ejecuta un comando; en Windows pasa por cmd para resolver corepack.cmd. */
function run(cmd, args, opts = {}) {
  const cwd = opts.cwd || REPO_ROOT
  const env = { ...process.env, ...(opts.env || {}) }
  const stdio = opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  const res = IS_WIN
    ? spawnSync([cmd, ...args].map(winQuote).join(' '), { shell: true, stdio, cwd, env, encoding: 'utf8' })
    : spawnSync(cmd, args, { stdio, cwd, env, encoding: 'utf8' })
  if (opts.allowFail) return res
  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falló con ${res.status ?? res.signal}`)
  return res
}

/** pnpm a través de corepack (la versión fija del repo). */
const pnpm = (args, opts) => run('corepack', [PNPM_SPEC, ...args], opts)

/** ¿Existe el comando en el PATH? */
function commandExists(cmd) {
  const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return probe.status === 0
}

/** Lee dsh.lock como pares CLAVE=VALOR. */
function readLock() {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'dsh.lock'), 'utf8')
  const out = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** Escribe/actualiza CLAVE=VALOR en un archivo tipo .env. */
function writeEnvVar(file, key, value) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`
  fs.writeFileSync(file, text)
}

const readEnvKey = () => (fs.readFileSync(ENV_FILE, 'utf8').match(/^DEEPSEEK_API_KEY=(.*)$/m) || [])[1]?.trim() || ''

/** Pide la llave sin mostrarla (o la lee del terminal, aunque venga por tubería). */
function promptHidden(label) {
  const stdin = process.stdin
  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    process.stdout.write(label)
    return new Promise((resolve) => {
      stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8')
      let buf = ''
      const cleanup = () => { stdin.removeListener('data', onData); stdin.setRawMode(false); stdin.pause() }
      const onData = (chunk) => {
        for (const ch of chunk) {
          if (ch === '\r' || ch === '\n') { cleanup(); process.stdout.write('\n'); resolve(buf); return }
          if (ch === '\u0003') { cleanup(); process.stdout.write('\n'); process.exit(130) }
          if (ch === '\u007f' || ch === '\b') { buf = buf.slice(0, -1); continue }
          if (ch >= ' ') buf += ch
        }
      }
      stdin.on('data', onData)
    })
  }
  return new Promise((resolve) => {
    let input = stdin
    try {
      if (!stdin.isTTY && !IS_WIN) input = fs.createReadStream(null, { fd: fs.openSync('/dev/tty', 'r'), autoClose: true })
    } catch { /* sin terminal: se leerá lo que haya */ }
    const rl = readline.createInterface({ input, output: process.stdout })
    rl.question(label, (answer) => { rl.close(); resolve(answer) })
  })
}

/** Asegura que .env tenga la llave; la pide si falta. Devuelve true si quedó una. */
async function ensureApiKey(force) {
  if (!fs.existsSync(ENV_FILE)) fs.copyFileSync(path.join(REPO_ROOT, '.env.example'), ENV_FILE)
  // Un valor explícito en el entorno siempre gana (permite instalación sin preguntas).
  let key = process.env.DEEPSEEK_API_KEY || (force ? '' : readEnvKey())
  if (!key) {
    log('')
    log('  Hace falta tu llave de DeepSeek para que el asistente pueda responder.')
    log("  Empieza con 'sk-'. Pegala abajo y pulsa Enter (no se vera en pantalla).")
    key = (await promptHidden('  Llave: ')).trim()
    log('')
  }
  if (!key) return false
  writeEnvVar(ENV_FILE, 'DEEPSEEK_API_KEY', key)
  return true
}

const copyEnvToDsh = () => { try { fs.copyFileSync(ENV_FILE, path.join(DSH, '.env')) } catch { /* el harness aún no existe */ } }

async function main() {
  if (KEY_ONLY) {
    if (await ensureApiKey(true)) {
      copyEnvToDsh()
      log('  llave guardada en este equipo. No se comparte con nadie.')
    } else {
      fail('no se guardo ninguna llave.')
    }
    return
  }

  if (!commandExists('git')) fail('falta git. Instálalo desde https://git-scm.com/downloads')
  if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node ${process.version} es muy viejo; se requiere >= 22 (recomendado 24).`)
  process.env.DSH_CLIENT_TITLE = DSH_CLIENT_TITLE
  const lock = readLock()

  log(`[1/7] Congelando DeepSeek Harness (${lock.DSH_VERSION} / ${lock.DSH_COMMIT}) ...`)
  if (!fs.existsSync(path.join(DSH, '.git'))) {
    fs.mkdirSync(path.join(REPO_ROOT, 'vendor'), { recursive: true })
    run('git', ['clone', '--branch', lock.DSH_TAG, '--depth', '1', lock.DSH_REPOSITORY, DSH])
  }
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: DSH, capture: true }).stdout.trim()
  log(head === lock.DSH_COMMIT ? `  commit verificado: ${head}` : `  AVISO: el commit descargado (${head}) no coincide con dsh.lock (${lock.DSH_COMMIT}).`)

  log('[2/7] Aplicando la marca ENERSINC a la interfaz ...')
  if (process.env.ENERSINC_SKIP_BRAND === '1') log('  omitido (ENERSINC_SKIP_BRAND=1)')
  else run(process.execPath, [path.join(SCRIPT_DIR, 'brand', 'apply.mjs'), '--harness', DSH])

  log(`[3/7] Instalando y compilando el harness (DSH_CLIENT_TITLE=${DSH_CLIENT_TITLE}) ...`)
  pnpm(['install', '--no-frozen-lockfile'], { cwd: DSH })
  pnpm(['run', 'build'], { cwd: DSH })

  log('[4/7] Configurando tu llave del modelo ...')
  if (await ensureApiKey(FORCE_KEY)) log('  llave guardada en este equipo. No se comparte con nadie.')
  else log('  AVISO: seguimos sin llave. Cuando la tengas, corre: node scripts/setup.cjs --key')
  copyEnvToDsh()

  log('[5/7] Dependencias del servicio CREG ...')
  pnpm(['install'])
  const cregDir = path.join(REPO_ROOT, 'services', 'creg')
  if (!fs.existsSync(path.join(cregDir, 'node_modules'))) {
    run('npm', ['install', '--no-audit', '--no-fund'], { cwd: cregDir, env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } })
    log('  servicio CREG instalado (modo direct, sin navegador)')
  }

  log('[6/7] Creando perfiles enersinc (web) y enersinc-cli (headless) con CREG activo ...')
  const bundle = path.join(REPO_ROOT, 'packages', 'dsh-bundle-creg')
  pnpm(['dsh', '--profile', 'enersinc', '--from-default-profile', 'web', '--dump-config'], { cwd: DSH, capture: true, allowFail: true })
  pnpm(['dsh', '--profile', 'enersinc-cli', '--from-default-profile', 'headless', '--dump-config'], { cwd: DSH, capture: true, allowFail: true })
  const addCreg = (profile) => {
    const res = pnpm(['dsh', 'plugin', '--profile', profile, 'add', bundle], { cwd: DSH, allowFail: true })
    if (res.status !== 0) log(`  aviso: no pude registrar el bundle creg en el perfil ${profile} (¿ya estaba?).`)
  }
  addCreg('enersinc')
  addCreg('enersinc-cli')

  log('[7/7] Skills y overlay MCP ...')
  const skillsDst = path.join(DSH_HOME, 'skills')
  fs.mkdirSync(skillsDst, { recursive: true })
  fs.cpSync(path.join(REPO_ROOT, 'skills'), skillsDst, { recursive: true, force: true })
  const tmpl = fs.readFileSync(path.join(REPO_ROOT, 'patches', 'creg.cordis.yml.tmpl'), 'utf8')
  fs.writeFileSync(path.join(REPO_ROOT, 'patches', 'creg.cordis.yml'), tmpl.split('__ENERSINC_HARNESS__').join(REPO_ROOT.replaceAll('\\', '/')))

  log('')
  log('¡Listo! Ya puedes hablar con el asistente.')
  log('')
  log(`  Para abrir la ventana del asistente (interfaz web):  ${path.join(REPO_ROOT, 'scripts', IS_WIN ? 'web.ps1' : 'web.sh')}`)
  log(`  Para hacer una pregunta aqui mismo:                  ${path.join(REPO_ROOT, 'scripts', IS_WIN ? 'run.ps1' : 'run.sh')} "Pregunta a la CREG que es la CREG"`)
}

main().catch((error) => fail(error && error.message ? error.message : String(error)))
