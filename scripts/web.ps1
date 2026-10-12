# Interfaz web del ENERSINC Harness (Windows). Levanta el servicio CREG y abre la UI.
#
#   powershell -ExecutionPolicy Bypass -File scripts\web.ps1
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$DSH = Join-Path $Repo 'vendor/deepseek-harness'
$cregPort = if ($env:CREG_PORT) { $env:CREG_PORT } else { '3100' }
$env:CREG_URL = if ($env:CREG_URL) { $env:CREG_URL } else { "http://127.0.0.1:$cregPort" }
$env:CREG_MODE = if ($env:CREG_MODE) { $env:CREG_MODE } else { 'direct' }

if (-not (Test-Path $DSH)) { throw "Falta el harness en $DSH; corre install.ps1 primero." }

function Test-Creg {
  try { Invoke-WebRequest -UseBasicParsing "$env:CREG_URL/health" -TimeoutSec 2 | Out-Null; return $true }
  catch { return $false }
}

if (-not (Test-Creg)) {
  Write-Host "[enersinc] levantando el servicio CREG en :$cregPort (modo $env:CREG_MODE) ..."
  $cregDir = Join-Path $Repo 'services/creg'
  $env:PORT = $cregPort
  Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $cregDir -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 80 -and -not (Test-Creg); $i++) { Start-Sleep -Milliseconds 250 }
}
if (-not (Test-Creg)) { throw "[enersinc] no pude levantar el CREG (revisa services/creg)." }
Write-Host "[enersinc] servicio CREG listo en :$cregPort"

Push-Location $DSH
try { & corepack 'pnpm@11.28.5' dsh --profile enersinc --no-open } finally { Pop-Location }
