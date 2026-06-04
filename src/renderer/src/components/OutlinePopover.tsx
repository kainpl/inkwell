import { useEffect, useMemo, useRef, useState } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { parseOutline } from '@renderer/lib/outline'
import { fuzzyFilter } from '@renderer/lib/fuzzy'
import { useT } from '@renderer/lib/i18n'
import { GOTO_EVENT } from './Editor/Editor'

/**
 * Floating quick-jump outline (Ctrl/Cmd+Shift+O). Lists the open document's
 * headings, fuzzy-filters as you type, ↑/↓ navigate, Enter jumps to the heading
 * (via GOTO_EVENT), Esc closes. A lightweight companion to the sidebar Outline
 * tab — jump without opening the sidebar.
 */
export default function OutlinePopover(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useT()

  useEffect(() => {
    return window.api.onMenu(IPC.menuOutlinePopover, () => {
      setContent(useAppStore.getState().doc.content)
      setQuery('')
      setIndex(0)
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const headings = useMemo(() => parseOutline(content), [content])
  const results = useMemo(
    () => fuzzyFilter(headings, query, (h) => h.text).slice(0, 100),
    [headings, query]
  )

  if (!open) return null

  const choose = (from: number | undefined): void => {
    setOpen(false)
    if (from != null) window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: from }))
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
      choose(results[index]?.from)
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
          placeholder={t('outlinePopover.placeholder')}
          className="w-full border-b border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-faint">{t('outline.noHeadings')}</div>
          ) : (
            results.map((h, i) => (
              <button
                key={h.from}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(h.from)}
                className={
                  'block w-full truncate px-3 py-1.5 text-left text-sm ' +
                  (i === index ? 'bg-accent/10 text-accent' : 'text-ink/80')
                }
                style={{ paddingLeft: `${0.75 + (h.level - 1) * 0.85}rem` }}
              >
                {h.text}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
