import { useEffect, useMemo, useState } from 'react'
import type { ArticleEntry } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from '@renderer/lib/docActions'
import { prepareArticles, relativeTime, type ArticleSort } from '@renderer/lib/articles'

/** Flat, sortable, filterable list of every markdown file in the workspace. */
export default function ArticlesPanel(): JSX.Element {
  const root = useAppStore((s) => s.root)
  const activePath = useAppStore((s) => s.doc.path)
  const [articles, setArticles] = useState<ArticleEntry[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ArticleSort>('modified')
  const [now, setNow] = useState(0)

  // (Re)load the list whenever the open folder changes.
  useEffect(() => {
    if (!root) {
      setArticles([])
      return
    }
    let cancelled = false
    void window.api.listArticles(root.path).then((list) => {
      if (!cancelled) {
        setArticles(list)
        setNow(list.reduce((max, a) => Math.max(max, a.mtime), 0))
      }
    })
    return () => {
      cancelled = true
    }
  }, [root])

  const shown = useMemo(() => prepareArticles(articles, query, sort), [articles, query, sort])

  if (!root) {
    return (
      <div className="px-3 py-6 text-[13px] leading-relaxed text-faint">
        No folder open.
        <br />
        <span className="text-muted">⌘/Ctrl + Shift + O</span> to open one.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          className="min-w-0 flex-1 rounded border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
        />
        <button
          onClick={() => setSort((s) => (s === 'modified' ? 'name' : 'modified'))}
          title="Toggle sort"
          className="shrink-0 rounded border border-line px-1.5 py-1 text-[11px] text-muted hover:text-ink"
        >
          {sort === 'modified' ? 'Recent' : 'A–Z'}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        {shown.length === 0 ? (
          <div className="px-2 py-2 text-[13px] text-faint">No markdown files</div>
        ) : (
          shown.map((a) => (
            <button
              key={a.path}
              onClick={() => void openPath(a.path)}
              title={a.path}
              className={
                'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[13px] hover:bg-ink/5 ' +
                (a.path === activePath ? 'bg-accent/10 text-accent' : 'text-ink/80')
              }
            >
              <span className="truncate">{a.name}</span>
              {sort === 'modified' && now > 0 && (
                <span className="shrink-0 text-[11px] text-faint">{relativeTime(a.mtime, now)}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
