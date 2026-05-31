import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import mark from 'markdown-it-mark'
import texmath from 'markdown-it-texmath'
import katex from 'katex'

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

/** Render the Markdown body to an HTML fragment (no `<html>` wrapper). */
export function renderMarkdownBody(markdown: string): string {
  return md.render(markdown)
}
