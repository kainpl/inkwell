import { useEffect } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import {
  guardUnsaved,
  newDocument,
  openFileFromDialog,
  openFolderFromDialog,
  saveDoc,
  saveDocAs
} from '@renderer/lib/docActions'
import { EditorView } from '@codemirror/view'
import { cursorDocStart, cursorDocEnd } from '@codemirror/commands'
import { useEditor } from '@renderer/store/useEditor'
import { applyFormat, type FormatAction } from '@renderer/lib/formatCommands'
import { uploadCurrentImage } from '@renderer/lib/uploadImage'
import { applyTable, type TableAction } from '@renderer/lib/tableCommands'
import TitleBar from '@renderer/components/TitleBar'
import Sidebar from '@renderer/components/Sidebar'
import OutlinePanel from '@renderer/components/OutlinePanel'
import StatusBar from '@renderer/components/StatusBar'
import Editor from '@renderer/components/Editor/Editor'
import Toolbar from '@renderer/components/Toolbar'
import FloatingToolbar from '@renderer/components/FloatingToolbar'
import ImageZoom from '@renderer/components/ImageZoom'
import QuickOpen from '@renderer/components/QuickOpen'
import GlobalSearch from '@renderer/components/GlobalSearch'
import ConfirmUnsavedModal from '@renderer/components/ConfirmUnsavedModal'

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const formatBarOpen = useAppStore((s) => s.formatBarOpen)

  // Apply theme class to <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Wire main-process menu commands (file ops route through the unsaved guard).
  useEffect(() => {
    const store = useAppStore.getState()
    const unsubs = [
      window.api.onMenu(IPC.menuNewFile, () => void newDocument()),
      window.api.onMenu(IPC.menuOpenFile, () => void openFileFromDialog()),
      window.api.onMenu(IPC.menuOpenFolder, () => void openFolderFromDialog()),
      window.api.onMenu(IPC.menuSave, () => void saveDoc()),
      window.api.onMenu(IPC.menuSaveAs, () => void saveDocAs()),
      window.api.onMenu(IPC.menuToggleSidebar, () => store.toggleSidebar()),
      window.api.onMenu(IPC.menuToggleOutline, () => store.toggleOutline()),
      window.api.onMenu(IPC.menuToggleFocusMode, () => store.toggleFocusMode()),
      window.api.onMenu(IPC.menuToggleTypewriter, () => useAppStore.getState().toggleTypewriter()),
      window.api.onMenu(IPC.menuToggleSourceMode, () => useAppStore.getState().toggleSourceMode()),
      window.api.onMenu(IPC.menuToggleFormatBar, () => useAppStore.getState().toggleFormatBar()),
      window.api.onMenu(IPC.menuJumpTop, () => {
        const view = useEditor.getState().view
        if (view) {
          cursorDocStart(view)
          view.dispatch({ effects: EditorView.scrollIntoView(0, { y: 'start' }) })
          view.focus()
        }
      }),
      window.api.onMenu(IPC.menuJumpBottom, () => {
        const view = useEditor.getState().view
        if (view) {
          cursorDocEnd(view)
          view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.length, { y: 'end' }) })
          view.focus()
        }
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Native Format-menu commands run against the live editor view.
  useEffect(() => {
    return window.api.onFormat((action) => {
      const view = useEditor.getState().view
      if (!view) return
      if (action === 'uploadImage') void uploadCurrentImage(view)
      else if (action.startsWith('table:')) applyTable(view, action.slice(6) as TableAction)
      else applyFormat(view, action as FormatAction)
    })
  }, [])

  // Keep the main process informed of unsaved state (drives the close guard).
  useEffect(() => {
    let last = useAppStore.getState().doc.dirty
    window.api.setDirty(last)
    return useAppStore.subscribe((s) => {
      if (s.doc.dirty !== last) {
        last = s.doc.dirty
        window.api.setDirty(last)
      }
    })
  }, [])

  // Window close requested while dirty: run the guard, then close if allowed.
  useEffect(() => {
    return window.api.onTryClose(() => {
      void guardUnsaved().then((ok) => {
        if (ok) window.api.closeWindow()
      })
    })
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-paper">
      <TitleBar />
      {formatBarOpen && <Toolbar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Editor />
        </main>
        <OutlinePanel />
      </div>
      <StatusBar />
      <FloatingToolbar />
      <ImageZoom />
      <QuickOpen />
      <GlobalSearch />
      <ConfirmUnsavedModal />
    </div>
  )
}
