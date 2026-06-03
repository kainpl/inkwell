import { useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import {
  addChildToSelected,
  addSiblingToSelected,
  applyMindmapTheme,
  applyCustomTheme,
  deleteSelection,
  redoActive,
  saveActive,
  undoActive
} from '@renderer/lib/mindmap/projectEditActions'
import { THEME_KEYS, MINDMAP_THEMES, type ThemeColor } from '@renderer/lib/mindmap/themes'

const BTN =
  'rounded px-2 py-1 text-[13px] text-ink enabled:hover:bg-line/40 disabled:opacity-40 disabled:cursor-default'

/** Edit toolbar for a project tab: create / delete nodes, undo/redo, save. */
export default function EditToolbar(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const dirty = useAppStore((s) => s.tabs.find((t) => t.id === activeId)?.dirty ?? false)
  const setFocus = useProjectStore((s) => s.setFocus)
  const toggleQuick = useProjectStore((s) => s.toggleQuick)
  const toggleDocs = useProjectStore((s) => s.toggleDocs)
  const toggleVersions = useProjectStore((s) => s.toggleVersions)
  const docsOn = project?.docsOpen ?? false
  const versionsOn = project?.versionsOpen ?? false
  const hasNotes = (project?.manifestInstructions ?? '') !== ''
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const setDirection = useProjectStore((s) => s.setDirection)
  const direction = project?.direction ?? 'right'
  const sel = project?.selectedId ?? null
  const hasSel = sel != null
  const focused = project?.focusId != null
  const quickOn = project?.quickOpen ?? false
  const viewMode = project?.viewMode ?? 'map'
  const [customOpen, setCustomOpen] = useState(false)
  const [palette, setPalette] = useState<ThemeColor[]>(() => MINDMAP_THEMES.ocean.map((c) => ({ ...c })))
  const setTier = (i: number, key: keyof ThemeColor, value: string): void =>
    setPalette((p) => p.map((c, j) => (j === i ? { ...c, [key]: value } : c)))
  const VIEW_BTN = (mode: 'map' | 'outline' | 'table' | 'split', label: string): JSX.Element => (
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
        {VIEW_BTN('table', 'Table')}
        {VIEW_BTN('split', 'Split')}
      </div>
      <div className="mr-1 flex overflow-hidden rounded border border-line" title="Map growth direction">
        <button
          onClick={() => setDirection('right')}
          className={`px-2 py-0.5 text-[12px] ${direction === 'right' ? 'bg-accent text-paper' : 'text-muted hover:text-ink'}`}
          title="Horizontal"
        >
          →
        </button>
        <button
          onClick={() => setDirection('down')}
          className={`px-2 py-0.5 text-[12px] ${direction === 'down' ? 'bg-accent text-paper' : 'text-muted hover:text-ink'}`}
          title="Vertical"
        >
          ↓
        </button>
        <button
          onClick={() => setDirection('radial')}
          className={`px-2 py-0.5 text-[12px] ${direction === 'radial' ? 'bg-accent text-paper' : 'text-muted hover:text-ink'}`}
          title="Radial (two-sided)"
        >
          ⇆
        </button>
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
        className={`${BTN} ${docsOn ? 'text-accent' : ''}`}
        onClick={toggleDocs}
        title="All project documents + their nodes (and project notes)"
      >
        Docs{hasNotes ? <span className="ml-0.5 text-accent">•</span> : null}
      </button>
      <button
        className={`${BTN} ${versionsOn ? 'text-accent' : ''}`}
        onClick={toggleVersions}
        title="Schema version history (snapshots on save)"
      >
        History
      </button>
      <button
        className={`${BTN} ${focused ? 'text-accent' : ''}`}
        disabled={!hasSel && !focused}
        onClick={() => setFocus(focused ? null : sel)}
        title="Focus the selected branch ( . ) — Esc clears"
      >
        Focus
      </button>
      <div className="relative">
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (v === 'custom') setCustomOpen(true)
            else if (v) applyMindmapTheme(v)
          }}
          title="Recolor the whole map from a palette"
          className="rounded border border-line bg-paper px-1 py-1 text-[12px] text-ink"
        >
          <option value="" disabled>
            🎨 Theme
          </option>
          {THEME_KEYS.map((k) => (
            <option key={k} value={k}>
              {k === 'clear' ? 'Clear colors' : k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {customOpen ? (
          <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-line bg-paper p-2 shadow-lg">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-faint">
              Custom palette (by depth)
            </div>
            {palette.map((c, i) => (
              <div key={i} className="mb-1 flex items-center gap-2 text-[11px]">
                <span className="w-10 text-faint">tier {i + 1}</span>
                {(['fill', 'text', 'line'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-0.5" title={k}>
                    <input
                      type="color"
                      value={c[k]}
                      onChange={(e) => setTier(i, k, e.target.value)}
                      className="h-5 w-6 rounded border border-line"
                    />
                  </label>
                ))}
              </div>
            ))}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setCustomOpen(false)} className="text-[12px] text-faint hover:text-ink">
                Cancel
              </button>
              <button
                onClick={() => {
                  applyCustomTheme(palette)
                  setCustomOpen(false)
                }}
                className="rounded border border-line px-2 py-0.5 text-[12px] hover:border-accent hover:text-accent"
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}
      </div>
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
