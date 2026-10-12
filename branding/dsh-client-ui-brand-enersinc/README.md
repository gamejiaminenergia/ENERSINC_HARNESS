# @enersinc/dsh-client-ui-brand-enersinc

Brand occupant for the **DeepSeek Harness Web client** that renders the
**ENERSINC** logo beside the DeepSeek branding in the sidebar.

## What it does

The sidebar's top-left brand row is composed of two single-occupant slots
declared by `@deepseek-ai/dsh-client-ui-sidebar`:

| Slot | Default | This plugin |
| --- | --- | --- |
| `sidebar.brand.mark` | `FishLogo` (DeepSeek whale) | left untouched (fish stays) |
| `sidebar.brand.name` | official wordmark / local-build label | **DeepSeek wordmark + ENERSINC logo** |

A dynamically loaded client plugin registers with a lower priority than the
shipped entries, so in a single-occupant cell **this occupant is the one that
renders**. That is how the logo lands without patching the harness core.

## Why it lives here

This directory is **not** a standalone package from this repository. The
installer/`scripts/brand/apply.mjs` copies it into a pinned DeepSeek Harness
checkout at `packages/client/ui-brand-enersinc/` and registers it in the two
TypeScript aggregates (`tsconfig.client.json`, `tsconfig.base.json`). The
harness build then bundles its browser half automatically:

- `dsh.client.platform: "web"` marks it as a client plugin.
- `tsdown` compiles every `packages/*/*` package, emitting `lib/client.js`.
- `@deepseek-ai/dsh-client-modules` scans `dsh.client` rows at boot and serves
  the browser half, which registers the slot occupant.

## Enabling the branded collapsed rail

The collapsed 56px rail is too narrow for the wide ENERSINC wordmark, so the
default registration leaves `sidebar.brand.mark` at its fish fallback. To brand
the rail too, edit `src/client/index.ts` and register `EnersincBrandMark` (it
draws the fish plus a 72%-height ENERSINC lockup with `overflow: hidden`):

```ts
import { EnersincBrandMark, EnersincBrandName } from './Brand.tsx'

export function apply(ctx) {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, EnersincBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, EnersincBrandName)
    }))
}
```

## The logo asset

`src/client/EnersincLogo.tsx` inlines the ENERSINC mark as SVG paths
(`viewBox 0 0 2560 472`). It was generated from `../../enersinc-logo.svg` with
the C2PA metadata block and the full-canvas white backdrop removed, so it sits
on both light and dark theme backgrounds. Regenerate it after editing the
source SVG with `node ../../scripts/brand/gen-logo.mjs`.

## License

MIT — see the repository root `LICENSE`.
