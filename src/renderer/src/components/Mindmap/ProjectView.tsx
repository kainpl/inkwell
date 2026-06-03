import { useEffect } from 'react'
import Canvas from './Canvas'
import DocPane from './DocPane'
import DocBar from './DocBar'
import EditToolbar from './EditToolbar'
import EdgeInspector from './EdgeInspector'
import NodeInspector from './NodeInspector'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import {
  addChildToSelected,
  addSiblingToSelected,
  beginRenameSelected,
  deleteSelected,
  deleteSelectedLink,
  redoActive,
  undoActive
} from '@renderer/lib/mindmap/projectEditActions'

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
      const tabId = useAppStore.getState().activeId
      const proj = useProjectStore.getState().byTab[tabId]
      if (!proj) return
      const sel = proj.selectedId
      switch (e.key) {
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
            deleteSelected()
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
