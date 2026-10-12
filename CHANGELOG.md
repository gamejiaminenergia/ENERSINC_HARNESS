# Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y
versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- **Comando de instalación universal** con Node.js, idéntico en Windows, macOS
  y Linux (`node -e "…install.cjs…"`), más `install.sh` / `install.ps1` como
  alternativas por shell.
- `install.cjs` (bootstrap) y `scripts/setup.cjs`: **todo** el setup en Node,
  una sola implementación para los tres sistemas.

### Cambiado

- El instalador **pide la llave** del modelo con un mensaje claro (entrada
  oculta) en vez de pedir editar un archivo.
- `setup.sh` / `setup-key.sh` / `setup-key.ps1` pasan a ser envoltorios de
  `setup.cjs`.
- README reescrito en lenguaje llano y con los **requisitos previos**
  (Node.js y Git) explícitos.

### Eliminado

- `scripts/lib.sh` (su lógica vive ahora en `setup.cjs`).

## [0.1.0] - 2026-10-12

Primera entrega pública.

### Añadido

- **Instalación de una línea** multiplataforma: `install.sh` (macOS/Linux/Git
  Bash) e `install.ps1` (Windows PowerShell).
- **Marca ENERSINC** en la Web UI mediante un plugin de cliente que ocupa el
  slot `sidebar.brand.name` (logo ENERSINC junto al branding DeepSeek).
- **Capacidad CREG activa por defecto** en los perfiles `enersinc` y
  `enersinc-cli` (bundle nativo `creg_ask`, `creg_health`, `creg_stats`).
- Servicio CREG autocontenido en `services/creg/` y puente MCP opcional.
- Skill `uso-de-creg` que orienta al modelo.
- Congelamiento de DeepSeek Harness (`dsh.lock`, tag `dsh-v0.2.1-alpha.2`).
- `scripts/doctor.sh` (diagnóstico) y `scripts/ci-check.sh` (verificación en CI).
- Documentación: arquitectura, marca y CREG.
