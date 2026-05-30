import FileTree from './FileTree'
import { useAppStore } from '@renderer/store/useAppStore'

export default function Sidebar(): JSX.Element {
  const open = useAppStore((s) => s.sidebarOpen)

  return (
    <aside
      className={
        'h-full shrink-0 overflow-y-auto border-r border-line bg-chrome ' +
        'transition-all duration-200 ' +
        (open ? 'w-60' : 'w-0 overflow-hidden border-r-0')
      }
    >
      {open && <FileTree />}
    </aside>
  )
}
