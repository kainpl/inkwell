import type { ReactNode } from 'react'
import { openFolderByPath, openFolderFromDialog, openPath } from '@renderer/lib/docActions'
import { getRecentFiles, getRecentFolders } from '@renderer/lib/persistence'
import { baseName } from '@renderer/lib/recentFiles'

/**
 * Sidebar quick-start, shown when no folder is open: an "Open Folder" button
 * plus a short Recent history (folders open the workspace, files open the doc).
 */
export default function StartScreen(): JSX.Element {
  const folders = getRecentFolders().slice(0, 6)
  const files = getRecentFiles().slice(0, 6)

  return (
    <div className="flex flex-col gap-3 px-3 py-4 text-[13px]">
      <button
        onClick={() => void openFolderFromDialog()}
        className="rounded border border-line px-2 py-1.5 text-sm text-ink hover:border-accent hover:text-accent"
      >
        Open Folder…
      </button>
      <p className="text-[12px] text-faint">
        or <span className="text-muted">⌘/Ctrl + Shift + O</span>
      </p>

      {folders.length > 0 && (
        <Section title="Recent Folders">
          {folders.map((path) => (
            <Row key={path} path={path} glyph="📁" onClick={() => void openFolderByPath(path)} />
          ))}
        </Section>
      )}
      {files.length > 0 && (
        <Section title="Recent Files">
          {files.map((path) => (
            <Row key={path} path={path} glyph="📄" onClick={() => void openPath(path)} />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="px-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      {children}
    </div>
  )
}

function Row({ path, glyph, onClick }: { path: string; glyph: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={path}
      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[13px] text-ink/80 hover:bg-ink/5"
    >
      <span className="shrink-0">{glyph}</span>
      <span className="min-w-0 truncate">{baseName(path)}</span>
    </button>
  )
}
