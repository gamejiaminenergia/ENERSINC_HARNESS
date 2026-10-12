<#
.SYNOPSIS
  ENERSINC Harness — instalador para Windows (PowerShell 5+).
.DESCRIPTION
  Descarga/actualiza este repo y ejecuta el setup (Node). Aplica la marca
  ENERSINC a la interfaz, deja la CREG activa y te pide tu llave de DeepSeek
  para que el asistente pueda responder.

  Uso (una línea):

    irm https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.ps1 | iex

  Variables de entorno:
    ENERSINC_HOME   directorio del checkout  (default: %USERPROFILE%\.enersinc-harness)
    ENERSINC_REPO   URL git del repo         (default: github.com/gamejia/enersinc-harness)
    ENERSINC_REF    rama o tag               (default: main)
#>
[CmdletBinding()]
param(
  [string]$Ref = $env:ENERSINC_REF,
  [string]$Repo = $env:ENERSINC_REPO,
  [string]$Home = $env:ENERSINC_HOME
)

$ErrorActionPreference = 'Stop'
function Die($message) { Write-Error $message; exit 1 }

$Ref  = if ($Ref)  { $Ref }  else { 'main' }
$Repo = if ($Repo) { $Repo } else { 'https://github.com/gamejia/enersinc-harness.git' }
$HomeDir = if ($Home) { $Home } else { Join-Path $env:USERPROFILE '.enersinc-harness' }

Write-Host '[enersinc] verificando requisitos ...'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die 'falta git. Instálalo desde https://git-scm.com/downloads' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die 'falta Node.js >= 22. Instálalo desde https://nodejs.org' }
$major = [int](& node -p 'process.versions.node.split(".")[0]')
if ($major -lt 22) { Die "Node $(node -v) es muy viejo; se requiere >= 22 (recomendado 24)." }

Write-Host "[enersinc] destino: $HomeDir"
if (Test-Path (Join-Path $HomeDir '.git')) {
  Write-Host "[enersinc] actualizando a '$Ref' ..."
  & git -C $HomeDir fetch --depth 1 origin $Ref
  if ($LASTEXITCODE -ne 0) { Die 'git fetch falló.' }
  & git -C $HomeDir checkout -q --detach FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { Die 'git checkout falló.' }
} else {
  Write-Host "[enersinc] clonando $Repo ('$Ref') ..."
  New-Item -ItemType Directory -Force -Path (Split-Path $HomeDir) | Out-Null
  & git clone --branch $Ref --depth 1 $Repo $HomeDir
  if ($LASTEXITCODE -ne 0) { Die 'git clone falló.' }
}

& node (Join-Path $HomeDir 'scripts/setup.cjs')
exit $LASTEXITCODE
