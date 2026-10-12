# Pide la llave del modelo y la guarda (Windows). Usalo cuando te cambien la
# llave o si el instalador no la pidio.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-key.ps1
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$DSH = Join-Path $Repo 'vendor/deepseek-harness'
$envFile = Join-Path $Repo '.env'
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $Repo '.env.example') $envFile }

Write-Host ''
Write-Host '  Hace falta tu llave de DeepSeek para que el asistente pueda responder.'
Write-Host "  Empieza con 'sk-'. Pegala abajo y pulsa Enter (no se vera en pantalla)."
$secure = Read-Host '  Llave' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if (-not $key) { Write-Error 'no se guardo ninguna llave.'; exit 1 }

$found = $false
$lines = Get-Content $envFile | ForEach-Object {
  if ($_ -match '^DEEPSEEK_API_KEY=') { $found = $true; "DEEPSEEK_API_KEY=$key" } else { $_ }
}
if (-not $found) { $lines += "DEEPSEEK_API_KEY=$key" }
Set-Content -Path $envFile -Value $lines
if (Test-Path $DSH) { Copy-Item $envFile (Join-Path $DSH '.env') -Force -ErrorAction SilentlyContinue }
Write-Host '  llave guardada en este equipo. No se comparte con nadie.'
