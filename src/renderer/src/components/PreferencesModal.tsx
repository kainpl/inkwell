import { useEffect, useState, type ReactNode } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import type { EditorFont } from '@renderer/lib/settings'
import { THEMES, hasBothEditions, type Mode } from '@renderer/lib/themes'
import { MARKDOWN_FEATURE_LIST } from '@renderer/lib/markdownFeatures'
import { SPELL_LANGUAGES } from '@renderer/lib/spell'
import { COMMANDS } from '@renderer/lib/commands'
import { keyComboToCM } from '@renderer/components/Editor/customKeymap'

type Section = 'appearance' | 'editor' | 'keyboard' | 'markdown' | 'image' | 'export'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'image', label: 'Image' },
  { id: 'export', label: 'Export' }
]

/** Capture a shortcut: click, press a key combo (Esc cancels). */
function KeyCapture({
  value,
  onChange
}: {
  value?: string
  onChange: (key: string | null) => void
}): JSX.Element {
  const [capturing, setCapturing] = useState(false)
  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const key = keyComboToCM(e)
      if (key) {
        onChange(key)
        setCapturing(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, onChange])
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={() => setCapturing((c) => !c)}
        className="min-w-[6.5rem] rounded border border-line px-2 py-0.5 text-xs text-ink hover:bg-ink/5"
      >
        {capturing ? 'Press keys…' : value || 'Set shortcut'}
      </button>
      {value && (
        <button onClick={() => onChange(null)} title="Clear" className="text-faint hover:text-ink">
          ✕
        </button>
      )}
    </span>
  )
}

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
      <Row label="Mode" hint="some themes offer only one edition">
        <select
          className={FIELD}
          value={s.mode}
          disabled={!hasBothEditions(s.theme, s.externalThemes)}
          onChange={(e) => s.setMode(e.target.value as Mode)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
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
          <option value="jetbrains">JetBrains Mono</option>
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
      <Row label="Smart punctuation" hint="straight quotes/dashes/ellipsis → typographic as you type">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.smartPunctuation} onChange={() => s.setSmartPunctuation(!s.smartPunctuation)} />
      </Row>
      <Row label="Spell check" hint="underline misspellings; right-click for suggestions">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.spellCheck} onChange={() => s.setSpellCheck(!s.spellCheck)} />
      </Row>
      <div className="py-2">
        <div className="text-sm text-ink">Spell-check languages</div>
        <div className="text-[11px] text-faint">
          check several; English is built in, others download on first use
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          {SPELL_LANGUAGES.map((l) => (
            <label key={l.code} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                disabled={!s.spellCheck}
                checked={s.spellLanguages.includes(l.code)}
                onChange={() => s.toggleSpellLanguage(l.code)}
              />
              {l.label}
            </label>
          ))}
        </div>
      </div>
      <div className="py-2">
        <div className="text-sm text-ink">“Search With…” services</div>
        <div className="text-[11px] text-faint">right-click a selection; %s is the query</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {s.searchServices.map((sv, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={`${FIELD} w-24`}
                value={sv.name}
                placeholder="Name"
                onChange={(e) =>
                  s.setSearchServices(
                    s.searchServices.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                  )
                }
              />
              <input
                className={`${FIELD} flex-1`}
                value={sv.url}
                placeholder="https://…?q=%s"
                onChange={(e) =>
                  s.setSearchServices(
                    s.searchServices.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                  )
                }
              />
              <button
                title="Remove"
                className="px-1 text-faint hover:text-ink"
                onClick={() => s.setSearchServices(s.searchServices.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="self-start rounded border border-line px-2 py-0.5 text-xs text-ink hover:bg-ink/5"
            onClick={() =>
              s.setSearchServices([
                ...s.searchServices,
                { name: 'New', url: 'https://example.com/?q=%s' }
              ])
            }
          >
            + Add service
          </button>
        </div>
      </div>
    </>
  )
}

function Keyboard(): JSX.Element {
  const s = useAppStore()
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-[11px] text-faint">
        Add shortcuts for editor commands. Keys already used by the menus are handled by the OS
        first.
      </div>
      {COMMANDS.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 py-1">
          <span className="min-w-0 truncate text-sm text-ink">
            <span className="text-faint">{c.category} · </span>
            {c.title}
          </span>
          <KeyCapture value={s.keyBindings[c.id]} onChange={(k) => s.setKeyBinding(c.id, k)} />
        </div>
      ))}
    </div>
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
          {section === 'keyboard' && <Keyboard />}
          {section === 'markdown' && <Markdown />}
          {section === 'image' && <Image />}
          {section === 'export' && <Export />}
        </div>
      </div>
    </div>
  )
}
