<#
.SYNOPSIS
  ENERSINC Harness — instalador para Windows (PowerShell 5+).
.DESCRIPTION
  Descarga este repo, congela DeepSeek Harness, aplica la marca ENERSINC a la
  Web UI y deja la capacidad CREG activa por defecto en el perfil `enersinc`.

  Uso (una línea):

    irm https://raw.githubusercontent.com/gamejia/enersinc-harness/main/install.ps1 | iex

  Variables de entorno:
    ENERSINC_HOME       directorio del checkout   (default: %USERPROFILE%\.enersinc-harness)
    ENERSINC_REPO       URL git del repo          (default: github.com/gamejia/enersinc-harness)
    ENERSINC_REF        rama o tag                (default: main)
    DSH_CLIENT_TITLE    título de la ventana       (default: ENERSINC Harness)
    ENERSINC_SKIP_BRAND =1 omite el overlay de marca
#>
[CmdletBinding()]
param(
  [string]$Ref = $env:ENERSINC_REF,
  [string]$Repo = $env:ENERSINC_REPO,
  [string]$Home = $env:ENERSINC_HOME
)

$ErrorActionPreference = 'Stop'

function Say($message) { Write-Host $message }
function Die($message) { Write-Error $message; exit 1 }
function Need($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { Die "falta '$name'. $hint" }
}
function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
  & corepack 'pnpm@11.28.5' @Rest
  if ($LASTEXITCODE -ne 0) { throw "corepack pnpm $($Rest -join ' ') falló con código $LASTEXITCODE" }
}

$Ref  = if ($Ref)  { $Ref }  else { 'main' }
$Repo = if ($Repo) { $Repo } else { 'https://github.com/gamejia/enersinc-harness.git' }
$HomeDir = if ($Home) { $Home } else { Join-Path $env:USERPROFILE '.enersinc-harness' }
if (-not $env:DSH_CLIENT_TITLE) { $env:DSH_CLIENT_TITLE = 'ENERSINC Harness' }
$SkipBrand = $env:ENERSINC_SKIP_BRAND -eq '1'

Say '[enersinc] verificando requisitos ...'
Need git 'Instálalo desde https://git-scm.com/downloads'
Need node 'Instala Node.js >= 24 desde https://nodejs.org'
Need corepack 'corepack viene con Node.js; reinstala Node.js >= 20.'

$major = [int](& node -p 'process.versions.node.split(".")[0]')
if ($major -lt 22) { Die "Node $(node -v) es demasiado viejo; se requiere >= 22 (recomendado 24)." }
& corepack enable | Out-Null

Say "[enersinc] destino: $HomeDir"
if (Test-Path (Join-Path $HomeDir '.git')) {
  Say "[enersinc] actualizando a '$Ref' ..."
  & git -C $HomeDir fetch --depth 1 origin $Ref
  & git -C $HomeDir checkout -q --detach FETCH_HEAD
} else {
  Say "[enersinc] clonando $Repo ('$Ref') ..."
  New-Item -ItemType Directory -Force -Path (Split-Path $HomeDir) | Out-Null
  & git clone --branch $Ref --depth 1 $Repo $HomeDir
}
if ($LASTEXITCODE -ne 0) { Die 'git falló al clonar/actualizar el repo.' }

Set-Location $HomeDir

# --- setup (espejo de scripts/setup.sh) ---
$lock = @{}
Get-Content (Join-Path $HomeDir 'dsh.lock') | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $lock[$matches[1]] = $matches[2] }
}
$DSH = Join-Path $HomeDir 'vendor/deepseek-harness'

Say "[1/7] Congelando DeepSeek Harness ($($lock.DSH_VERSION)) ..."
if (-not (Test-Path (Join-Path $DSH '.git'))) {
  New-Item -ItemType Directory -Force -Path (Join-Path $HomeDir 'vendor') | Out-Null
  & git clone --branch $lock.DSH_TAG --depth 1 $lock.DSH_REPOSITORY $DSH
}

Say '[2/7] Aplicando la marca ENERSINC a la Web UI ...'
if ($SkipBrand) { Say '  omitido (ENERSINC_SKIP_BRAND=1)' }
else { & node (Join-Path $HomeDir 'scripts/brand/apply.mjs') --harness $DSH }

Say "[3/7] Instalando y compilando el harness (DSH_CLIENT_TITLE=$($env:DSH_CLIENT_TITLE)) ..."
Push-Location $DSH
try {
  Invoke-Pnpm install --no-frozen-lockfile
  Invoke-Pnpm run build
} finally { Pop-Location }

Say '[4/7] Configurando .env ...'
$envFile = Join-Path $HomeDir '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $HomeDir '.env.example') $envFile
  Say '  creado .env (pega tu DEEPSEEK_API_KEY)'
}
$dshEnv = Join-Path $DSH '.env'
if (-not (Test-Path $dshEnv)) { Copy-Item $envFile $dshEnv -ErrorAction SilentlyContinue }

Say '[5/7] Dependencias del workspace y del servicio CREG ...'
Invoke-Pnpm install
$cregDir = Join-Path $HomeDir 'services/creg'
if (-not (Test-Path (Join-Path $cregDir 'node_modules'))) {
  $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
  Push-Location $cregDir
  try { & npm install --no-audit --no-fund | Out-Null } finally { Pop-Location }
  Remove-Item Env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD -ErrorAction SilentlyContinue
  Say '  servicio CREG instalado (modo direct, sin Chromium)'
}

Say '[6/7] Creando perfiles enersinc con CREG activo ...'
$bundle = Join-Path $HomeDir 'packages/dsh-bundle-creg'
Push-Location $DSH
try {
  Invoke-Pnpm dsh --profile enersinc     --from-default-profile web      --dump-config
  Invoke-Pnpm dsh --profile enersinc-cli --from-default-profile headless --dump-config
  Invoke-Pnpm dsh plugin --profile enersinc     add $bundle
  Invoke-Pnpm dsh plugin --profile enersinc-cli add $bundle
} finally { Pop-Location }

Say '[7/7] Skills y overlay MCP ...'
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$skillsDst = Join-Path $dshHome 'skills'
New-Item -ItemType Directory -Force -Path $skillsDst | Out-Null
Copy-Item (Join-Path $HomeDir 'skills/*') $skillsDst -Recurse -Force
$posixHome = $HomeDir -replace '\\', '/'
(Get-Content (Join-Path $HomeDir 'patches/creg.cordis.yml.tmpl') -Raw) -replace '__ENERSINC_HARNESS__', $posixHome |
  Set-Content (Join-Path $HomeDir 'patches/creg.cordis.yml')

Say ''
Say 'Listo. La capacidad CREG queda activa por defecto en el perfil enersinc.'
Say "  Web UI:  powershell -File `"$HomeDir/scripts/web.ps1`""
