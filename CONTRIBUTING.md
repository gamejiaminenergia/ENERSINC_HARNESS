# Contribuir

Gracias por mejorar el ENERSINC Harness. El principio rector es **complementar
DeepSeek Harness, no forkearlo**: nada de este repo debe modificar el núcleo de
`dsh`, solo añadirse (plugins, skills, perfiles, overlays).

## Flujo

1. Haz un fork y una rama: `feat/<tema>` o `fix/<tema>`.
2. Cambia lo mínimo necesario y mantén el estilo del código vecino.
3. Corre las verificaciones locales:

   ```bash
   bash scripts/ci-check.sh      # sintaxis, generador de logo y overlay
   bash -n install.sh scripts/*.sh
   ```

4. Abre el PR describiendo **qué** y **por qué**.

## Áreas

| Quiero… | Toca… |
| --- | --- |
| Cambiar la marca/UI | `branding/`, `scripts/brand/` |
| Añadir/ajustar herramientas CREG | `packages/dsh-bundle-creg/`, `skills/` |
| Cambiar el servicio CREG | `services/creg/` |
| Actualizar la versión de `dsh` | `dsh.lock` y `docs/` |

## Actualizar la versión congelada de `dsh`

Es un cambio **deliberado**:

1. Edita `dsh.lock` (`DSH_VERSION`, `DSH_TAG`, `DSH_COMMIT`, `DSH_PINNED_AT`).
2. Corre `./scripts/setup.sh` y verifica: `./scripts/doctor.sh`.
3. Confirma que el logo ENERSINC y las `creg_*` siguen funcionando; si el
   sistema de slots cambió, ajusta `branding/dsh-client-ui-brand-enersinc`.

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la [licencia MIT](LICENSE).
El logo ENERSINC es marca de ENERSINC y no queda cubierto por MIT.
