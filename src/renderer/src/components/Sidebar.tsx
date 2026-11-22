import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '@renderer/lib/i18n'
import { sidebarMaxWidth, sidebarMinWidth } from '@renderer/lib/settings'
import { useAppStore } from '@renderer/store/useAppStore'
import FileTree from './FileTree'
import OutlinePanel from './OutlinePanel'

const tabs = ['folder', 'outline'] as const
const widthLimit = () => Math.min(sidebarMaxWidth, Math.floor(window.innerWidth * 0.6))

export default function Sidebar(): JSX.Element {
  const t = useTranslate()
  const open = useAppStore((s) => s.sidebarOpen)
  const tab = useAppStore((s) => s.sidebarTab)
  const selectTab = useAppStore((s) => s.selectSidebarTab)
  const savedWidth = useAppStore((s) => s.sidebarWidth)
  const configure = useAppStore((s) => s.configure)
  const [max, setMax] = useState(widthLimit)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null)
  const min = Math.min(sidebarMinWidth, max)
  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value)))
  const width = clamp(dragWidth ?? savedWidth)

  useEffect(() => {
    const resize = () => setMax(widthLimit())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <aside
      aria-label={t('Sidebar')}
      className="relative flex h-full shrink-0 flex-col border-r border-line bg-chrome"
      style={{ width, display: open ? undefined : 'none' }}
    >
      <div role="tablist" aria-label={t('Sidebar')} className="flex shrink-0 border-b border-line">
        {tabs.map((id) => (
          <button
            key={id}
            role="tab"
            id={'tab-' + id}
            aria-selected={tab === id}
            aria-controls={'panel-' + id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next =
                event.key === 'Home'
                  ? 'folder'
                  : event.key === 'End'
                    ? 'outline'
                    : id === 'folder'
                      ? 'outline'
                      : 'folder'
              selectTab(next)
              document.getElementById('tab-' + next)?.focus()
            }}
            className={
              'min-w-0 flex-1 truncate border-b-2 px-2 py-2 text-[13px] ' +
              (tab === id
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-muted hover:text-ink')
            }
          >
            {t(id === 'folder' ? 'Folder' : 'Document outline')}
          </button>
        ))}
      </div>
      <div
        id="panel-folder"
        role="tabpanel"
        aria-labelledby="tab-folder"
        hidden={tab !== 'folder'}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <FileTree />
      </div>
      <div
        id="panel-outline"
        role="tabpanel"
        aria-labelledby="tab-outline"
        hidden={tab !== 'outline'}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {open && tab === 'outline' && <OutlinePanel />}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={t('Resize sidebar')}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={width}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none hover:bg-accent/30 focus-visible:bg-accent/30"
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointer: event.pointerId, x: event.clientX, width }
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (start?.pointer === event.pointerId)
            setDragWidth(clamp(start.width + event.clientX - start.x))
        }}
        onPointerUp={(event) => {
          const start = drag.current
          if (start?.pointer !== event.pointerId) return
          configure({ sidebarWidth: clamp(start.width + event.clientX - start.x) })
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onLostPointerCapture={() => {
          drag.current = null
          setDragWidth(null)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          configure({ sidebarWidth: clamp(width + (event.key === 'ArrowRight' ? 16 : -16)) })
        }}
      />
    </aside>
  )
}
