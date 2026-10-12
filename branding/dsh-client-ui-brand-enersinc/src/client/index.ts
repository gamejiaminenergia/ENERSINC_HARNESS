/**
 * ENERSINC occupant for the sidebar brand slots.
 *
 * A dynamically loaded client plugin registers with a priority lower than the
 * shipped entries, so in the single-occupant `sidebar.brand.name` cell this
 * occupant renders instead of the default label: the DeepSeek branding stays
 * visible (fish mark in the untouched `sidebar.brand.mark` slot, wordmark drawn
 * by the occupant) and the ENERSINC logo lands right beside it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { EnersincBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand name with the DeepSeek wordmark followed by the
 * ENERSINC mark. The `sidebar.brand.mark` slot is intentionally left to its
 * fish fallback so the collapsed rail keeps its geometry; swap in
 * `EnersincBrandMark` from `./Brand.tsx` to brand the rail too.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.name', () =>
    ctx.slots.register({ name: 'sidebar.brand.name' }, EnersincBrandName))
}
