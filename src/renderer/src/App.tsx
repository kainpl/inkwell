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
import { useEditor } from '@renderer/store/useEditor'
import { applyFormat, type FormatAction } from '@renderer/lib/formatCommands'
import TitleBar from '@renderer/components/TitleBar'
import Sidebar from '@renderer/components/Sidebar'
import OutlinePanel from '@renderer/components/OutlinePanel'
import StatusBar from '@renderer/components/StatusBar'
import Editor from '@renderer/components/Editor/Editor'
import Toolbar from '@renderer/components/Toolbar'
import FloatingToolbar from '@renderer/components/FloatingToolbar'
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
      window.api.onMenu(IPC.menuToggleFormatBar, () => useAppStore.getState().toggleFormatBar())
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Native Format-menu commands run against the live editor view.
  useEffect(() => {
    return window.api.onFormat((action) => {
      const view = useEditor.getState().view
      if (view) applyFormat(view, action as FormatAction)
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
      <ConfirmUnsavedModal />
    </div>
  )
}
