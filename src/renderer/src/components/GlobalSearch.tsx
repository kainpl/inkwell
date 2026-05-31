import { useEffect, useRef, useState } from 'react'
import type { SearchFileResult } from '@shared/ipc'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from '@renderer/lib/docActions'
import { GOTO_EVENT } from './Editor/Editor'

/**
 * Global "search in folder" (Ctrl/Cmd+Shift+F). Opens on the menu event,
 * queries the main process for matches across all markdown files, and lets the
 * user jump to a match (opens the file via the unsaved guard, then scrolls).
 */
export default function GlobalSearch(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchFileResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return window.api.onMenu(IPC.menuGlobalSearch, () => {
      if (!useAppStore.getState().root) return
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Debounced search as the query changes. All state updates happen inside the
  // timeout (async) so none run synchronously during the effect.
  useEffect(() => {
    if (!open) return
    const root = useAppStore.getState().root
    const handle = setTimeout(() => {
      if (!root || query.trim() === '') {
        setResults([])
        setSearching(false)
        return
      }
      setSearching(true)
      void window.api.searchInFolder(root.path, query).then((r) => {
        setResults(r)
        setSearching(false)
      })
    }, 200)
    return () => clearTimeout(handle)
  }, [query, open])

  if (!open) return null

  const jump = (path: string, offset: number): void => {
    setOpen(false)
    void openPath(path).then(() => {
      // Wait a frame so the editor has the new content before scrolling.
      requestAnimationFrame(() =>
        window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: offset }))
      )
    })
  }

  const totalMatches = results.reduce((n, f) => n + f.matches.length, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="flex max-h-[75vh] w-[40rem] max-w-[92vw] flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Search in folder…"
          className="w-full border-b border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="border-b border-line px-3 py-1 text-[11px] text-faint">
          {searching
            ? 'Searching…'
            : query.trim() === ''
              ? 'Type to search all markdown files'
              : `${totalMatches} matches in ${results.length} files`}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.map((file) => (
            <div key={file.path}>
              <div className="sticky top-0 bg-chrome px-3 py-1 text-[12px] font-medium text-muted">
                {file.name}
              </div>
              {file.matches.map((m, i) => (
                <button
                  key={i}
                  onClick={() => jump(file.path, m.offset)}
                  className="flex w-full items-baseline gap-2 px-3 py-1 text-left text-[13px] hover:bg-ink/5"
                >
                  <span className="shrink-0 text-[11px] text-faint">{m.line}</span>
                  <span className="truncate text-ink/80">{m.text}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
