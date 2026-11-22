import { useEffect, useRef, useState, type ReactNode } from 'react'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { useTranslate } from '@renderer/lib/i18n'
import {
  editorModes,
  editorModeLabels,
  fonts,
  palettes,
  type Language,
  type Settings
} from '@renderer/lib/settings'
import { MARKDOWN_FEATURE_LIST } from '@renderer/lib/markdownFeatures'
import RecentSettings from './RecentSettings'
import {
  commands,
  defaultShortcuts,
  parseShortcut,
  shortcutLabel,
  type Command
} from '@renderer/lib/shortcuts'

function ShortcutField({ command }: { command: Command }) {
  const t = useTranslate()
  const shortcuts = useAppStore((s) => s.shortcuts)
  const configure = useAppStore((s) => s.configure)
  const current = shortcutLabel(shortcuts[command])
  const [draft, setDraft] = useState(current)
  const [error, setError] = useState('')
  function commit() {
    const next = parseShortcut(draft)
    const taken = commands.find((id) => id !== command && next && shortcuts[id] === next)
    if (next === null) return setError(t('Use a modifier and a key, or F1–F24.'))
    if (taken || ['Mod+X', 'Mod+C', 'Mod+V', 'Mod+A'].includes(next))
      return setError(t('Shortcut already in use') + (taken ? ' · ' + t(taken) : ''))
    setError('')
    if (next !== shortcuts[command]) configure({ shortcuts: { ...shortcuts, [command]: next } })
  }
  return (
    <label className="pref-row">
      <span>{t(command)}</span>
      <span>
        <input
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-invalid={!!error}
        />
        {error && <small role="alert">{error}</small>}
      </span>
    </label>
  )
}

const tabs = ['Appearance', 'Writing', 'Markdown', 'Spelling', 'Recent items', 'Shortcuts'] as const
export default function Preferences() {
  const s = useAppStore()
  const t = useTranslate()
  const ref = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<(typeof tabs)[number]>('Appearance')
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  const close = () => s.showPreferences(false)
  const row = (label: string, control: ReactNode) => (
    <label key={label} className="pref-row">
      <span>{t(label)}</span>
      {control}
    </label>
  )
  const check = (label: string, value: boolean, change: (v: boolean) => void) =>
    row(label, <input type="checkbox" checked={value} onChange={(e) => change(e.target.checked)} />)
  const select = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    change: (v: T) => void,
    labelFor?: (value: T) => string
  ) =>
    row(
      label,
      <select value={value} onChange={(e) => change(e.target.value as T)}>
        {options.map((v) => (
          <option key={v} value={v}>
            {labelFor
              ? labelFor(v)
              : v === 'uk'
                ? 'Українська'
                : v === 'en'
                  ? 'English'
                  : v === 'light'
                    ? t('Light')
                    : v === 'dark'
                      ? t('Dark')
                      : t(v)}
          </option>
        ))}
      </select>
    )
  const range = (
    key: 'fontSize' | 'lineHeight' | 'columnWidth',
    label: string,
    min: number,
    max: number,
    step: number,
    unit: string
  ) =>
    row(
      label,
      <span className="pref-range">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={s[key]}
          onChange={(e) => s.configure({ [key]: e.target.valueAsNumber })}
        />
        <output>
          {s[key]}
          {unit}
        </output>
      </span>
    )
  const toggle = (
    key: keyof Pick<
      Settings,
      | 'autoSave'
      | 'finalNewline'
      | 'smartPunctuation'
      | 'focusMode'
      | 'typewriterMode'
      | 'spellCheck'
    >,
    label: string
  ) => check(label, s[key], (v) => s.configure({ [key]: v }))
  const { doc, draftGoal } = activeTab(s)
  const goal = doc.path ? (s.wordGoals[doc.path] ?? 0) : draftGoal
  return (
    <dialog
      ref={ref}
      className="preferences"
      aria-labelledby="settings-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <header>
        <h1 id="settings-title">{t('Settings')}</h1>
        <button onClick={close} aria-label={t('Close')}>
          ×
        </button>
      </header>
      <div className="pref-body">
        <nav aria-label={t('Settings')}>
          {tabs.map((key) => (
            <button
              key={key}
              aria-current={key === tab ? 'page' : undefined}
              onClick={() => setTab(key)}
            >
              {t(key)}
            </button>
          ))}
        </nav>
        <section aria-label={t(tab)} key={tab}>
          {tab === 'Appearance' && (
            <>
              {select('Interface language', s.language, ['uk', 'en'], (language) =>
                s.configure({ language })
              )}
              {select('Color mode', s.theme, ['light', 'dark'], (theme) => s.configure({ theme }))}
              {select('Palette', s.palette, palettes, (palette) => s.configure({ palette }))}
              {select(
                'Document font',
                s.font,
                Object.keys(fonts) as (keyof typeof fonts)[],
                (font) => s.configure({ font })
              )}
              {range('fontSize', 'Font size', 11, 24, 1, ' px')}
              {range('lineHeight', 'Line height', 1, 2.4, 0.05, '')}
              {range('columnWidth', 'Column width', 40, 100, 1, '%')}
            </>
          )}
          {tab === 'Writing' && (
            <>
              {select(
                'Editor mode',
                s.editorMode,
                editorModes,
                (editorMode) => s.configure({ editorMode }),
                (mode) => t(editorModeLabels[mode])
              )}
              {toggle('focusMode', 'Focus')}
              {toggle('typewriterMode', 'Keep the current line centered')}
              {toggle('autoSave', 'Auto-save named files')}
              {select('Line endings for new files', s.lineEnding, ['LF', 'CRLF'], (lineEnding) =>
                s.configure({ lineEnding })
              )}
              {toggle('finalNewline', 'Add a final newline on save')}
              {toggle('smartPunctuation', 'Smart quotes, dashes and ellipses')}
              {row(
                'Word goal for this document',
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={goal || ''}
                  placeholder="0"
                  title={t('0 disables the goal')}
                  onChange={(e) => {
                    const goal = Number(e.target.value)
                    if (Number.isSafeInteger(goal) && goal >= 0) s.setGoal(goal)
                  }}
                />
              )}
            </>
          )}
          {tab === 'Markdown' &&
            MARKDOWN_FEATURE_LIST.map(({ key, label }) =>
              check(label, s.features[key], (v) =>
                s.configure({ features: { ...s.features, [key]: v } })
              )
            )}
          {tab === 'Spelling' && (
            <>
              {toggle('spellCheck', 'Check spelling')}
              <h2>{t('Dictionaries')}</h2>
              {(['uk', 'en'] as Language[]).map((lang) =>
                row(
                  lang === 'uk' ? 'Українська' : 'English',
                  <input
                    type="checkbox"
                    checked={s.spellLanguages.includes(lang)}
                    disabled={s.spellLanguages.length === 1 && s.spellLanguages[0] === lang}
                    onChange={(e) =>
                      s.configure({
                        spellLanguages: e.target.checked
                          ? [...s.spellLanguages, lang]
                          : s.spellLanguages.filter((v) => v !== lang)
                      })
                    }
                  />
                )
              )}
              <label className="pref-dictionary">
                {t('Personal dictionary')}
                <small>{t('One word per line')}</small>
                <textarea
                  spellCheck={false}
                  defaultValue={s.personalWords.join('\n')}
                  onChange={(e) =>
                    s.configure({
                      personalWords: [
                        ...new Set(
                          e.target.value
                            .split(/\r?\n/)
                            .map((w) => w.trim())
                            .filter(Boolean)
                        )
                      ]
                    })
                  }
                />
              </label>
            </>
          )}
          {tab === 'Recent items' && (
            <>
              <p>
                {t(
                  'Keep up to 100 entries per list. Lowering a limit removes the oldest entries. Set it to 0 to disable that list.'
                )}
              </p>
              <RecentSettings kind="files" />
              <RecentSettings kind="folders" />
            </>
          )}
          {tab === 'Shortcuts' && (
            <>
              <p>{t('Edit a shortcut, then press Enter. Leave it empty to disable it.')}</p>
              {commands.map((cmd) => (
                <ShortcutField key={cmd + s.shortcuts[cmd]} command={cmd} />
              ))}
              <button
                className="pref-reset"
                onClick={() => s.configure({ shortcuts: { ...defaultShortcuts } })}
              >
                {t('Restore default shortcuts')}
              </button>
            </>
          )}
        </section>
      </div>
    </dialog>
  )
}
