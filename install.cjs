'use strict'
/**
 * Bootstrap universal del ENERSINC Harness: descarga/actualiza este repo y
 * ejecuta `scripts/setup.cjs`. Corre igual en Windows, macOS y Linux.
 *
 * No lleva shebang a proposito: el comando universal lo descarga y lo evalua.
 *
 * Variables: ENERSINC_HOME, ENERSINC_REPO, ENERSINC_REF.
 */
;(async () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const { spawnSync } = require('node:child_process')

  const REPO = process.env.ENERSINC_REPO || 'https://github.com/gamejia/enersinc-harness.git'
  const REF = process.env.ENERSINC_REF || 'main'
  const HOME = process.env.ENERSINC_HOME || path.join(os.homedir(), '.enersinc-harness')
  const log = (m) => process.stdout.write(`${m}\n`)

  log('[enersinc] verificando requisitos ...')
  if (spawnSync('git', ['--version'], { stdio: 'ignore' }).status !== 0) {
    throw new Error('falta git. Instálalo desde https://git-scm.com/downloads')
  }
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error(`Node ${process.version} es muy viejo; se requiere >= 22 (recomendado 24).`)
  }

  const git = (args) => {
    const res = spawnSync('git', args, { stdio: 'inherit' })
    if (res.status !== 0) throw new Error(`git ${args.join(' ')} falló con ${res.status}`)
  }

  log(`[enersinc] destino: ${HOME}`)
  if (fs.existsSync(path.join(HOME, '.git'))) {
    log(`[enersinc] actualizando a '${REF}' ...`)
    git(['-C', HOME, 'fetch', '--depth', '1', 'origin', REF])
    git(['-C', HOME, 'checkout', '-q', '--detach', 'FETCH_HEAD'])
  } else {
    log(`[enersinc] clonando ${REPO} ('${REF}') ...`)
    fs.mkdirSync(path.dirname(HOME), { recursive: true })
    git(['clone', '--branch', REF, '--depth', '1', REPO, HOME])
  }

  const res = spawnSync(process.execPath, [path.join(HOME, 'scripts', 'setup.cjs')], { stdio: 'inherit' })
  process.exit(res.status == null ? 1 : res.status)
})().catch((error) => {
  process.stderr.write(`[enersinc] ${error && error.message ? error.message : String(error)}\n`)
  process.exit(1)
})
