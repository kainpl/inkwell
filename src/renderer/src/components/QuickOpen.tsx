import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleEntry } from '@shared/ipc'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from '@renderer/lib/docActions'
import { fuzzyFilter } from '@renderer/lib/fuzzy'

/**
 * Quick-open file switcher (Ctrl/Cmd+P). Opens on the menu event, loads the
 * workspace markdown list, fuzzy-filters as you type, navigate with ↑/↓, Enter
 * opens (through the unsaved-changes guard), Esc closes.
 */
export default function QuickOpen(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [articles, setArticles] = useState<ArticleEntry[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Open on the menu command; load the file list fresh each time.
  useEffect(() => {
    return window.api.onMenu(IPC.menuOpenQuickly, () => {
      const root = useAppStore.getState().root
      if (!root) return
      void window.api.listArticles(root.path).then((list) => {
        setArticles(list)
        setQuery('')
        setIndex(0)
        setOpen(true)
      })
    })
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo(
    () => fuzzyFilter(articles, query, (a) => a.name).slice(0, 50),
    [articles, query]
  )

  if (!open) return null

  const choose = (entry: ArticleEntry | undefined): void => {
    setOpen(false)
    if (entry) void openPath(entry.path)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[index])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-[32rem] max-w-[90vw] overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={onKey}
          placeholder="Open file by name…"
          className="w-full border-b border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-faint">No matching files</div>
          ) : (
            results.map((a, i) => (
              <button
                key={a.path}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(a)}
                className={
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ' +
                  (i === index ? 'bg-accent/10 text-accent' : 'text-ink/80')
                }
              >
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 truncate text-[11px] text-faint">{a.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
