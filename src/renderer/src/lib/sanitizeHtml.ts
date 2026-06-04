import DOMPurify from 'dompurify'

/**
 * Shared HTML sanitizer for both the live-preview HTML-block widget and the
 * export renderer (same `dompurify` singleton, so the iframe hook below is
 * registered once and applies to both).
 *
 * Default: strips scripts/handlers, keeps inline HTML the doc relies on (`<u>`),
 * KaTeX MathML and mermaid SVG. With `allowEmbeds`, additionally permits
 * iframe/video/audio embeds — but the gate is strict: iframes are forced to
 * **https only** with a restrictive **sandbox**, and `srcdoc` is always dropped.
 */

const BASE_OPTS = { USE_PROFILES: { html: true, mathMl: true, svg: true } } as const

const EMBED_TAGS = ['iframe', 'video', 'audio', 'source', 'track']
const EMBED_ATTRS = [
  'src',
  'width',
  'height',
  'allow',
  'allowfullscreen',
  'frameborder',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'playsinline',
  'poster',
  'preload',
  'type',
  'sandbox',
  'referrerpolicy',
  'title',
  'kind',
  'srclang',
  'label'
]

const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-presentation'

let hooked = false
function ensureHook(): void {
  if (hooked) return
  hooked = true
  // Runs for every sanitize call, but only touches iframes — which survive only
  // when `allowEmbeds` adds them to the allow-list, so this is a no-op otherwise.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ((node as Element).tagName !== 'IFRAME') return
    const el = node as Element
    const src = el.getAttribute('src') ?? ''
    if (!/^https:\/\//i.test(src)) el.removeAttribute('src') // https only
    el.removeAttribute('srcdoc') // never allow inline iframe documents
    el.setAttribute('sandbox', el.getAttribute('sandbox') ?? IFRAME_SANDBOX)
  })
}

export function sanitizeHtml(html: string, allowEmbeds = false): string {
  ensureHook()
  const opts = allowEmbeds
    ? { ...BASE_OPTS, ADD_TAGS: EMBED_TAGS, ADD_ATTR: EMBED_ATTRS }
    : BASE_OPTS
  return DOMPurify.sanitize(html, opts) as string
}
