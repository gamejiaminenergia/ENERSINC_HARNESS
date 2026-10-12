# Marca ENERSINC en la Web UI

El objetivo es simple: que **al lado del logo de DeepSeek** aparezca el logo de
ENERSINC, sin tocar el núcleo del harness. Aquí está el cómo.

## El mecanismo: slots de cliente

La Web UI de DeepSeek Harness se compone con **slots**. La barra lateral declara
dos slots de un solo ocupante (`packages/client/ui-sidebar`):

| Slot | Fallback de fábrica | Props |
| --- | --- | --- |
| `sidebar.brand.mark` | `FishLogo` (la ballena DeepSeek) | `{ size }` |
| `sidebar.brand.name` | wordmark oficial / etiqueta de *local build* | `{}` |

Un **plugin de cliente dinámico** (paquete con `"dsh.client": { "platform": "web" }`)
que registra en estos slots recibe una prioridad **menor** que el ocupante
entregado de fábrica. En un slot `single`, eso significa que **su componente es
el que se renderiza**.

Nuestro plugin (`branding/dsh-client-ui-brand-enersinc`):

- deja `sidebar.brand.mark` intacto → la **ballena DeepSeek sigue visible**;
- ocupa `sidebar.brand.name` → **wordmark DeepSeek + divisor + logo ENERSINC**.

Resultado en la barra superior: `🐳 DeepSeek Harness │ ENERSINC`.

## Cómo entra el plugin al harness

El repo **no** contiene el harness; lo congela en `vendor/deepseek-harness`
(ver `dsh.lock`). El overlay se aplica con:

```bash
node scripts/brand/apply.mjs --harness vendor/deepseek-harness
```

Ese script:

1. copia `branding/dsh-client-ui-brand-enersinc` a
   `vendor/deepseek-harness/packages/client/ui-brand-enersinc/`;
2. añade la referencia del proyecto en `tsconfig.client.json` (para `tsc -b`);
3. añade los *path mappings* en `tsconfig.base.json` (para resolver imports).

Después `pnpm run build` compila todo `packages/*/*` con `tsdown` (emite
`lib/client.js`) y `@deepseek-ai/dsh-client-modules` sirve la mitad de navegador
al arrancar, que registra el ocupante del slot. Es **idempotente**: re-ejecutarlo
refresca las fuentes.

## El logo

- Fuente: `branding/enersinc-logo.svg` (se le quitaron el bloque de metadatos
  C2PA y el fondo blanco de lienzo completo).
- Componente: `branding/dsh-client-ui-brand-enersinc/src/client/EnersincLogo.tsx`
  (paths SVG en línea, `viewBox 0 0 2560 472`).
- Regenerar tras editar el SVG:

  ```bash
  pnpm brand:logo
  ```

## Personalizaciones comunes

| Quiero… | Cómo |
| --- | --- |
| Cambiar el título de la pestaña | `DSH_CLIENT_TITLE="Mi título" ./scripts/setup.sh` |
| No aplicar la marca | `ENERSINC_SKIP_BRAND=1 ./scripts/setup.sh` |
| Marca también en el rail colapsado | registrar `EnersincBrandMark` en `src/client/index.ts` (ver README del plugin) |
| Cambiar el orden/logo | editar `src/client/Brand.tsx` y re-ejecutar el setup |

## Verificar

```bash
./scripts/doctor.sh   # comprueba el plugin y los parches de tsconfig
```

Si el logo no aparece en el navegador: recarga con *hard refresh*, revisa que
`vendor/deepseek-harness/apps/web/dist/index.html` exista y corre `doctor.sh`.
