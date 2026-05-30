import { useAppStore } from '@renderer/store/useAppStore'

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

export default function TitleBar(): JSX.Element {
  const { doc, sidebarOpen, outlineOpen, theme, formatBarOpen } = useAppStore()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleOutline = useAppStore((s) => s.toggleOutline)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const toggleFormatBar = useAppStore((s) => s.toggleFormatBar)

  return (
    <header
      className="flex h-10 shrink-0 select-none items-center justify-between border-b border-line bg-chrome px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton label="Toggle sidebar (⌘\\)" active={sidebarOpen} onClick={toggleSidebar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </IconButton>
        <IconButton label="Toggle formatting bar (⌘⇧B)" active={formatBarOpen} onClick={toggleFormatBar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4h8a4 4 0 010 8H6zM6 12h9a4 4 0 010 8H6z" />
          </svg>
        </IconButton>
      </div>

      <div className="pointer-events-none flex items-center gap-2 text-[13px] text-muted">
        <span className="truncate">{doc.name}</span>
        {doc.dirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unsaved changes" />}
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton label="Toggle theme" onClick={toggleTheme}>
          {theme === 'light' ? (
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
        <IconButton label="Toggle outline (⌘/)" active={outlineOpen} onClick={toggleOutline}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </IconButton>
      </div>
    </header>
  )
}
