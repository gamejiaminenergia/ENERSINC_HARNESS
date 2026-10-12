# Pide la llave del modelo y la guarda (Windows). Envoltorio de setup.cjs --key.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-key.ps1
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
& node (Join-Path $Repo 'scripts/setup.cjs') --key
exit $LASTEXITCODE
