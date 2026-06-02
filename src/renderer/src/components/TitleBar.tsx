import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { clampMode, hasBothEditions } from '@renderer/lib/themes'
import { useT } from '@renderer/lib/i18n'

const fire = (channel: string) => (): void => window.api.triggerMenu(channel)

function IconButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        'flex h-7 w-7 items-center justify-center rounded-md text-muted ' +
        (disabled
          ? 'cursor-default opacity-30 '
          : 'hover:bg-ink/5 hover:text-ink ') +
        (active ? 'bg-ink/5 text-accent' : '')
      }
    >
      {children}
    </button>
  )
}

export default function TitleBar(): JSX.Element {
  const { doc, sidebarOpen, sidebarTab, theme, mode, externalThemes, formatBarOpen } =
    useAppStore()
  const outlineOpen = sidebarOpen && sidebarTab === 'outline'
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleOutline = useAppStore((s) => s.toggleOutline)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const toggleFormatBar = useAppStore((s) => s.toggleFormatBar)
  const isDark = clampMode(theme, mode, externalThemes) === 'dark'
  const canToggle = hasBothEditions(theme, externalThemes)
  const t = useT()

  return (
    <header
      className="flex h-10 shrink-0 select-none items-center border-b border-line bg-chrome px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton label={t('title.toggleSidebar')} active={sidebarOpen} onClick={toggleSidebar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </IconButton>
        <IconButton label={t('title.toggleOutline')} active={outlineOpen} onClick={toggleOutline}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </IconButton>
        <IconButton label={t('title.toggleFormatBar')} active={formatBarOpen} onClick={toggleFormatBar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4h8a4 4 0 010 8H6zM6 12h9a4 4 0 010 8H6z" />
          </svg>
        </IconButton>
      </div>

      <div className="mx-1.5 h-5 w-px bg-line" />

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton label={t('title.newFile')} onClick={fire(IPC.menuNewFile)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
            <path d="M14 3v5h5" />
            <line x1="12" y1="12" x2="12" y2="17" />
            <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" />
          </svg>
        </IconButton>
        <IconButton label={t('title.openFile')} onClick={fire(IPC.menuOpenFile)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </IconButton>
        <IconButton label={t('title.save')} active={doc.dirty} onClick={fire(IPC.menuSave)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
        </IconButton>
        <IconButton label={t('title.print')} onClick={fire(IPC.menuPrint)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        </IconButton>
      </div>

      <div className="ml-auto flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton
          label={canToggle ? t('title.toggleTheme') : t('title.themeOneEdition')}
          disabled={!canToggle}
          onClick={toggleMode}
        >
          {!isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </IconButton>
      </div>
    </header>
  )
}
