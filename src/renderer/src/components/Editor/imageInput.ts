export type ImageAlign = 'left' | 'center' | 'right'

export interface ParsedImage {
  alt: string
  src: string
  /** Width in px, if the source carried one (HTML width=… ). */
  width?: number
  /** Block alignment, stored as canonical auto-margins in the HTML img's style. */
  align?: ImageAlign
}

/** CSS for an alignment (block + auto margins) — portable across HTML renderers. */
function alignStyle(align: ImageAlign | undefined): string {
  if (align === 'center') return 'display:block;margin-left:auto;margin-right:auto'
  if (align === 'right') return 'display:block;margin-left:auto;margin-right:0'
  if (align === 'left') return 'display:block;margin-left:0;margin-right:auto'
  return ''
}

/** Recover the alignment from an HTML img's style (the inverse of alignStyle). */
function alignFromStyle(style: string): ImageAlign | undefined {
  const ml = /margin-left\s*:\s*auto/i.test(style)
  const mr = /margin-right\s*:\s*auto/i.test(style)
  return ml && mr ? 'center' : ml ? 'right' : mr ? 'left' : undefined
}

/** Parse a markdown `![alt](src)` image. */
export function parseMarkdownImage(text: string): ParsedImage | null {
  const m = /^!\[((?:\\.|[^\]\\])*)\]\(\s*(?:<([^>\n]+)>|(\S+?))(?:\s+["'][^"']*["'])?\s*\)$/.exec(text.trim())
  return m ? { alt: m[1].replace(/\\([\]\\])/g, '$1'), src: m[2] ?? m[3] } : null
}

/** Parse an HTML `<img src alt width>` tag (attribute order-independent). */
export function parseHtmlImage(text: string): ParsedImage | null {
  const t = text.trim()
  if (!/^<img\b[^>]*>$/i.test(t)) return null
  const template = document.createElement('template')
  template.innerHTML = t
  const image = template.content.firstElementChild
  const attr = (name: string): string | undefined => image?.getAttribute(name) ?? undefined
  const src = attr('src')
  if (!src) return null
  const widthRaw = attr('width')
  const width = widthRaw && /^\d+$/.test(widthRaw) ? Number(widthRaw) : undefined
  return { alt: attr('alt') ?? '', src, width, align: alignFromStyle(attr('style') ?? '') }
}

/** Parse either image syntax. */
export function parseImage(text: string): ParsedImage | null {
  return parseMarkdownImage(text) ?? parseHtmlImage(text)
}

/** Serialize to an HTML `<img>` tag, including width + alignment when present. */
export function toHtmlImage(img: ParsedImage): string {
  const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts = [`src="${escape(img.src)}"`]
  if (img.alt) parts.push(`alt="${escape(img.alt)}"`)
  if (img.width) parts.push(`width="${img.width}"`)
  const style = alignStyle(img.align)
  if (style) parts.push(`style="${style}"`)
  return `<img ${parts.join(' ')} />`
}
