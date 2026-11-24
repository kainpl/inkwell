import { useTranslate } from '@renderer/lib/i18n'
import { useState } from 'react'
import type { FileNode } from '@shared/files'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { openPath, openFolderFromDialog } from '@renderer/lib/docActions'
import FolderSearch from './FolderSearch'

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      className={'transition-transform ' + (open ? 'rotate-90' : '')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TreeRow({ node, depth }: { node: FileNode; depth: number }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<FileNode[] | undefined>(node.children)
  const activePath = useAppStore((s) => activeTab(s).doc.path)

  const isDir = node.type === 'directory'
  const isActive = !isDir && activePath === node.path

  const onClick = async (): Promise<void> => {
    if (isDir) {
      const next = !open
      setOpen(next)
      if (next && !children) {
        setChildren(await window.api.readDir(node.path))
      }
    } else {
      await openPath(node.path)
    }
  }

  return (
    <div>
      <button
        onClick={onClick}
        title={node.name}
        className={
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px] ' +
          'hover:bg-ink/5 ' +
          (isActive ? 'bg-accent/10 text-accent' : 'text-ink/80')
        }
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="w-3 shrink-0 text-faint">
          {isDir ? <ChevronIcon open={open} /> : null}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open && children && (
        <div>
          {children.map((c) => (
            <TreeRow key={c.path} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree(): JSX.Element {
  const t = useTranslate()
  const root = useAppStore((s) => s.root)

  if (!root) {
    return (
      <div className="px-3 py-6 text-[13px] leading-relaxed text-faint">
        {t('No folder open.')}
        <br />
        <button className="text-accent hover:underline" onClick={openFolderFromDialog}>
          {t('Open Folder…')}
        </button>
      </div>
    )
  }

  return (
    <FolderSearch key={root.path} path={root.path}>
      <div className="py-1">
        <div className="truncate px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
          {root.name}
        </div>
        {root.children?.map((c) => (
          <TreeRow key={c.path} node={c} depth={0} />
        ))}
      </div>
    </FolderSearch>
  )
}
