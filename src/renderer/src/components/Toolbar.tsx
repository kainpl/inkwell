import { useState } from 'react'
import { useEditor } from '@renderer/store/useEditor'
import { type FormatAction } from '@renderer/lib/formatCommands'
import { runFormatAction } from '@renderer/lib/runFormatAction'
import EmojiPicker from './EmojiPicker'

interface Btn {
  action: FormatAction
  label: string
  glyph: string
}

const GROUPS: Btn[][] = [
  [
    { action: 'bold', label: 'Bold (Ctrl+B)', glyph: 'B' },
    { action: 'italic', label: 'Italic (Ctrl+I)', glyph: 'I' },
    { action: 'strike', label: 'Strikethrough', glyph: 'S' },
    { action: 'code', label: 'Inline code', glyph: '<>' },
    { action: 'highlight', label: 'Highlight', glyph: '▖' }
  ],
  [
    { action: 'h1', label: 'Heading 1', glyph: 'H1' },
    { action: 'h2', label: 'Heading 2', glyph: 'H2' },
    { action: 'h3', label: 'Heading 3', glyph: 'H3' }
  ],
  [
    { action: 'ul', label: 'Bullet list', glyph: '•' },
    { action: 'ol', label: 'Numbered list', glyph: '1.' },
    { action: 'task', label: 'Task list', glyph: '☑' },
    { action: 'quote', label: 'Quote', glyph: '❝' }
  ],
  [
    { action: 'link', label: 'Link (Ctrl+K)', glyph: '🔗' },
    { action: 'image', label: 'Image', glyph: '🖼' },
    { action: 'table', label: 'Table', glyph: '▦' },
    { action: 'codeblock', label: 'Code block', glyph: '{ }' },
    { action: 'hr', label: 'Horizontal rule', glyph: '―' }
  ]
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

  return (
    <div className="relative flex h-9 shrink-0 items-center gap-1 border-b border-line bg-chrome px-2">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-4 w-px bg-line" />}
          {group.map((b) => (
            <ToolButton key={b.action} label={b.label} glyph={b.glyph} onClick={() => run(b.action)} />
          ))}
        </div>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolButton label="Emoji" glyph="😀" onClick={() => setEmojiOpen((v) => !v)} />
      {emojiOpen && (
        <div className="absolute left-2 top-9 z-40">
          <EmojiPicker onClose={() => setEmojiOpen(false)} />
        </div>
      )}
    </div>
  )
}
