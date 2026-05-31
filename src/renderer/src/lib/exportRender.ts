import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import mark from 'markdown-it-mark'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import DOMPurify from 'dompurify'

/**
 * The export render engine: turns a Markdown document into standalone HTML for
 * Export HTML / Print / PDF. Separate from the CodeMirror live preview (which is
 * decorations, not HTML). This module is the synchronous core — it renders the
 * Markdown body; mermaid diagrams and local-image embedding are async and added
 * by `renderDocumentHtml` (a later step) on top of this output.
 */

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
  .use(footnote)
  .use(taskLists, { enabled: true, label: true })
  .use(sub)
  .use(sup)
  .use(mark)
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false }
  })

/** DOMPurify config: allow HTML + KaTeX's MathML + SVG (mermaid), drop scripts. */
const PURIFY_OPTS = { USE_PROFILES: { html: true, mathMl: true, svg: true } } as const

/**
 * Render the Markdown body to a **sanitized** HTML fragment (no `<html>`
 * wrapper). `html: true` lets through inline raw HTML the document relies on
 * (e.g. `<u>`), so the output MUST be sanitized — a document is untrusted input,
 * and the HTML is later written to a file / loaded into a print window. DOMPurify
 * strips scripts and event handlers while keeping KaTeX (MathML) and SVG.
 */
export function renderMarkdownBody(markdown: string): string {
  return DOMPurify.sanitize(md.render(markdown), PURIFY_OPTS)
}
