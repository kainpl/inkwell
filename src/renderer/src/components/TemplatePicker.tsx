import { useEffect, useMemo, useRef, useState } from 'react'
import type { TemplateEntry } from '@shared/ipc'
import { IPC } from '@shared/ipc'
import { fuzzyFilter } from '@renderer/lib/fuzzy'
import { newDocumentFromTemplate } from '@renderer/lib/docActions'

/**
 * "New from Template…" picker (File menu / command palette). Lists the .md files
 * in the templates folder, fuzzy-filters, and on Enter creates a new untitled
 * document seeded with the chosen template's content.
 */
export default function TemplatePicker(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return window.api.onMenu(IPC.menuNewFromTemplate, () => {
      void window.api.listTemplates().then((list) => {
        setTemplates(list)
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
    () => fuzzyFilter(templates, query, (t) => t.name).slice(0, 50),
    [templates, query]
  )

  if (!open) return null

  const choose = async (entry: TemplateEntry | undefined): Promise<void> => {
    setOpen(false)
    if (!entry) return
    const content = await window.api.readTemplate(entry.id)
    if (content) newDocumentFromTemplate(content)
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
      void choose(results[index])
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
          placeholder="New document from template…"
          className="w-full border-b border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <button
              onClick={() => {
                setOpen(false)
                void window.api.openTemplatesFolder()
              }}
              className="block w-full px-3 py-3 text-left text-sm text-faint hover:bg-ink/5"
            >
              No templates — click to open the templates folder
            </button>
          ) : (
            results.map((t, i) => (
              <button
                key={t.id}
                onMouseEnter={() => setIndex(i)}
                onClick={() => void choose(t)}
                className={
                  'block w-full px-3 py-1.5 text-left text-sm ' +
                  (i === index ? 'bg-accent/10 text-accent' : 'text-ink/80')
                }
              >
                {t.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
