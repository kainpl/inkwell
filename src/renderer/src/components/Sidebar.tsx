import FileTree from './FileTree'
import ArticlesPanel from './ArticlesPanel'
import { useAppStore } from '@renderer/store/useAppStore'

export default function Sidebar(): JSX.Element {
  const open = useAppStore((s) => s.sidebarOpen)
  const tab = useAppStore((s) => s.sidebarTab)
  const setTab = useAppStore((s) => s.setSidebarTab)

  return (
    <aside
      className={
        'flex h-full shrink-0 flex-col border-r border-line bg-chrome ' +
        'transition-all duration-200 ' +
        (open ? 'w-60' : 'w-0 overflow-hidden border-r-0')
      }
    >
      {open && (
        <>
          <div className="flex shrink-0 border-b border-line text-[12px]">
            {(['files', 'articles'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  'flex-1 py-1.5 capitalize ' +
                  (tab === t ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-ink')
                }
              >
                {t === 'files' ? 'Files' : 'Articles'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'files' ? <FileTree /> : <ArticlesPanel />}
          </div>
        </>
      )}
    </aside>
  )
}
