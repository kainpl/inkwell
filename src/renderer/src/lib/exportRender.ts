import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import mark from 'markdown-it-mark'
import deflist from 'markdown-it-deflist'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?raw'
import hljs from 'highlight.js'
import hljsCss from 'highlight.js/styles/github.css?raw'
import hljsDarkCss from 'highlight.js/styles/github-dark.css?raw'
import DOMPurify from 'dompurify'
import { get as emojiGet } from 'node-emoji'
import { EXPORT_CSS } from './exportCss'
import { type MarkdownFeatures, DEFAULT_MARKDOWN_FEATURES } from './markdownFeatures'

/**
 * The export render engine: turns a Markdown document into standalone, sanitized
 * HTML for Export HTML / Print / PDF. Separate from the CodeMirror live preview
 * (which is decorations, not HTML). `renderMarkdownBody` is the synchronous core;
 * `renderDocumentHtml` adds the async bits (mermaid diagrams, local-image
 * embedding) plus alerts / `[toc]` and wraps everything in a full document.
 */

/** Render `:shortcode:` emoji inline (mirrors the editor's node-emoji usage). */
function emojiPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('emphasis', 'ink-emoji', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) return false
    const m = /^:([a-z0-9_+-]+):/.exec(state.src.slice(state.pos))
    if (!m) return false
    const char = emojiGet(m[1])
    if (!char || char.includes(':')) return false
    if (!silent) state.push('text', '', 0).content = char
    state.pos += m[0].length
    return true
  })
}

/** `### Title {#id}` → set the heading's `id` attribute and strip the marker. */
function headingIdPlugin(md: MarkdownIt): void {
  md.core.ruler.push('ink-heading-id', (state) => {
    const tokens = state.tokens
    const idRe = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/
    for (let i = 0; i + 1 < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open' || tokens[i + 1].type !== 'inline') continue
      const inline = tokens[i + 1]
      const m = idRe.exec(inline.content)
      if (!m) continue
      tokens[i].attrSet('id', m[1])
      inline.content = inline.content.slice(0, m.index)
      const last = inline.children?.[inline.children.length - 1]
      if (last && last.type === 'text') last.content = last.content.replace(idRe, '')
    }
    return true
  })
}

// Syntax-highlight fenced code with a known language (highlight.js). Unknown
// langs (e.g. mermaid) return '' so markdown-it keeps the default code block.
function highlightCode(str: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const out = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      return `<pre class="hljs"><code class="language-${lang}">${out}</code></pre>`
    } catch {
      /* fall through to default */
    }
  }
  return ''
}

/** Build a markdown-it configured for the enabled features. */
function buildMd(f: MarkdownFeatures): MarkdownIt {
  const m = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight: highlightCode
  }).use(taskLists, { enabled: true, label: true })
  if (f.footnotes) m.use(footnote)
  if (f.subSup) m.use(sub).use(sup)
  if (f.highlight) m.use(mark)
  if (f.defList) m.use(deflist)
  if (f.math)
    m.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: false } })
  if (f.emoji) m.use(emojiPlugin)
  if (f.headingIds) m.use(headingIdPlugin)
  return m
}

// Cache one markdown-it per distinct feature set (exports are infrequent).
const mdCache = new Map<string, MarkdownIt>()
function getMd(f: MarkdownFeatures): MarkdownIt {
  const key = JSON.stringify(f)
  let m = mdCache.get(key)
  if (!m) {
    m = buildMd(f)
    mdCache.set(key, m)
  }
  return m
}

/** DOMPurify config: allow HTML + KaTeX's MathML + SVG (mermaid), drop scripts. */
const PURIFY_OPTS = { USE_PROFILES: { html: true, mathMl: true, svg: true } } as const

/**
 * Render the Markdown body to a **sanitized** HTML fragment (no `<html>`
 * wrapper). `html: true` lets through inline raw HTML the document relies on
 * (e.g. `<u>`), so the output MUST be sanitized — a document is untrusted input,
 * and the HTML is later written to a file / loaded into a print window. DOMPurify
 * strips scripts and event handlers while keeping KaTeX (MathML) and SVG.
 */
export function renderMarkdownBody(
  markdown: string,
  features: MarkdownFeatures = DEFAULT_MARKDOWN_FEATURES
): string {
  return DOMPurify.sanitize(getMd(features).render(markdown), PURIFY_OPTS)
}

/** Plain text of the document (markdown stripped), with blocks on their own lines. */
export function renderPlainText(markdown: string): string {
  const doc = new DOMParser().parseFromString(renderMarkdownBody(markdown), 'text/html')
  doc.body
    .querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,br,hr')
    .forEach((el) => el.append('\n'))
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

// ---- Document-level post-processing (operates on a parsed DOM) -------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

/** Turn `> [!NOTE]` blockquotes into styled GitHub-style alerts. */
function applyAlerts(doc: Document): void {
  doc.querySelectorAll('blockquote').forEach((bq) => {
    const p = bq.querySelector('p')
    if (!p) return
    const m = ALERT_RE.exec(p.textContent ?? '')
    if (!m) return
    const type = m[1].toLowerCase()
    bq.classList.add('ink-alert', `ink-alert-${type}`)
    p.innerHTML = p.innerHTML.replace(ALERT_RE, '')
    const label = doc.createElement('span')
    label.className = 'ink-alert-label'
    label.textContent = type.charAt(0).toUpperCase() + type.slice(1)
    bq.insertBefore(label, bq.firstChild)
  })
}

/** Replace a `[toc]` paragraph with a generated table of contents. */
function applyToc(doc: Document): void {
  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')]
  doc.querySelectorAll('p').forEach((p) => {
    if ((p.textContent ?? '').trim().toLowerCase() !== '[toc]') return
    const nav = doc.createElement('nav')
    nav.className = 'ink-toc'
    const title = doc.createElement('div')
    title.className = 'ink-toc-title'
    title.textContent = 'Table of Contents'
    nav.appendChild(title)
    headings.forEach((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? '')
      const a = doc.createElement('a')
      a.className = `ink-toc-l${h.tagName[1]}`
      a.href = `#${h.id}`
      a.textContent = h.textContent ?? ''
      nav.appendChild(a)
    })
    p.replaceWith(nav)
  })
}

/** Render ```mermaid blocks to inline SVG. */
async function applyMermaid(
  doc: Document,
  render: (code: string) => Promise<string>
): Promise<void> {
  const blocks = [...doc.querySelectorAll('code[class*="language-mermaid"]')]
  for (const codeEl of blocks) {
    const pre = codeEl.closest('pre') ?? codeEl
    const svg = await render(codeEl.textContent ?? '')
    const wrap = doc.createElement('div')
    wrap.className = 'ink-mermaid'
    wrap.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, html: true } })
    pre.replaceWith(wrap)
  }
}

/** Resolve a local image src to a URL the renderer can fetch (custom protocol). */
function localImageUrl(src: string, docPath: string | null): string {
  const s = src.trim()
  if (/^(https?|data|blob|inkfile):/i.test(s)) return s
  if (/^file:/i.test(s)) return s.replace(/^file:/i, 'inkfile:')
  if (!docPath) return s
  const dir = docPath.slice(0, Math.max(docPath.lastIndexOf('/'), docPath.lastIndexOf('\\')))
  const combined = (dir + '/' + s).replace(/\\/g, '/')
  const out: string[] = []
  for (const part of combined.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  const joined = encodeURI(out.join('/'))
  return /^[a-zA-Z]:/.test(combined) ? 'inkfile:///' + joined : 'inkfile://' + joined
}

/** Inline a fetchable URL as a data: URI, or null on failure. */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Embed local images as data: URIs so the exported HTML is self-contained. */
async function embedImages(
  doc: Document,
  docPath: string | null,
  embed: (url: string) => Promise<string | null>
): Promise<void> {
  for (const img of [...doc.querySelectorAll('img')]) {
    const src = img.getAttribute('src') ?? ''
    if (/^(https?|data):/i.test(src)) continue
    const dataUri = await embed(localImageUrl(src, docPath))
    if (dataUri) img.setAttribute('src', dataUri)
  }
}

async function defaultMermaid(code: string): Promise<string> {
  const { renderMermaid } = await import('./mermaidRender')
  const { svg, error } = await renderMermaid(code, false)
  if (error) return `<pre>${error.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre>`
  return svg ?? ''
}

function wrapHtml(body: string, styled: boolean, opts: RenderDocOptions): string {
  let css = ''
  if (styled) {
    css = `${katexCss}\n${opts.dark ? hljsDarkCss : hljsCss}\n${EXPORT_CSS}`
    if (opts.breakBeforeH1 === true) css += '\nh1:not(:first-of-type){break-before:page;}'
    // Theme palette / user export CSS overrides the built-in print stylesheet.
    if (opts.themeCss) css += '\n' + opts.themeCss
  }
  const head = css ? `<style>\n${css}\n</style>` : ''
  return `<!doctype html>\n<html><head><meta charset="utf-8">${head}</head>\n<body>\n${body}\n</body>\n</html>`
}

export interface RenderDocOptions {
  /** Document path, to resolve relative image paths. */
  docPath?: string | null
  /** Embed the print stylesheet (HTML "with styles" / print / PDF). Default true. */
  styled?: boolean
  /** Add a CSS page break before each H1 (except the first) — for print/PDF. */
  breakBeforeH1?: boolean
  /** Embed local images as data: URIs (default true). HTML export may turn off. */
  embed?: boolean
  /** Extra CSS appended after the print stylesheet (theme palette + export.user.css). */
  themeCss?: string
  /** Use the dark code-highlight stylesheet (when matching a dark theme). */
  dark?: boolean
  /** Toggleable Markdown features (defaults to all on). */
  features?: MarkdownFeatures
  /** Injectable for tests. */
  renderMermaidSvg?: (code: string) => Promise<string>
  embedImage?: (url: string) => Promise<string | null>
}

/**
 * Render a full standalone HTML document (sanitized) from Markdown: body +
 * alerts + `[toc]` + mermaid SVGs + embedded local images, wrapped with the
 * print stylesheet. Used by Export HTML, Print and Export PDF.
 */
export async function renderDocumentHtml(
  markdown: string,
  opts: RenderDocOptions = {}
): Promise<string> {
  const features = opts.features ?? DEFAULT_MARKDOWN_FEATURES
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${renderMarkdownBody(markdown, features)}</body>`,
    'text/html'
  )
  if (features.alerts) applyAlerts(doc)
  if (features.toc) applyToc(doc)
  if (features.mermaid) await applyMermaid(doc, opts.renderMermaidSvg ?? defaultMermaid)
  if (opts.embed !== false) {
    await embedImages(doc, opts.docPath ?? null, opts.embedImage ?? fetchAsDataUri)
  }
  return wrapHtml(doc.body.innerHTML, opts.styled !== false, opts)
}
