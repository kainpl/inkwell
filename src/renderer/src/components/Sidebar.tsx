import { useState } from 'react'
import FilesPanel from './FilesPanel'
import OutlineView from './OutlineView'
import ResizeHandle from './ResizeHandle'
import { useAppStore } from '@renderer/store/useAppStore'
import { useT } from '@renderer/lib/i18n'

export default function Sidebar(): JSX.Element {
  const open = useAppStore((s) => s.sidebarOpen)
  const tab = useAppStore((s) => s.sidebarTab)
  const setTab = useAppStore((s) => s.setSidebarTab)
  const width = useAppStore((s) => s.sidebarWidth)
  const setWidth = useAppStore((s) => s.setSidebarWidth)
  const [dragging, setDragging] = useState(false)
  const t = useT()

  return (
    <aside
      style={{ width: open ? width : 0 }}
      className={
        'relative flex h-full shrink-0 flex-col border-r border-line bg-chrome ' +
        (dragging ? '' : 'transition-[width] duration-200 ') +
        (open ? '' : 'overflow-hidden border-r-0')
      }
    >
      {open && (
        <>
          <div className="flex shrink-0 border-b border-line text-[12px]">
            {(['files', 'outline'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={
                  'flex-1 py-1.5 ' +
                  (tab === id ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-ink')
                }
              >
                {id === 'files' ? t('sidebar.files') : t('sidebar.outline')}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === 'files' ? <FilesPanel /> : <OutlineView />}
          </div>
          <ResizeHandle side="right" onResize={setWidth} onActive={setDragging} />
        </>
      )}
    </aside>
  )
}
