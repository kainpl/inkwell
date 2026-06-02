import Canvas from './Canvas'
import DocPane from './DocPane'

/** Project tab body: schema canvas on the left, read-only doc pane on the right.
 *  The tab itself (TabBar) owns the title + close affordance. */
export default function ProjectView(): JSX.Element {
  return (
    <div className="flex h-full w-full">
      <div className="min-w-0 flex-1">
        <Canvas />
      </div>
      <div className="w-[420px] shrink-0 overflow-hidden border-l border-line">
        <DocPane />
      </div>
    </div>
  )
}
