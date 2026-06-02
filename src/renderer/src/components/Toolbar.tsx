import { useState } from 'react'
import { useEditor } from '@renderer/store/useEditor'
import { type FormatAction } from '@renderer/lib/formatCommands'
import { runFormatAction } from '@renderer/lib/runFormatAction'
import { useT } from '@renderer/lib/i18n'
import EmojiPicker from './EmojiPicker'

interface Btn {
  action: FormatAction
  /** i18n key for the tooltip; defaults to `format.<action>`. */
  labelKey: string
  glyph: string
}

const b = (action: FormatAction, glyph: string, labelKey = `format.${action}`): Btn => ({
  action,
  glyph,
  labelKey
})

const GROUPS: Btn[][] = [
  [
    b('bold', 'B'),
    b('italic', 'I'),
    b('strike', 'S'),
    b('code', '<>'),
    b('highlight', '▖'),
    b('sub', 'x₂'),
    b('sup', 'x²')
  ],
  [b('h1', 'H1'), b('h2', 'H2'), b('h3', 'H3')],
  [b('ul', '•'), b('ol', '1.'), b('task', '☑'), b('quote', '❝')],
  [b('link', '🔗'), b('image', '🖼'), b('table', '▦'), b('codeblock', '{ }'), b('hr', '―')],
  [b('footnote', '†'), b('mathBlock', 'Σ'), b('mermaid', '◈')]
]

function run(action: FormatAction): void {
  const view = useEditor.getState().view
  if (view) runFormatAction(view, action)
}

function ToolButton({ label, glyph, onClick }: { label: string; glyph: string; onClick: () => void }): JSX.Element {
  return (
    <button
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[13px] font-semibold text-muted hover:bg-ink/5 hover:text-ink"
    >
      {glyph}
    </button>
  )
}

/** Fixed formatting toolbar shown under the title bar (full action set). */
export default function Toolbar(): JSX.Element {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const t = useT()

  return (
    <div className="relative flex h-9 shrink-0 items-center gap-1 border-b border-line bg-chrome px-2">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-4 w-px bg-line" />}
          {group.map((btn) => (
            <ToolButton key={btn.action} label={t(btn.labelKey)} glyph={btn.glyph} onClick={() => run(btn.action)} />
          ))}
        </div>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolButton label={t('toolbar.emoji')} glyph="😀" onClick={() => setEmojiOpen((v) => !v)} />
      {emojiOpen && (
        <div className="absolute left-2 top-9 z-40">
          <EmojiPicker onClose={() => setEmojiOpen(false)} />
        </div>
      )}
    </div>
  )
}
