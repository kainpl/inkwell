import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '@renderer/store/useEditor'
import { insertEmoji } from '@renderer/lib/formatCommands'
import { BY_CATEGORY, CATEGORIES, filterEmoji, type EmojiEntry } from '@renderer/lib/emojiData'

/** Searchable emoji dropdown with category tabs and scroll. */
export default function EmojiPicker({ onClose }: { onClose: () => void }): JSX.Element {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(CATEGORIES[0].id)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Search overrides the category view; clearing search returns to tabs.
  const searching = query.trim().length > 0
  const items: EmojiEntry[] = useMemo(
    () => (searching ? filterEmoji(query) : (BY_CATEGORY[cat] ?? [])),
    [searching, query, cat]
  )

  const pick = (emoji: string): void => {
    const view = useEditor.getState().view
    if (view) insertEmoji(view, emoji)
    onClose()
  }

  return (
    <div
      className="w-80 rounded-lg border border-line bg-paper p-2 shadow-xl"
      onMouseDown={(e) => e.preventDefault()}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && items[0]) pick(items[0].emoji)
        }}
        placeholder="Search emoji…"
        className="mb-2 w-full rounded border border-line bg-chrome px-2 py-1 text-sm text-ink outline-none focus:border-accent"
      />

      {/* Category tabs (hidden while searching). */}
      {!searching && (
        <div className="mb-1 flex items-center gap-0.5 border-b border-line pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              title={c.label}
              onClick={() => setCat(c.id)}
              className={
                'flex h-7 w-7 items-center justify-center rounded text-base hover:bg-ink/5 ' +
                (cat === c.id ? 'bg-accent/10' : '')
              }
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-9 gap-0.5 overflow-y-auto">
        {items.map((it) => (
          <button
            key={it.name}
            title={it.name}
            onClick={() => pick(it.emoji)}
            className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-ink/5"
          >
            {it.emoji}
          </button>
        ))}
        {items.length === 0 && <span className="col-span-9 p-2 text-sm text-faint">No matches</span>}
      </div>

      <div className="mt-1 px-1 text-[11px] text-faint">
        {searching
          ? `${items.length} result${items.length === 1 ? '' : 's'}`
          : CATEGORIES.find((c) => c.id === cat)?.label}
      </div>
    </div>
  )
}
