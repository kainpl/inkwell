import type { GraphModel, GraphNode, LinkType, NodeData } from '@shared/mindmap/types'

export interface HtmlDoc {
  label: string
  items: { title: string; content: string }[]
}

export interface HtmlExportInput {
  title: string
  graph: GraphModel
  linkTypes: Record<string, LinkType>
  /** nodeId → its attached docs (internal only). */
  docs: Record<string, HtmlDoc>
  /** Bundle asset path (`assets/…`) → base64 data URI, inlined into doc images. */
  assets?: Record<string, string>
  /** Render a doc body's Markdown to a **sanitized** HTML fragment. When given,
   *  doc bodies render as HTML (`.ink-doc`) instead of an escaped `<pre>`. */
  renderMd?: (markdown: string) => string
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STYLE = `:root{--ink:#1c2530;--muted:#5b6675;--line:#d7dde6;--paper:#fff}
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#f3f5f8;padding:24px}
.wrap{max-width:920px;margin:0 auto;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:24px 28px}
h1{margin:0 0 16px;font-size:22px}
ul.tree,ul.tree ul{list-style:none;margin:0;padding-left:18px}
ul.tree ul{border-left:1px solid var(--line)}
li{margin:5px 0}
.node{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:2px 8px;background:var(--paper)}
.node a{color:inherit;text-decoration:none;border-bottom:1px dotted currentColor}
.tags{margin-left:6px}
.tag{display:inline-block;background:#eef1f5;color:var(--muted);border-radius:4px;padding:0 5px;font-size:11px;margin-left:3px}
.xlinks{margin:2px 0 2px 4px}
.xlink{display:inline-block;font-size:12px;margin-right:10px}
.docs{margin:4px 0 4px 4px}
details{margin:3px 0;border:1px solid var(--line);border-radius:6px;padding:4px 8px;background:#fafbfc}
summary{cursor:pointer;color:var(--muted);font-size:13px}
pre{white-space:pre-wrap;word-break:break-word;margin:8px 0 2px;font:13px/1.5 ui-monospace,Consolas,monospace}
.ink-doc{font-size:14px;margin:8px 0 2px}
.ink-doc>:first-child{margin-top:0}
.ink-doc h1,.ink-doc h2,.ink-doc h3,.ink-doc h4{margin:10px 0 4px;font-size:1em;font-weight:600}
.ink-doc p{margin:6px 0}
.ink-doc ul,.ink-doc ol{margin:6px 0;padding-left:20px}
.ink-doc code{background:#eef1f5;border-radius:4px;padding:0 4px;font:13px/1.4 ui-monospace,Consolas,monospace}
.ink-doc pre{background:#f6f8fa;padding:8px;border-radius:6px;overflow:auto}
.ink-doc pre code{background:none;padding:0}
.ink-doc blockquote{margin:6px 0;padding-left:10px;border-left:3px solid var(--line);color:var(--muted)}
.ink-doc img{max-width:100%}
.ink-doc table{border-collapse:collapse;margin:6px 0}
.ink-doc th,.ink-doc td{border:1px solid var(--line);padding:3px 7px}
.ink-doc a{color:#2563af}
footer{max-width:920px;margin:12px auto 0;color:var(--muted);font-size:12px;text-align:center}`

/** Pure: render an engine-agnostic project graph as a single self-contained HTML page. */
export function renderProjectHtml(input: HtmlExportInput): string {
  const { title, graph, linkTypes, docs, assets, renderMd } = input
  const byId = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]))
  const labelOf = (id: string): string => byId.get(id)?.label ?? id

  // With a Markdown renderer: render to sanitized HTML, then inline bundled
  // `src="assets/…"` images. Otherwise: escape into a <pre>, inlining `![](assets/…)`.
  const renderDocBody = (content: string): string => {
    if (renderMd) {
      let html = renderMd(content)
      if (assets) {
        html = html.replace(/src="(assets\/[^"]+)"/g, (m, p: string) =>
          assets[p] ? `src="${assets[p]}"` : m
        )
      }
      return `<div class="ink-doc">${html}</div>`
    }
    let html = esc(content)
    if (assets) {
      html = html.replace(/!\[[^\]]*\]\((assets\/[^)\s]+)\)/g, (m, p: string) =>
        assets[p] ? `<img src="${assets[p]}" alt="" style="max-width:100%;display:block;margin:6px 0">` : m
      )
    }
    return `<pre>${html}</pre>`
  }

  const crossOf = (id: string): string => {
    const links = graph.edges.filter((e) => e.kind === 'cross' && e.source === id)
    if (!links.length) return ''
    const items = links.map((e) => {
      const lt = linkTypes[e.type ?? ''] ?? { label: e.type ?? 'relates to', color: '#7a8aa0' }
      const note = e.label ? ` (${esc(e.label)})` : ''
      return `<span class="xlink" style="color:${esc(lt.color)}">→ ${esc(lt.label)}: ${esc(labelOf(e.target))}${note}</span>`
    })
    return `<div class="xlinks">${items.join('')}</div>`
  }

  const docsOf = (id: string): string => {
    const d = docs[id]
    if (!d || !d.items.length) return ''
    const secs = d.items.map(
      (it, i) =>
        `<details id="doc-${esc(id)}-${i}"><summary>${esc(it.title || 'Document')}</summary>${renderDocBody(it.content)}</details>`
    )
    return `<div class="docs">${secs.join('')}</div>`
  }

  const chip = (n: GraphNode): string => {
    const data = n.data as NodeData
    const fill = typeof data.fillColor === 'string' ? `background:${esc(data.fillColor)};` : ''
    const color = typeof data.color === 'string' ? `color:${esc(data.color)};` : ''
    const border = typeof data.lineColor === 'string' ? `border-color:${esc(data.lineColor)};` : ''
    const icons = Array.isArray(data.icon) && data.icon.length
      ? `${data.icon.map((i) => esc(i)).join(' ')} `
      : ''
    const tags =
      Array.isArray(data.tag) && data.tag.length
        ? ` <span class="tags">${data.tag.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>`
        : ''
    const label = `${icons}${esc(n.label)}`
    const inner = docs[n.id]?.items.length ? `<a href="#doc-${esc(n.id)}-0">${label}</a>` : label
    return `<span class="node" style="${fill}${color}${border}">${inner}</span>${tags}`
  }

  const renderNode = (id: string): string => {
    const n = byId.get(id)
    if (!n) return ''
    const children = graph.childrenOf.get(id) ?? []
    const kids = children.length ? `<ul>${children.map(renderNode).join('')}</ul>` : ''
    return `<li>${chip(n)}${crossOf(id)}${docsOf(id)}${kids}</li>`
  }

  const roots = graph.nodes.filter((n) => n.parentId === null).map((n) => n.id)
  const tree = `<ul class="tree">${roots.map(renderNode).join('')}</ul>`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style></head>
<body><div class="wrap"><h1>${esc(title)}</h1>${tree}</div>
<footer>Exported from Inkwell</footer></body></html>`
}
