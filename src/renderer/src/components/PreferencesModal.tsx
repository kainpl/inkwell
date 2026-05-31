import { useEffect, useState, type ReactNode } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import type { EditorFont } from '@renderer/lib/settings'
import { THEMES } from '@renderer/lib/themes'
import { MARKDOWN_FEATURE_LIST } from '@renderer/lib/markdownFeatures'

type Section = 'appearance' | 'editor' | 'markdown' | 'image' | 'export'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'image', label: 'Image' },
  { id: 'export', label: 'Export' }
]

const FIELD = 'rounded border border-line bg-paper px-2 py-1 text-sm text-ink'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex items-start justify-between gap-4 py-2">
      <span className="pt-1">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-[11px] text-faint">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </label>
  )
}

function Appearance(): JSX.Element {
  const s = useAppStore()
  return (
    <>
      <Row label="Theme">
        <select className={FIELD} value={s.theme} onChange={(e) => s.setTheme(e.target.value)}>
          <optgroup label="Built-in">
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </optgroup>
          {s.externalThemes.length > 0 && (
            <optgroup label="Custom">
              {s.externalThemes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Row>
      <Row label="Custom themes" hint="drop .css files here — they hot-reload">
        <button
          className="rounded border border-line px-2 py-1 text-sm text-ink hover:bg-ink/5"
          onClick={() => void window.api.openThemesFolder()}
        >
          Open themes folder…
        </button>
      </Row>
      <Row label="Editor font">
        <select className={FIELD} value={s.editorFont} onChange={(e) => s.setEditorFont(e.target.value as EditorFont)}>
          <option value="serif">Serif</option>
          <option value="sans">Sans</option>
          <option value="mono">Monospace</option>
        </select>
      </Row>
      <Row label="Font size" hint="pixels">
        <input type="number" min={12} max={28} className={`${FIELD} w-20`} value={s.editorFontSize}
          onChange={(e) => s.setEditorFontSize(Number(e.target.value) || s.editorFontSize)} />
      </Row>
      <Row label="Line height">
        <input type="number" min={1.2} max={2.4} step={0.05} className={`${FIELD} w-20`} value={s.editorLineHeight}
          onChange={(e) => s.setEditorLineHeight(Number(e.target.value) || s.editorLineHeight)} />
      </Row>
      <Row label="Content width" hint="% of window (centred column)">
        <input type="range" min={40} max={100} step={5} className="w-40 accent-accent" value={s.contentWidth}
          onChange={(e) => s.setContentWidth(Number(e.target.value))} />
        <span className="w-10 text-right text-sm tabular-nums text-ink">{s.contentWidth}%</span>
      </Row>
      <Row label="Auto-hide menu bar" hint="Windows/Linux — press Alt to reveal">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.autoHideMenuBar}
          onChange={() => s.setAutoHideMenuBar(!s.autoHideMenuBar)} />
      </Row>
    </>
  )
}

function Editor(): JSX.Element {
  const s = useAppStore()
  return (
    <>
      <Row label="Auto save" hint="save a short while after edits (saved files only)">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.autoSave} onChange={() => s.toggleAutoSave()} />
      </Row>
      <Row label="Line endings">
        <select className={FIELD} value={s.lineEnding} onChange={(e) => s.setLineEnding(e.target.value as 'lf' | 'crlf')}>
          <option value="lf">LF (Unix)</option>
          <option value="crlf">CRLF (Windows)</option>
        </select>
      </Row>
      <Row label="Insert final newline on save">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.insertFinalNewline} onChange={() => s.toggleFinalNewline()} />
      </Row>
      <Row label="Show formatting bar">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.formatBarOpen} onChange={() => s.toggleFormatBar()} />
      </Row>
    </>
  )
}

function Markdown(): JSX.Element {
  const s = useAppStore()
  return (
    <>
      {MARKDOWN_FEATURE_LIST.map((f) => (
        <Row key={f.key} label={f.label}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={s.markdownFeatures[f.key]}
            onChange={() => s.setMarkdownFeature(f.key, !s.markdownFeatures[f.key])}
          />
        </Row>
      ))}
    </>
  )
}

function Image(): JSX.Element {
  const s = useAppStore()
  return (
    <Row label="Image upload command" hint="shell command; the file path is appended (prints a URL)">
      <input type="text" placeholder="e.g. picgo upload" className={`${FIELD} w-56`} value={s.imageUploadCommand}
        onChange={(e) => s.setImageUploadCommand(e.target.value)} />
    </Row>
  )
}

function Export(): JSX.Element {
  const s = useAppStore()
  return (
    <>
      <Row label="Export style" hint="match the editor theme, or the plain print stylesheet">
        <select className={FIELD} value={s.exportStyle} onChange={(e) => s.setExportStyle(e.target.value as 'default' | 'theme')}>
          <option value="default">Default (print)</option>
          <option value="theme">Match theme</option>
        </select>
      </Row>
      <Row label="Embed images in exported HTML" hint="data: URIs make the .html self-contained">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.embedImages} onChange={() => s.setEmbedImages(!s.embedImages)} />
      </Row>
      <Row label="Print / PDF page" hint="paper, margins, orientation, page breaks">
        <button
          className="rounded border border-line px-2 py-1 text-sm text-ink hover:bg-ink/5"
          onClick={() => window.dispatchEvent(new Event('ink:open-page-setup'))}
        >
          Page Setup…
        </button>
      </Row>
    </>
  )
}

/** Preferences panel (Edit → Preferences…). */
export default function PreferencesModal(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('appearance')

  useEffect(() => window.api.onMenu(IPC.menuPreferences, () => setOpen(true)), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[30rem] w-[42rem] max-w-[94vw] overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-40 shrink-0 border-r border-line bg-chrome p-2">
          <div className="mb-2 px-2 text-[12px] font-semibold text-muted">Preferences</div>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setSection(sec.id)}
              className={
                'block w-full rounded px-2 py-1.5 text-left text-sm ' +
                (section === sec.id ? 'bg-accent/10 text-accent' : 'text-ink/80 hover:bg-ink/5')
              }
            >
              {sec.label}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {section === 'appearance' && <Appearance />}
          {section === 'editor' && <Editor />}
          {section === 'markdown' && <Markdown />}
          {section === 'image' && <Image />}
          {section === 'export' && <Export />}
        </div>
      </div>
    </div>
  )
}
