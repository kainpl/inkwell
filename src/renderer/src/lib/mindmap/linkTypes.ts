import type { LinkType } from '@shared/mindmap/types'

/** Built-in cross-link types (D5). Names align with MindDoc `rel/depends_on/see`. */
export const BUILTIN_LINK_TYPES: Record<string, LinkType> = {
  'relates-to': { label: 'relates to', color: '#7a8aa0', arrow: 'none', directed: false },
  'depends-on': { label: 'depends on', color: '#e0772b', arrow: 'to', directed: true },
  references: { label: 'references', color: '#4a86d9', arrow: 'to', directed: true },
  blocks: { label: 'blocks', color: '#d35454', arrow: 'to', directed: true },
  duplicates: { label: 'duplicates', color: '#9b59b6', arrow: 'both', directed: false },
  'see-also': { label: 'see also', color: '#3a9e4a', arrow: 'none', directed: false }
}

/** Merge a manifest's overrides + first-class custom types over the built-ins. */
export function mergeLinkTypes(manifest?: Record<string, Partial<LinkType>>): Record<string, LinkType> {
  const out: Record<string, LinkType> = structuredClone(BUILTIN_LINK_TYPES)
  for (const [key, override] of Object.entries(manifest ?? {})) {
    const base = out[key] ?? { label: key, color: '#7a8aa0' }
    out[key] = { ...base, ...override }
  }
  return out
}

/** Visual fallback for a type not present in the registry. */
export function resolveLinkType(registry: Record<string, LinkType>, type: string): LinkType {
  return registry[type] ?? { label: type, color: '#7a8aa0', arrow: 'to', directed: true }
}
