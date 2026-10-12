# Arquitectura

## Principio rector

**Complementamos `dsh`; nos adaptamos a él, no al revés.** No tocamos su núcleo.
Todo lo nuestro es *overlay* (plugin, skill, perfil o parche de build aplicado
por script).

## Piezas

```
                    ┌───────────────────────────┐
                    │  DeepSeek Harness (dsh)   │  vendor/deepseek-harness
                    │  versión congelada        │  (tag en dsh.lock)
                    └──────────────┬────────────┘
        overlay de marca ──┐       │       ┌── bundle CREG + skill
                           ▼       ▼       ▼
     packages/client/ui-brand-enersinc   packages/dsh-bundle-creg
     (slot sidebar.brand.name)           (creg_ask/health/stats)
                           ▲               ▲
              scripts/brand/apply.mjs      services/creg (Express :3100)
```

| Capa | Ruta | Qué es |
| --- | --- | --- |
| Congelamiento | `dsh.lock` | tag + commit del harness que probamos |
| Marca | `branding/` + `scripts/brand/` | plugin de cliente y su aplicación |
| CREG nativo | `packages/dsh-bundle-creg/` | bundle Cordis con las tools |
| CREG MCP | `packages/mcp-creg/` + `patches/` | puente MCP (alternativa) |
| Servicio | `services/creg/` | Express + cliente CREG |
| Skill | `skills/uso-de-creg/` | instrucciones para el modelo |
| Orquestación | `scripts/setup.sh`, `install.sh`, `install.ps1` | instalan y configuran |

## Flujo de instalación

1. `install.sh` / `install.ps1` clonan este repo en `~/.enersinc-harness`.
2. `setup.sh` congela `dsh` en `vendor/deepseek-harness` (verifica el commit de
   `dsh.lock`).
3. `scripts/brand/apply.mjs` copia el plugin de marca al workspace del harness.
4. `pnpm install --no-frozen-lockfile && pnpm run build` compila el harness
   (y con él, el plugin de marca).
5. Se crean los perfiles `enersinc` (web) y `enersinc-cli` (headless) y se
   engancha el bundle CREG.
6. Se copian las skills y se genera el overlay MCP.

## Perfiles

| Perfil | Uso | CREG |
| --- | --- | --- |
| `enersinc` | Web UI (`dsh web`) | bundle nativo |
| `enersinc-cli` | tareas headless | bundle nativo |

## Determinismo

- Versión de `dsh` fijada por tag+commit (`dsh.lock`).
- El plugin de marca se copia siempre desde `branding/` (fuente de verdad) y se
  re-aplica de forma idempotente.
- `scripts/doctor.sh` verifica requisitos, checkout, marca y CREG.

## Límites conocidos

- El build del harness es pesado (clona y compila todo el monorepo).
- La marca depende del sistema de slots del cliente de `dsh`, que está en
  *developer preview*; al actualizar el tag puede requerir ajustar el plugin.
