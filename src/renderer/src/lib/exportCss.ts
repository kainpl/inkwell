/**
 * Self-contained light "print" stylesheet embedded into exported HTML / PDF /
 * print output. Standalone (no app or CodeMirror chrome). Kept as a string so it
 * can be inlined into the document `<head>` and unit-tested without a bundler.
 */
export const EXPORT_CSS = `
:root { --ink:#1a1a18; --muted:#5b5953; --line:#e6e3dd; --accent:#a85a32; --code-bg:#f5f3ef; }
* { box-sizing: border-box; }
body {
  margin: 0 auto; max-width: 820px; padding: 48px 56px;
  font: 16px/1.7 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--ink); background: #fff;
}
h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.6em 0 0.6em; font-weight: 700; }
h1 { font-size: 2em; } h2 { font-size: 1.55em; } h3 { font-size: 1.25em; }
h4 { font-size: 1.05em; } h5,h6 { font-size: 1em; color: var(--muted); }
p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
a { color: var(--accent); }
hr { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
strong { font-weight: 700; } em { font-style: italic; }
mark { background: #fff1a8; padding: 0 .12em; border-radius: 2px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .9em;
  background: var(--code-bg); padding: .12em .3em; border-radius: 3px; }
pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 6px;
  padding: 12px 14px; overflow: auto; }
pre code { background: none; padding: 0; font-size: .88em; }
blockquote { margin-left: 0; padding: .2em 1em; border-left: 3px solid var(--line); color: var(--muted); }
blockquote.ink-alert { border-left-width: 4px; border-radius: 4px; padding: .6em 1em;
  background: #f6f8fa; border-color: #d0d7de; }
blockquote.ink-alert .ink-alert-label { display: block; font-weight: 700; margin-bottom: .2em; }
blockquote.ink-alert-note { border-color:#3b82f6; } blockquote.ink-alert-note .ink-alert-label { color:#3b82f6; }
blockquote.ink-alert-tip { border-color:#22a06b; } blockquote.ink-alert-tip .ink-alert-label { color:#22a06b; }
blockquote.ink-alert-important { border-color:#8957e5; } blockquote.ink-alert-important .ink-alert-label { color:#8957e5; }
blockquote.ink-alert-warning { border-color:#d29922; } blockquote.ink-alert-warning .ink-alert-label { color:#bf8700; }
blockquote.ink-alert-caution { border-color:#cf222e; } blockquote.ink-alert-caution .ink-alert-label { color:#cf222e; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--line); padding: 6px 10px; }
th { background: var(--code-bg); }
img { max-width: 100%; height: auto; }
ul.contains-task-list { list-style: none; padding-left: 1.2em; }
.task-list-item input { margin: 0 .5em 0 -1.2em; }
.ink-toc { border: 1px solid var(--line); border-radius: 6px; padding: .6em 1em; background: #fcfbf9; }
.ink-toc-title { font-weight: 700; margin-bottom: .3em; }
.ink-toc a { display: block; color: var(--ink); text-decoration: none; padding: .1em 0; }
.ink-toc a:hover { color: var(--accent); }
.ink-toc-l2 { padding-left: 1em; } .ink-toc-l3 { padding-left: 2em; }
.ink-toc-l4 { padding-left: 3em; } .ink-toc-l5,.ink-toc-l6 { padding-left: 4em; }
.ink-mermaid svg { max-width: 100%; }
.footnotes { font-size: .9em; color: var(--muted); border-top: 1px solid var(--line); margin-top: 2em; }
`
