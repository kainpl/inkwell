/** Pure helpers for inserting pasted/dropped images (file IO lives elsewhere). */

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp'
}

/** File extension (no dot) for an image MIME type; defaults to png. */
export function extFromMime(mime: string): string {
  return MIME_EXT[mime] ?? 'png'
}

/** Stable-ish file name for a pasted image (no original name available). */
export function pastedName(mime: string, stamp: number): string {
  return `pasted-${stamp}.${extFromMime(mime)}`
}

/** Markdown for an image; alt defaults to empty. */
export function imageMarkdown(src: string, alt = ''): string {
  return `![${alt}](${src})`
}

/** Build a data: URL from raw bytes (fallback when the doc is unsaved). */
export function dataUrl(mime: string, bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `data:${mime};base64,${btoa(bin)}`
}

export interface ParsedImage {
  alt: string
  src: string
  /** Width in px, if the source carried one (HTML width=… ). */
  width?: number
}

/** Parse a markdown `![alt](src)` image. */
export function parseMarkdownImage(text: string): ParsedImage | null {
  const m = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)$/.exec(text.trim())
  return m ? { alt: m[1], src: m[2] } : null
}

/** Parse an HTML `<img src alt width>` tag (attribute order-independent). */
export function parseHtmlImage(text: string): ParsedImage | null {
  const t = text.trim()
  if (!/^<img\b[^>]*>$/i.test(t)) return null
  const attr = (name: string): string | undefined =>
    new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(t)?.[1] ??
    new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(t)?.[1]
  const src = attr('src')
  if (!src) return null
  const widthRaw = attr('width')
  const width = widthRaw && /^\d+$/.test(widthRaw) ? Number(widthRaw) : undefined
  return { alt: attr('alt') ?? '', src, width }
}

/** Parse either image syntax. */
export function parseImage(text: string): ParsedImage | null {
  return parseMarkdownImage(text) ?? parseHtmlImage(text)
}

/** Serialize to markdown (drops width — markdown has no size syntax). */
export function toMarkdownImage(img: ParsedImage): string {
  return `![${img.alt}](${img.src})`
}

/** Serialize to an HTML `<img>` tag, including width when present. */
export function toHtmlImage(img: ParsedImage): string {
  const parts = [`src="${img.src}"`]
  if (img.alt) parts.push(`alt="${img.alt}"`)
  if (img.width) parts.push(`width="${img.width}"`)
  return `<img ${parts.join(' ')} />`
}
