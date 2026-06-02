import { useEffect, useState, type ReactNode } from 'react'
import { IPC } from '@shared/ipc'
import { openPath, openFolderByPath } from '@renderer/lib/docActions'
import { getRecentFiles, getRecentFolders } from '@renderer/lib/persistence'
import { baseName } from '@renderer/lib/recentFiles'
import { useT } from '@renderer/lib/i18n'

/**
 * Recent history picker (File → Open Recent). Two sections — recently opened
 * Folders (open the workspace) and Files (open the document). Esc to close.
 */
export default function RecentPicker(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [folders, setFolders] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const t = useT()

  useEffect(() => {
    return window.api.onMenu(IPC.menuOpenRecent, () => {
      setFolders(getRecentFolders())
      setFiles(getRecentFiles())
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const pickFolder = (path: string): void => {
    setOpen(false)
    void openFolderByPath(path)
  }
  const pickFile = (path: string): void => {
    setOpen(false)
    void openPath(path)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-[32rem] max-w-[90vw] overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] font-medium text-muted">{t('recent.title')}</div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {folders.length === 0 && files.length === 0 && (
            <div className="px-3 py-3 text-sm text-faint">{t('recent.none')}</div>
          )}
          {folders.length > 0 && (
            <Section title={t('recent.folders')}>
              {folders.map((path) => (
                <Row key={path} path={path} glyph="📁" onClick={() => pickFolder(path)} />
              ))}
            </Section>
          )}
          {files.length > 0 && (
            <Section title={t('recent.files')}>
              {files.map((path) => (
                <Row key={path} path={path} glyph="📄" onClick={() => pickFile(path)} />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mb-1">
      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      {children}
    </div>
  )
}

function Row({ path, glyph, onClick }: { path: string; glyph: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={path}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink/80 hover:bg-ink/5"
    >
      <span className="shrink-0">{glyph}</span>
      <span className="shrink-0 truncate">{baseName(path)}</span>
      <span className="ml-auto min-w-0 shrink truncate text-[11px] text-faint">{path}</span>
    </button>
  )
}
