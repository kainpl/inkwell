import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import {
  addChildToSelected,
  addSiblingToSelected,
  deleteSelection,
  redoActive,
  saveActive,
  undoActive
} from '@renderer/lib/mindmap/projectEditActions'

const BTN =
  'rounded px-2 py-1 text-[13px] text-ink enabled:hover:bg-line/40 disabled:opacity-40 disabled:cursor-default'

/** Edit toolbar for a project tab: create / delete nodes, undo/redo, save. */
export default function EditToolbar(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const dirty = useAppStore((s) => s.tabs.find((t) => t.id === activeId)?.dirty ?? false)
  const setFocus = useProjectStore((s) => s.setFocus)
  const toggleQuick = useProjectStore((s) => s.toggleQuick)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const sel = project?.selectedId ?? null
  const hasSel = sel != null
  const focused = project?.focusId != null
  const quickOn = project?.quickOpen ?? false
  const viewMode = project?.viewMode ?? 'map'
  const VIEW_BTN = (mode: 'map' | 'outline' | 'split', label: string): JSX.Element => (
    <button
      onClick={() => setViewMode(mode)}
      className={`px-2 py-0.5 text-[12px] ${viewMode === mode ? 'bg-accent text-paper' : 'text-muted hover:text-ink'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1 border-b border-line bg-chrome px-2 py-1">
      <div className="mr-1 flex overflow-hidden rounded border border-line">
        {VIEW_BTN('map', 'Map')}
        {VIEW_BTN('outline', 'Outline')}
        {VIEW_BTN('split', 'Split')}
      </div>
      <span className="mx-1 h-4 w-px bg-line" />
      <button className={BTN} disabled={!hasSel} onClick={addChildToSelected} title="Add child (Tab)">
        + Child
      </button>
      <button
        className={BTN}
        disabled={!hasSel}
        onClick={addSiblingToSelected}
        title="Add sibling (Enter)"
      >
        + Sibling
      </button>
      <button
        className={`${BTN} ${quickOn ? 'text-accent' : ''}`}
        onClick={toggleQuick}
        title="Quick add (rapid keyboard capture)"
      >
        ⚡ Quick
      </button>
      <button className={BTN} disabled={!hasSel} onClick={deleteSelection} title="Delete (Del)">
        Delete
      </button>
      <button
        className={`${BTN} ${focused ? 'text-accent' : ''}`}
        disabled={!hasSel && !focused}
        onClick={() => setFocus(focused ? null : sel)}
        title="Focus the selected branch ( . ) — Esc clears"
      >
        Focus
      </button>
      <span className="mx-1 h-4 w-px bg-line" />
      <button className={BTN} onClick={undoActive} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button className={BTN} onClick={redoActive} title="Redo (Ctrl+Shift+Z)">
        Redo
      </button>
      <span className="flex-1" />
      <button className={BTN} disabled={!dirty} onClick={() => void saveActive()} title="Save (Ctrl+S)">
        Save
      </button>
    </div>
  )
}
