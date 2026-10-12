#!/usr/bin/env node
/**
 * Apply the ENERSINC brand overlay to a pinned DeepSeek Harness checkout.
 *
 * Copies `branding/dsh-client-ui-brand-enersinc` into the harness workspace at
 * `packages/client/ui-brand-enersinc` and registers it in the two TypeScript
 * aggregates so the client build picks it up:
 *   - tsconfig.client.json  -> project reference (for `tsc -b`)
 *   - tsconfig.base.json    -> path mappings (for module resolution)
 *
 * Idempotent: safe to run on an already-patched checkout. Re-running refreshes
 * the copied sources.
 *
 *   node scripts/brand/apply.mjs [--harness <dir>]
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const positional = process.argv.slice(2).find((value) => !value.startsWith('--'))
const envHarness = process.env.DSH_DIR ?? process.env.DSH_HARNESS_DIR
const harnessRoot = resolve(repoRoot, arg('harness') ?? positional ?? envHarness ?? 'vendor/deepseek-harness')

const PKG_DIR_NAME = 'ui-brand-enersinc'
const source = join(repoRoot, 'branding', 'dsh-client-ui-brand-enersinc')
const destination = join(harnessRoot, 'packages', 'client', PKG_DIR_NAME)

/** Fail loudly with a readable message. */
function fail(message) {
  console.error(`[brand] ${message}`)
  process.exit(1)
}

if (!existsSync(join(harnessRoot, 'packages', 'client', 'ui-brand-official'))) {
  fail(`no DeepSeek Harness checkout at ${harnessRoot} (expected packages/client/ui-brand-official).`)
}
if (!existsSync(source)) fail(`brand package missing at ${source}`)

// 1. Copy the package into the workspace (replace any previous copy).
rmSync(destination, { recursive: true, force: true })
cpSync(source, destination, { recursive: true })
console.log(`[brand] installed package -> ${destination}`)

/** Insert `lines` after the first line containing `anchor`, preserving indentation. */
function insertAfter(file, anchor, buildLines, marker) {
  const path = join(harnessRoot, file)
  if (!existsSync(path)) fail(`expected ${file} in the harness checkout`)
  const text = readFileSync(path, 'utf8')
  if (text.includes(marker)) {
    console.log(`[brand] ${file} already registers ${marker}; leaving it as is`)
    return
  }
  const lines = text.split('\n')
  const index = lines.findIndex((line) => line.includes(anchor))
  if (index === -1) fail(`anchor "${anchor}" not found in ${file}`)
  const indent = lines[index].match(/^\s*/)[0]
  lines.splice(index + 1, 0, ...buildLines(indent))
  writeFileSync(path, lines.join('\n'))
  console.log(`[brand] patched ${file}`)
}

// 2. Project reference for the client typecheck aggregate.
insertAfter(
  'tsconfig.client.json',
  '{ "path": "./packages/client/ui-brand-official" }',
  (indent) => [`${indent}{ "path": "./packages/client/${PKG_DIR_NAME}" },`],
  `./packages/client/${PKG_DIR_NAME}`,
)

// 3. Path mappings for module resolution.
insertAfter(
  'tsconfig.base.json',
  '"@deepseek-ai/dsh-client-ui-brand-official": ["./packages/client/ui-brand-official/src"]',
  (indent) => [
    `${indent}"@enersinc/dsh-client-ui-brand-enersinc": ["./packages/client/${PKG_DIR_NAME}/src"],`,
    `${indent}"@enersinc/dsh-client-ui-brand-enersinc/client": ["./packages/client/${PKG_DIR_NAME}/src/client/index.ts"],`,
  ],
  '@enersinc/dsh-client-ui-brand-enersinc',
)

console.log(`[brand] overlay applied (${PKG_DIR_NAME}) at ${harnessRoot}`)
