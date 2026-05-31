import { useMemo, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useEditor } from '@renderer/store/useEditor'
import { parseOutline } from '@renderer/lib/outline'
import { GOTO_EVENT } from './Editor/Editor'

export default function OutlinePanel(): JSX.Element | null {
  const outlineOpen = useAppStore((s) => s.outlineOpen)
  const content = useAppStore((s) => s.doc.content)
  // Re-render on caret moves so the active heading highlight stays current.
  const selVersion = useEditor((s) => s.selVersion)
  const view = useEditor((s) => s.view)

  const headings = useMemo(() => parseOutline(content), [content])
  // Collapsed headings keyed by their character offset (stable across edits).
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  // Active heading = the last one at or before the caret.
  const activeFrom = useMemo(() => {
    void selVersion
    const caret = view?.state.selection.main.head ?? 0
    let active = -1
    for (const h of headings) {
      if (h.from <= caret) active = h.from
      else break
    }
    return active
  }, [headings, selVersion, view])

  if (!outlineOpen) return null

  const toggle = (from: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(from)) next.delete(from)
      else next.add(from)
      return next
    })
  }

  const collapseAll = (): void => setCollapsed(new Set(headings.map((h) => h.from)))
  const expandAll = (): void => setCollapsed(new Set())

  // Compute which headings are hidden: a heading collapsed at level L hides
  // following headings with level > L until a heading with level <= L.
  const hidden = new Set<number>()
  for (let i = 0; i < headings.length; i++) {
    if (collapsed.has(headings[i].from)) {
      const level = headings[i].level
      for (let j = i + 1; j < headings.length && headings[j].level > level; j++) {
        hidden.add(headings[j].from)
      }
    }
  }

  // Does heading i have any deeper heading directly under it? (collapse arrow)
  const hasChildren = (i: number): boolean =>
    i + 1 < headings.length && headings[i + 1].level > headings[i].level

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-l border-line bg-chrome">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Outline</span>
        {headings.length > 0 && (
          <div className="flex gap-1 text-[11px] text-faint">
            <button onClick={collapseAll} title="Collapse all" className="hover:text-ink">
              −
            </button>
            <button onClick={expandAll} title="Expand all" className="hover:text-ink">
              +
            </button>
          </div>
        )}
      </div>
      <div className="overflow-y-auto p-1">
        {headings.length === 0 ? (
          <div className="px-2 py-2 text-[13px] text-faint">No headings</div>
        ) : (
          headings.map((h, i) =>
            hidden.has(h.from) ? null : (
              <div key={h.from} className="flex items-center">
                <button
                  onClick={() => toggle(h.from)}
                  className="w-4 shrink-0 text-faint hover:text-ink"
                  style={{ marginLeft: `${(h.level - 1) * 12}px` }}
                  title={hasChildren(i) ? 'Collapse / expand' : ''}
                >
                  {hasChildren(i) ? (collapsed.has(h.from) ? '▸' : '▾') : ''}
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: h.from }))}
                  className={
                    'min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-[13px] hover:bg-ink/5 ' +
                    (h.from === activeFrom ? 'text-accent' : 'text-ink/80')
                  }
                >
                  {h.text}
                </button>
              </div>
            )
          )
        )}
      </div>
    </aside>
  )
}
