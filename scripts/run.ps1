# Una tarea del ENERSINC Harness (sin interfaz) en Windows.
# Levanta el servicio CREG si hace falta y ejecuta la tarea (headless).
#
#   powershell -ExecutionPolicy Bypass -File scripts\run.ps1 "Usa creg_ask para preguntar 'Que es la CREG?'"
param(
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Task
)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$DSH = Join-Path $Repo 'vendor/deepseek-harness'
$cregPort = if ($env:CREG_PORT) { $env:CREG_PORT } else { '3100' }
$env:CREG_URL = if ($env:CREG_URL) { $env:CREG_URL } else { "http://127.0.0.1:$cregPort" }
$env:CREG_MODE = if ($env:CREG_MODE) { $env:CREG_MODE } else { 'direct' }
$mode = if ($env:MODE) { $env:MODE } else { 'native' }

if (-not $Task -or $Task.Count -eq 0) { throw 'Uso: run.ps1 "<tarea>"' }
if (-not (Test-Path $DSH)) { throw "Falta el harness en $DSH; corre install.ps1 primero." }

function Test-Creg {
  try { Invoke-WebRequest -UseBasicParsing "$env:CREG_URL/health" -TimeoutSec 2 | Out-Null; return $true }
  catch { return $false }
}
if (-not (Test-Creg)) {
  Write-Host "[enersinc] levantando el servicio CREG en :$cregPort ..."
  $env:PORT = $cregPort
  Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Join-Path $Repo 'services/creg') -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 80 -and -not (Test-Creg); $i++) { Start-Sleep -Milliseconds 250 }
}
if (-not (Test-Creg)) { throw '[enersinc] no pude levantar el CREG.' }

$text = $Task -join ' '
Push-Location $DSH
try {
  if ($mode -eq 'mcp') {
    $patch = Join-Path $Repo 'patches/creg.cordis.yml'
    & corepack 'pnpm@11.28.5' dsh --profile headless --patch $patch $text
  } else {
    & corepack 'pnpm@11.28.5' dsh --profile enersinc-cli $text
  }
} finally { Pop-Location }
