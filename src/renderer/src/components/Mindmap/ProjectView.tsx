import { useProjectStore } from '@renderer/store/useProjectStore'
import { closeProject } from '@renderer/lib/mindmap/projectActions'
import Canvas from './Canvas'
import DocPane from './DocPane'

/** Project mode: schema canvas on the left, read-only doc pane on the right. */
export default function ProjectView(): JSX.Element {
  const title = useProjectStore((s) => s.manifest?.title)

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-chrome px-3 text-[12px]">
        <span className="truncate text-muted">{title ?? 'Project'}</span>
        <button onClick={() => void closeProject()} className="text-faint hover:text-ink" title="Close project">
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>
        <div className="w-[420px] shrink-0 overflow-hidden border-l border-line">
          <DocPane />
        </div>
      </div>
    </div>
  )
}
