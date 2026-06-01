import { useEffect, useMemo, useState } from 'react'
import type { ArticleEntry } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from '@renderer/lib/docActions'
import { prepareArticles, relativeTime, type ArticleSort } from '@renderer/lib/articles'
import FileTree from './FileTree'
import DriveAccountTree from './DriveTree'

/**
 * The "Files" tab. A source dropdown at the top selects what the panel shows:
 * "Local" (the workspace file tree, with filter/sort) or — when Google accounts
 * are connected — a specific account's Drive. Connecting accounts lives in
 * Preferences ▸ Cloud, not here.
 */
export default function FilesPanel(): JSX.Element {
  const root = useAppStore((s) => s.root)
  const activePath = useAppStore((s) => s.doc.path)
  const accounts = useAppStore((s) => s.driveAccounts)
  const [source, setSource] = useState('local')
  const [articles, setArticles] = useState<ArticleEntry[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ArticleSort>('name')
  const [now, setNow] = useState(0)

  // Fall back to local if the selected account is gone (disconnected).
  const activeSource =
    source === 'local' || accounts.some((a) => a.accountId === source) ? source : 'local'
  const local = activeSource === 'local'

  // "Find" mode = a flat list; otherwise the tree. Local source only.
  const finding = local && (query.trim() !== '' || sort === 'modified')

  useEffect(() => {
    if (!root || !finding) return
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
  }, [root, finding])

  const shown = useMemo(() => prepareArticles(articles, query, sort), [articles, query, sort])

  return (
    <div className="flex h-full flex-col">
      {accounts.length > 0 && (
        <div className="border-b border-line p-2">
          <select
            value={activeSource}
            onChange={(e) => setSource(e.target.value)}
            title="File source"
            className="w-full rounded border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
          >
            <option value="local">📁 Local</option>
            <optgroup label="Google Drive">
              {accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  ☁ {a.email}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {local && root && (
        <div className="flex items-center gap-1 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="min-w-0 flex-1 rounded border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
          />
          <button
            onClick={() => setSort((s) => (s === 'modified' ? 'name' : 'modified'))}
            title="Toggle sort (tree ⇄ flat list by recency)"
            className="shrink-0 rounded border border-line px-1.5 py-1 text-[11px] text-muted hover:text-ink"
          >
            {sort === 'modified' ? 'Recent' : 'A–Z'}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!local ? (
          <DriveAccountTree accountId={activeSource} />
        ) : !finding ? (
          <FileTree />
        ) : shown.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-faint">No markdown files</div>
        ) : (
          <div className="px-1 pb-1">
            {shown.map((a) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
