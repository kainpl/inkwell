import { useEffect, useRef } from 'react'
import Canvas from './Canvas'
import DocPane from './DocPane'
import DocBar from './DocBar'
import EditToolbar from './EditToolbar'
import EdgeInspector from './EdgeInspector'
import NodeInspector from './NodeInspector'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { navigate, expandToLevel, type NavDir } from '@renderer/lib/mindmap/treeNav'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'
import {
  addChildToSelected,
  addSiblingToSelected,
  beginRenameSelected,
  deleteSelection,
  deleteSelectedLink,
  redoActive,
  undoActive
} from '@renderer/lib/mindmap/projectEditActions'

const ARROW_DIR: Record<string, NavDir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}

/** True when keystrokes belong to a text field / interactive control, not the canvas. */
function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return true
  return t.isContentEditable || t.closest('.cm-editor') != null
}

/** Project tab body: edit toolbar on top, schema canvas + read-only doc pane below.
 *  Mounts only for project tabs, so its key handler never touches the file editor. */
export default function ProjectView(): JSX.Element {
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const graphRef = useRef(graph)
  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return
      // Undo/redo work without a selection; a file tab never reaches here (ProjectView unmounts).
      const mod = e.ctrlKey || e.metaKey
      if (mod) {
        const k = e.key.toLowerCase()
        if (k === 'f' && e.shiftKey) {
          e.preventDefault()
          useProjectStore.getState().toggleSearch()
        } else if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redoActive()
          else undoActive()
        } else if (k === 'y') {
          e.preventDefault()
          redoActive()
        }
        return
      }
      const store = useProjectStore.getState()
      const tabId = useAppStore.getState().activeId
      const proj = store.byTab[tabId]
      const g = graphRef.current
      if (!proj) return
      const sel = proj.selectedId

      // Expand-to-level: 1–9 reveal that depth, 0 expands everything.
      if (g && /^[0-9]$/.test(e.key)) {
        e.preventDefault()
        const lvl = Number(e.key)
        store.setCollapsed(lvl === 0 ? new Set() : expandToLevel(g, lvl))
        return
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!sel || !g) break
          e.preventDefault()
          const dir = ARROW_DIR[e.key]
          // Right on a collapsed node with children expands it instead of moving.
          if (dir === 'right' && proj.collapsed.has(sel) && (g.childrenOf.get(sel)?.length ?? 0) > 0) {
            store.expand(sel)
            break
          }
          const next = navigate(g, sel, dir)
          if (next) {
            store.select(next)
            centerOnNode(next)
          }
          break
        }
        case 'Home': {
          const root = g?.nodes.find((n) => n.parentId === null)
          if (root) {
            e.preventDefault()
            store.select(root.id)
            centerOnNode(root.id)
          }
          break
        }
        case 'Tab':
          if (sel) {
            e.preventDefault()
            addChildToSelected()
          }
          break
        case 'Enter':
          if (sel) {
            e.preventDefault()
            addSiblingToSelected()
          }
          break
        case 'F2':
          if (sel) {
            e.preventDefault()
            beginRenameSelected()
          }
          break
        case 'Delete':
        case 'Backspace':
          if (sel) {
            e.preventDefault()
            deleteSelection()
          } else if (proj.selectedLink) {
            e.preventDefault()
            deleteSelectedLink()
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <EditToolbar />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Canvas />
          <EdgeInspector />
          <NodeInspector />
        </div>
        <div className="flex w-[420px] shrink-0 flex-col overflow-hidden border-l border-line">
          <DocBar />
          <div className="min-h-0 flex-1">
            <DocPane />
          </div>
        </div>
      </div>
    </div>
  )
}
