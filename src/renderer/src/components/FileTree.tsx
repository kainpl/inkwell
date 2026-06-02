import { useEffect, useState } from 'react'
import type { FileNode } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from '@renderer/lib/docActions'
import {
  TREE_CHANGED,
  newFile,
  newFolder,
  renameEntry,
  moveEntry,
  duplicateEntry,
  deleteEntry,
  revealEntry
} from '@renderer/lib/fileOps'
import { useT } from '@renderer/lib/i18n'
import StartScreen from './StartScreen'

/** Colours for git status badges (fixed semantic colours, theme-independent). */
const GIT_COLORS: Record<string, string> = {
  M: '#d9912a', // modified — amber
  A: '#3a9e4a', // added — green
  '?': '#3a9e4a', // untracked — green
  D: '#d35454', // deleted — red
  R: '#4a86d9', // renamed — blue
  U: '#d35454' // conflict — red
}

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

interface MenuState {
  x: number
  y: number
  node: FileNode
}

/** Right-click context menu for a tree node. */
function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }): JSX.Element {
  const { node } = menu
  const t = useT()
  const isDir = node.type === 'directory'
  // For a directory, "new" targets it; for a file, its parent directory.
  const dir = isDir
    ? node.path
    : node.path.slice(0, Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\')))

  const item = (label: string, fn: () => void): JSX.Element => (
    <button
      onClick={() => {
        onClose()
        fn()
      }}
      className="block w-full px-3 py-1 text-left text-[13px] text-ink/80 hover:bg-ink/5"
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-50 min-w-44 rounded-md border border-line bg-paper py-1 shadow-xl"
        style={{ top: menu.y, left: menu.x }}
      >
        {item(t('ctx.newFile'), () => void newFile(dir))}
        {item(t('ctx.newFolder'), () => void newFolder(dir))}
        <div className="my-1 border-t border-line" />
        {item(t('ctx.rename'), () => void renameEntry(node))}
        {item(t('ctx.moveTo'), () => void moveEntry(node))}
        {!isDir && item(t('ctx.duplicate'), () => void duplicateEntry(node))}
        {item(t('ctx.delete'), () => void deleteEntry(node))}
        <div className="my-1 border-t border-line" />
        {item(t('ctx.reveal'), () => void revealEntry(node))}
      </div>
    </>
  )
}

function TreeRow({
  node,
  depth,
  onMenu
}: {
  node: FileNode
  depth: number
  onMenu: (m: MenuState) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<FileNode[] | undefined>(node.children)
  const activePath = useAppStore((s) => s.doc.path)
  const git = useAppStore((s) => s.gitStatus[node.path.replace(/\\/g, '/')])

  const isDir = node.type === 'directory'
  const isActive = !isDir && activePath === node.path

  const loadChildren = async (): Promise<void> => {
    setChildren(await window.api.readDir(node.path))
  }

  // Refresh this directory's children when something inside it changed. The
  // loader is defined inside the effect so it isn't a stale/missing dependency;
  // setState runs only inside the (async) window-event callback.
  useEffect(() => {
    if (!isDir) return
    const reload = (): void => {
      void window.api.readDir(node.path).then(setChildren)
    }
    const handler = (e: Event): void => {
      if ((e as CustomEvent<string>).detail === node.path && open) reload()
    }
    window.addEventListener(TREE_CHANGED, handler)
    return () => window.removeEventListener(TREE_CHANGED, handler)
  }, [isDir, node.path, open])

  const onClick = async (): Promise<void> => {
    if (isDir) {
      const next = !open
      setOpen(next)
      if (next && !children) await loadChildren()
    } else {
      await openPath(node.path)
    }
  }

  return (
    <div>
      <button
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu({ x: e.clientX, y: e.clientY, node })
        }}
        title={node.name}
        className={
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px] ' +
          'hover:bg-ink/5 ' +
          (isActive ? 'bg-accent/10 text-accent' : 'text-ink/80')
        }
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="w-3 shrink-0 text-faint">{isDir ? <ChevronIcon open={open} /> : null}</span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {git && (
          <span className="shrink-0 text-[11px] font-bold" style={{ color: GIT_COLORS[git] ?? 'inherit' }}>
            {git}
          </span>
        )}
      </button>
      {isDir && open && children && (
        <div>
          {children.map((c) => (
            <TreeRow key={c.path} node={c} depth={depth + 1} onMenu={onMenu} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree(): JSX.Element {
  const root = useAppStore((s) => s.root)
  const setRoot = useAppStore((s) => s.setRoot)
  const [menu, setMenu] = useState<MenuState | null>(null)

  // Refresh top-level entries when the root directory itself changed.
  useEffect(() => {
    if (!root) return
    const handler = (e: Event): void => {
      if ((e as CustomEvent<string>).detail === root.path) {
        void window.api.readFolder(root.path).then((node) => {
          if (node) setRoot(node)
        })
      }
    }
    window.addEventListener(TREE_CHANGED, handler)
    return () => window.removeEventListener(TREE_CHANGED, handler)
  }, [root, setRoot])

  if (!root) {
    return <StartScreen />
  }

  return (
    <div className="py-1">
      <div
        className="truncate px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint"
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, node: root })
        }}
      >
        {root.name}
      </div>
      {root.children?.map((c) => (
        <TreeRow key={c.path} node={c} depth={0} onMenu={setMenu} />
      ))}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
