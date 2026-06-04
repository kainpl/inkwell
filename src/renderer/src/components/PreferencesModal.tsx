import { useEffect, useState, type ReactNode } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import type { EditorFont } from '@renderer/lib/settings'
import { THEMES, hasBothEditions, type Mode } from '@renderer/lib/themes'
import { MARKDOWN_FEATURE_LIST } from '@renderer/lib/markdownFeatures'
import { SPELL_LANGUAGES } from '@renderer/lib/spell'
import { COMMANDS, categoryKey } from '@renderer/lib/commands'
import { useT } from '@renderer/lib/i18n'
import { keyComboToCM } from '@renderer/components/Editor/customKeymap'
import { triggerConnect, disconnectAccount } from '@renderer/lib/drive'
import { clearRecents } from '@renderer/lib/persistence'
import { LOCALES, LOCALE_NAMES } from '@shared/i18n'

type Section = 'general' | 'appearance' | 'editor' | 'keyboard' | 'markdown' | 'image' | 'export' | 'cloud'

const SECTIONS: Section[] = [
  'general',
  'appearance',
  'editor',
  'keyboard',
  'markdown',
  'image',
  'export',
  'cloud'
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
  const t = useT()
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
        {capturing ? t('prefs.pressKeys') : value || t('prefs.setShortcut')}
      </button>
      {value && (
        <button onClick={() => onChange(null)} title={t('prefs.clear')} className="text-faint hover:text-ink">
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
  const t = useT()
  return (
    <>
      <Row label={t('prefs.theme')}>
        <select className={FIELD} value={s.theme} onChange={(e) => s.setTheme(e.target.value)}>
          <optgroup label={t('prefs.builtIn')}>
            {THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {th.label}
              </option>
            ))}
          </optgroup>
          {s.externalThemes.length > 0 && (
            <optgroup label={t('prefs.custom')}>
              {s.externalThemes.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Row>
      <Row label={t('prefs.mode')} hint={t('prefs.modeHint')}>
        <select
          className={FIELD}
          value={s.mode}
          disabled={!hasBothEditions(s.theme, s.externalThemes)}
          onChange={(e) => s.setMode(e.target.value as Mode)}
        >
          <option value="light">{t('prefs.light')}</option>
          <option value="dark">{t('prefs.dark')}</option>
        </select>
      </Row>
      <Row label={t('prefs.customThemes')} hint={t('prefs.customThemesHint')}>
        <button
          className="rounded border border-line px-2 py-1 text-sm text-ink hover:bg-ink/5"
          onClick={() => void window.api.openThemesFolder()}
        >
          {t('prefs.openThemesFolder')}
        </button>
      </Row>
      <Row label={t('prefs.editorFont')}>
        <select className={FIELD} value={s.editorFont} onChange={(e) => s.setEditorFont(e.target.value as EditorFont)}>
          <option value="serif">{t('prefs.fontSerif')}</option>
          <option value="sans">{t('prefs.fontSans')}</option>
          <option value="mono">{t('prefs.fontMono')}</option>
          <option value="jetbrains">JetBrains Mono</option>
        </select>
      </Row>
      <Row label={t('prefs.fontSize')} hint={t('prefs.pixels')}>
        <input type="number" min={12} max={28} className={`${FIELD} w-20`} value={s.editorFontSize}
          onChange={(e) => s.setEditorFontSize(Number(e.target.value) || s.editorFontSize)} />
      </Row>
      <Row label={t('prefs.lineHeight')}>
        <input type="number" min={1.2} max={2.4} step={0.05} className={`${FIELD} w-20`} value={s.editorLineHeight}
          onChange={(e) => s.setEditorLineHeight(Number(e.target.value) || s.editorLineHeight)} />
      </Row>
      <Row label={t('prefs.contentWidth')} hint={t('prefs.contentWidthHint')}>
        <input type="range" min={40} max={100} step={5} className="w-40 accent-accent" value={s.contentWidth}
          onChange={(e) => s.setContentWidth(Number(e.target.value))} />
        <span className="w-10 text-right text-sm tabular-nums text-ink">{s.contentWidth}%</span>
      </Row>
      <Row label={t('prefs.autoHideMenuBar')} hint={t('prefs.autoHideMenuBarHint')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.autoHideMenuBar}
          onChange={() => s.setAutoHideMenuBar(!s.autoHideMenuBar)} />
      </Row>
    </>
  )
}

function Editor(): JSX.Element {
  const s = useAppStore()
  const t = useT()
  return (
    <>
      <Row label={t('prefs.autoSave')} hint={t('prefs.autoSaveHint')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.autoSave} onChange={() => s.toggleAutoSave()} />
      </Row>
      <Row label={t('prefs.lineEndings')}>
        <select className={FIELD} value={s.lineEnding} onChange={(e) => s.setLineEnding(e.target.value as 'lf' | 'crlf')}>
          <option value="lf">{t('file.lf')}</option>
          <option value="crlf">{t('file.crlf')}</option>
        </select>
      </Row>
      <Row label={t('prefs.finalNewline')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.insertFinalNewline} onChange={() => s.toggleFinalNewline()} />
      </Row>
      <Row label={t('prefs.showFormatBar')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.formatBarOpen} onChange={() => s.toggleFormatBar()} />
      </Row>
      <Row label={t('prefs.smartPunct')} hint={t('prefs.smartPunctHint')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.smartPunctuation} onChange={() => s.setSmartPunctuation(!s.smartPunctuation)} />
      </Row>
      <Row label={t('prefs.wordGoal')} hint={t('prefs.wordGoalHint')}>
        <input
          type="number"
          min={0}
          step={50}
          className={`${FIELD} w-24`}
          value={s.wordGoal ?? ''}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value))
            s.setWordGoal(Number.isFinite(n) && n > 0 ? n : null)
          }}
        />
      </Row>
      <Row label={t('prefs.spellCheck')} hint={t('prefs.spellCheckHint')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.spellCheck} onChange={() => s.setSpellCheck(!s.spellCheck)} />
      </Row>
      <div className="py-2">
        <div className="text-sm text-ink">{t('prefs.spellLangs')}</div>
        <div className="text-[11px] text-faint">{t('prefs.spellLangsHint')}</div>
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
              {t(`spelllang.${l.code}`)}
            </label>
          ))}
        </div>
      </div>
      <div className="py-2">
        <div className="text-sm text-ink">{t('prefs.searchServices')}</div>
        <div className="text-[11px] text-faint">{t('prefs.searchServicesHint')}</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {s.searchServices.map((sv, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={`${FIELD} w-24`}
                value={sv.name}
                placeholder={t('prefs.name')}
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
                title={t('prefs.remove')}
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
            {t('prefs.addService')}
          </button>
        </div>
      </div>
    </>
  )
}

function Keyboard(): JSX.Element {
  const s = useAppStore()
  const t = useT()
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-[11px] text-faint">{t('prefs.keyboardHint')}</div>
      {COMMANDS.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 py-1">
          <span className="min-w-0 truncate text-sm text-ink">
            <span className="text-faint">{t(categoryKey(c))} · </span>
            {t(c.titleKey)}
          </span>
          <KeyCapture value={s.keyBindings[c.id]} onChange={(k) => s.setKeyBinding(c.id, k)} />
        </div>
      ))}
    </div>
  )
}

function Markdown(): JSX.Element {
  const s = useAppStore()
  const t = useT()
  return (
    <>
      {MARKDOWN_FEATURE_LIST.map((f) => (
        <Row key={f.key} label={t(`mdfeat.${f.key}`)}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={s.markdownFeatures[f.key]}
            onChange={() => s.setMarkdownFeature(f.key, !s.markdownFeatures[f.key])}
          />
        </Row>
      ))}
      <Row label={t('prefs.allowEmbeds')} hint={t('prefs.allowEmbedsHint')}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-accent"
          checked={s.allowEmbeds}
          onChange={() => s.setAllowEmbeds(!s.allowEmbeds)}
        />
      </Row>
    </>
  )
}

function Image(): JSX.Element {
  const s = useAppStore()
  const t = useT()
  return (
    <Row label={t('prefs.imageCmd')} hint={t('prefs.imageCmdHint')}>
      <input type="text" placeholder={t('prefs.imageCmdPlaceholder')} className={`${FIELD} w-56`} value={s.imageUploadCommand}
        onChange={(e) => s.setImageUploadCommand(e.target.value)} />
    </Row>
  )
}

function Export(): JSX.Element {
  const s = useAppStore()
  const t = useT()
  return (
    <>
      <Row label={t('prefs.exportStyle')} hint={t('prefs.exportStyleHint')}>
        <select className={FIELD} value={s.exportStyle} onChange={(e) => s.setExportStyle(e.target.value as 'default' | 'theme')}>
          <option value="default">{t('prefs.exportDefault')}</option>
          <option value="theme">{t('prefs.exportMatchTheme')}</option>
        </select>
      </Row>
      <Row label={t('prefs.embedImages')} hint={t('prefs.embedImagesHint')}>
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={s.embedImages} onChange={() => s.setEmbedImages(!s.embedImages)} />
      </Row>
      <Row label={t('prefs.pageLabel')} hint={t('prefs.pageHint')}>
        <button
          className="rounded border border-line px-2 py-1 text-sm text-ink hover:bg-ink/5"
          onClick={() => window.dispatchEvent(new Event('ink:open-page-setup'))}
        >
          {t('file.pageSetup')}
        </button>
      </Row>
    </>
  )
}

function General(): JSX.Element {
  const [cleared, setCleared] = useState(false)
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  const t = useT()
  return (
    <>
      <Row label={t('prefs.language')} hint={t('prefs.languageHint')}>
        <select
          className={FIELD}
          value={locale}
          onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t('prefs.recentLabel')} hint={t('prefs.recentHint')}>
        <button
          onClick={() => {
            clearRecents()
            setCleared(true)
          }}
          className="rounded border border-line px-3 py-1 text-sm text-ink hover:border-[#d35454] hover:text-[#d35454]"
        >
          {cleared ? t('prefs.cleared') : t('prefs.clearRecents')}
        </button>
      </Row>
    </>
  )
}

function Cloud(): JSX.Element {
  const accounts = useAppStore((s) => s.driveAccounts)
  const clientId = useAppStore((s) => s.driveClientId)
  const setClientId = useAppStore((s) => s.setDriveClientId)
  const clientSecret = useAppStore((s) => s.driveClientSecret)
  const setClientSecret = useAppStore((s) => s.setDriveClientSecret)
  const t = useT()
  return (
    <>
      <div className="mb-2 text-sm font-medium text-ink">{t('prefs.driveAccounts')}</div>
      {accounts.length === 0 ? (
        <p className="py-1 text-[13px] text-faint">{t('prefs.noAccounts')}</p>
      ) : (
        accounts.map((a) => (
          <div key={a.accountId} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">☁️ {a.email}</span>
            <button
              onClick={() => void disconnectAccount(a.accountId)}
              className="shrink-0 rounded border border-line px-2 py-0.5 text-xs text-ink hover:border-[#d35454] hover:text-[#d35454]"
            >
              {t('prefs.disconnect')}
            </button>
          </div>
        ))
      )}
      <button
        onClick={triggerConnect}
        className="mt-2 rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper"
      >
        {t('prefs.connectAccount')}
      </button>

      <div className="mt-6 mb-1 text-sm font-medium text-ink">{t('prefs.oauthCreds')}</div>
      <p className="mb-1 text-[11px] text-faint">{t('prefs.oauthIntro')}</p>
      <Row label={t('prefs.clientId')} hint={t('prefs.clientIdHint')}>
        <input
          className={FIELD + ' w-64'}
          value={clientId}
          placeholder="xx…apps.googleusercontent.com"
          onChange={(e) => setClientId(e.target.value.trim())}
        />
      </Row>
      <Row label={t('prefs.clientSecret')} hint={t('prefs.clientSecretHint')}>
        <input
          className={FIELD + ' w-64'}
          type="password"
          value={clientSecret}
          placeholder="GOCSPX-…"
          onChange={(e) => setClientSecret(e.target.value.trim())}
        />
      </Row>
    </>
  )
}

/** Preferences panel (Edit → Preferences…). */
export default function PreferencesModal(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('appearance')
  const t = useT()

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
          <div className="mb-2 px-2 text-[12px] font-semibold text-muted">{t('prefs.title')}</div>
          {SECTIONS.map((sec) => (
            <button
              key={sec}
              onClick={() => setSection(sec)}
              className={
                'block w-full rounded px-2 py-1.5 text-left text-sm ' +
                (section === sec ? 'bg-accent/10 text-accent' : 'text-ink/80 hover:bg-ink/5')
              }
            >
              {t(`prefs.sec.${sec}`)}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {section === 'general' && <General />}
          {section === 'appearance' && <Appearance />}
          {section === 'editor' && <Editor />}
          {section === 'keyboard' && <Keyboard />}
          {section === 'markdown' && <Markdown />}
          {section === 'image' && <Image />}
          {section === 'export' && <Export />}
          {section === 'cloud' && <Cloud />}
        </div>
      </div>
    </div>
  )
}
