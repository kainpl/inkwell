import { useTranslate } from '@renderer/lib/i18n'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import type { DesktopActions } from '@renderer/desktop/menu'
import AppMenu from './AppMenu'
import WindowControls from './WindowControls'
import './titlebar.css'
import { editorModes, editorModeLabels, type EditorMode } from '@renderer/lib/settings'

function IconButton({
  label,
  active,
  onClick,
  children
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={
        'flex h-7 w-7 items-center justify-center rounded-md text-muted ' +
        'hover:bg-ink/5 hover:text-ink ' +
        (active ? 'bg-ink/5 text-accent' : '')
      }
    >
      {children}
    </button>
  )
}

export default function TitleBar({ actions }: { actions: DesktopActions }): JSX.Element {
  const t = useTranslate()
  const { sidebarOpen, sidebarTab, theme, showPreferences } = useAppStore()
  const doc = useAppStore((s) => activeTab(s).doc)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleOutline = useAppStore((s) => s.toggleOutline)
  const mode = useAppStore((s) => s.editorMode)
  const configure = useAppStore((s) => s.configure)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  return (
    <header
      className={
        'ink-titlebar flex h-10 shrink-0 select-none items-center border-b border-line bg-chrome pl-2 ' +
        (actions.customFrame ? 'custom-frame' : 'pr-2')
      }
    >
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label={t('Sidebar')} active={sidebarOpen} onClick={toggleSidebar}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </IconButton>
        <IconButton
          label={t('Outline')}
          active={sidebarOpen && sidebarTab === 'outline'}
          onClick={toggleOutline}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </IconButton>
      </div>

      {actions.customFrame && <AppMenu actions={actions} />}
      <div
        data-tauri-drag-region={actions.customFrame ? '' : undefined}
        title={doc.path ?? doc.name}
        className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 px-2 text-[13px] text-muted"
      >
        <span className="pointer-events-none truncate">{doc.name}</span>
        {doc.dirty && (
          <span
            className="pointer-events-none h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            aria-label={t('Unsaved changes')}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton label={t('Find in document')} onClick={() => void actions.run('Find')}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </IconButton>
        <select
          aria-label={t('Editor mode')}
          title={t('Editor mode')}
          className="max-w-[9rem] rounded-md border border-line bg-chrome px-2 py-1 text-xs text-ink"
          value={mode}
          onChange={(event) => configure({ editorMode: event.target.value as EditorMode })}
        >
          {editorModes.map((id) => (
            <option key={id} value={id}>
              {t(editorModeLabels[id])}
            </option>
          ))}
        </select>
        <IconButton label={t('Settings')} onClick={() => showPreferences(true)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 6h6m4 0h6M4 12h11m4 0h1M4 18h2m4 0h10" />
            <circle cx="12" cy="6" r="2" />
            <circle cx="17" cy="12" r="2" />
            <circle cx="8" cy="18" r="2" />
          </svg>
        </IconButton>
        <IconButton label={t('Toggle theme')} onClick={toggleTheme}>
          {theme === 'light' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </IconButton>
      </div>
      {actions.customFrame && <WindowControls actions={actions} />}
    </header>
  )
}
