import { useEditor } from '@renderer/store/useEditor'
import { applyFormat, type FormatAction } from '@renderer/lib/formatCommands'

const BTNS: { action: FormatAction; glyph: string; label: string }[] = [
  { action: 'bold', glyph: 'B', label: 'Bold' },
  { action: 'italic', glyph: 'I', label: 'Italic' },
  { action: 'strike', glyph: 'S', label: 'Strikethrough' },
  { action: 'code', glyph: '<>', label: 'Code' },
  { action: 'highlight', glyph: '▖', label: 'Highlight' },
  { action: 'link', glyph: '🔗', label: 'Link' }
]

/**
 * Mini formatting bar that appears above a non-empty selection (Medium/Notion
 * style). Re-renders on `selVersion`; hides when the selection is empty.
 */
export default function FloatingToolbar(): JSX.Element | null {
  const view = useEditor((s) => s.view)
  // Subscribe to selection changes so position/visibility recompute.
  useEditor((s) => s.selVersion)

  if (!view) return null
  const sel = view.state.selection.main
  if (sel.empty) return null

  const start = view.coordsAtPos(sel.from)
  const end = view.coordsAtPos(sel.to)
  if (!start || !end) return null

  const top = Math.min(start.top, end.top) - 42
  const left = (start.left + end.right) / 2

  const run = (action: FormatAction): void => {
    applyFormat(view, action)
  }

  return (
    <div
      className="fixed z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-paper px-1 py-1 shadow-xl"
      style={{ top: Math.max(4, top), left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {BTNS.map((b) => (
        <button
          key={b.action}
          title={b.label}
          aria-label={b.label}
          onClick={() => run(b.action)}
          className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[13px] font-semibold text-muted hover:bg-ink/5 hover:text-ink"
        >
          {b.glyph}
        </button>
      ))}
    </div>
  )
}
