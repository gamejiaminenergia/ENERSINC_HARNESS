import { BrandWordmark, FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps, SidebarBrandNameOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { EnersincLogo } from './EnersincLogo.tsx'

/** Vertical hairline separating the DeepSeek branding from the ENERSINC mark. */
function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 1,
        alignSelf: 'stretch',
        margin: '2px 2px',
        background: 'currentColor',
        opacity: 0.25,
      }}
    />
  )
}

/**
 * Brand row occupant: the ENERSINC mark rendered beside the DeepSeek branding.
 *
 * Registering `sidebar.brand.name` from a dynamically loaded plugin gives this
 * occupant a lower priority than the shipped entry, so it is the one that
 * renders: the DeepSeek wordmark on the left (the fish mark beside it stays in
 * the untouched `sidebar.brand.mark` slot) and the ENERSINC logo on the right.
 *
 * @returns the composed brand name row.
 */
export function EnersincBrandName(_props: SidebarBrandNameOwnerProps) {
  return (
    <span
      data-enersinc-brand="name"
      aria-label="DeepSeek Harness — ENERSINC"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, whiteSpace: 'nowrap' }}
    >
      <BrandWordmark includeMark={false} size={18} />
      <Divider />
      <EnersincLogo height={18} style={{ flexShrink: 0 }} />
    </span>
  )
}

/**
 * Optional rail/expanded mark occupant that keeps the DeepSeek fish and adds a
 * compact ENERSINC lockup. Not registered by default because the collapsed
 * 56px rail cannot host the wide ENERSINC wordmark without clipping; wire it
 * in {@link apply} when a branded rail is wanted.
 *
 * @param props.size - square edge requested by the host surface.
 * @returns the fish mark beside a shrunk ENERSINC logo.
 */
export function EnersincBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return (
    <span
      data-enersinc-brand="mark"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}
    >
      <FishLogo size={size} />
      <EnersincLogo height={Math.round(size * 0.72)} style={{ flexShrink: 0 }} />
    </span>
  )
}
