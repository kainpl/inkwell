import { useEffect } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import {
  closeDocument,
  closeFolder,
  guardAllTabs,
  loadWelcome,
  newDocument,
  openFileFromDialog,
  openFolderFromDialog,
  reopenClosedFile,
  restoreSession,
  recoverDrafts,
  saveDoc,
  saveDocAs
} from '@renderer/lib/docActions'
import { setSessionFile } from '@renderer/lib/persistence'
import { startThemeSync } from '@renderer/lib/themeApply'
import { EditorView } from '@codemirror/view'
import { cursorDocStart, cursorDocEnd } from '@codemirror/commands'
import { useEditor } from '@renderer/store/useEditor'
import { runFormatAction } from '@renderer/lib/runFormatAction'
import {
  exportHtmlFile,
  exportPdfFile,
  exportImageFile,
  exportPandocFile,
  printDocument,
  copyAsMarkdown,
  copyAsHtml,
  copyAsPlainText,
  copyAsImage
} from '@renderer/lib/exportActions'
import { startAutoSave } from '@renderer/lib/autoSave'
import { startDraftAutoSave } from '@renderer/lib/draftAutoSave'
import { startDiskWatch } from '@renderer/lib/diskWatch'
import { startSettingsSync } from '@renderer/lib/settingsSync'
import TitleBar from '@renderer/components/TitleBar'
import TabBar from '@renderer/components/TabBar'
import Sidebar from '@renderer/components/Sidebar'
import OutlinePanel from '@renderer/components/OutlinePanel'
import StatusBar from '@renderer/components/StatusBar'
import Editor from '@renderer/components/Editor/Editor'
import Toolbar from '@renderer/components/Toolbar'
import FloatingToolbar from '@renderer/components/FloatingToolbar'
import ImageZoom from '@renderer/components/ImageZoom'
import QuickOpen from '@renderer/components/QuickOpen'
import CommandPalette from '@renderer/components/CommandPalette'
import GlobalSearch from '@renderer/components/GlobalSearch'
import RecentFiles from '@renderer/components/RecentFiles'
import BrowseVersions from '@renderer/components/BrowseVersions'
import PageSetupModal from '@renderer/components/PageSetupModal'
import PreferencesModal from '@renderer/components/PreferencesModal'
import PandocDownload from '@renderer/components/PandocDownload'
import PromptModal from '@renderer/components/PromptModal'
import ConfirmUnsavedModal from '@renderer/components/ConfirmUnsavedModal'

export default function App(): JSX.Element {
  const formatBarOpen = useAppStore((s) => s.formatBarOpen)

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
      window.api.onMenu(IPC.menuToggleAutoSave, () => useAppStore.getState().toggleAutoSave()),
      window.api.onMenu(IPC.menuSetLineEndingLf, () => useAppStore.getState().setLineEnding('lf')),
      window.api.onMenu(IPC.menuSetLineEndingCrlf, () =>
        useAppStore.getState().setLineEnding('crlf')
      ),
      window.api.onMenu(IPC.menuToggleFinalNewline, () =>
        useAppStore.getState().toggleFinalNewline()
      ),
      window.api.onMenu(IPC.menuReopenClosed, () => void reopenClosedFile()),
      window.api.onMenu(IPC.menuClose, () => void closeDocument()),
      window.api.onMenu(IPC.menuCloseFolder, () => void closeFolder()),
      window.api.onMenu(IPC.menuExportHtml, () => void exportHtmlFile(true)),
      window.api.onMenu(IPC.menuExportHtmlPlain, () => void exportHtmlFile(false)),
      window.api.onMenu(IPC.menuExportPdf, () => void exportPdfFile()),
      window.api.onMenu(IPC.menuPrint, () => void printDocument()),
      window.api.onMenu(IPC.menuExportImage, () => void exportImageFile()),
      window.api.onMenu(IPC.menuCopyMarkdown, () => void copyAsMarkdown()),
      window.api.onMenu(IPC.menuCopyHtml, () => void copyAsHtml()),
      window.api.onMenu(IPC.menuCopyPlain, () => void copyAsPlainText()),
      window.api.onMenu(IPC.menuCopyImage, () => void copyAsImage()),
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
      if (view) runFormatAction(view, action)
    })
  }, [])

  // Pandoc export-menu commands (docx/odt/rtf/epub/latex).
  useEffect(() => window.api.onExportPandoc((format) => void exportPandocFile(format)), [])

  // Keep the main process informed of unsaved state across ALL tabs (drives the
  // window-close guard), and keep the restorable session file on the active tab.
  useEffect(() => {
    const anyDirty = (): boolean => useAppStore.getState().tabs.some((t) => t.dirty)
    let lastDirty = anyDirty()
    let lastPath = useAppStore.getState().doc.path
    window.api.setDirty(lastDirty)
    return useAppStore.subscribe(() => {
      const dirty = anyDirty()
      if (dirty !== lastDirty) {
        lastDirty = dirty
        window.api.setDirty(dirty)
      }
      const path = useAppStore.getState().doc.path
      if (path !== lastPath) {
        lastPath = path
        setSessionFile(path)
      }
    })
  }, [])

  // Window close requested while a tab is dirty: guard every dirty tab, then close.
  useEffect(() => {
    return window.api.onTryClose(() => {
      void guardAllTabs().then((ok) => {
        if (ok) window.api.closeWindow()
      })
    })
  }, [])

  // Debounced auto-save + crash-recovery draft snapshots for the app's lifetime.
  useEffect(() => {
    const stopAutoSave = startAutoSave()
    const stopDrafts = startDraftAutoSave()
    const stopDiskWatch = startDiskWatch()
    const stopSettings = startSettingsSync()
    const stopThemes = startThemeSync()
    return () => {
      stopAutoSave()
      stopDrafts()
      stopDiskWatch()
      stopSettings()
      stopThemes()
    }
  }, [])

  // Reopen the last session (or show the welcome doc on first launch), then
  // offer to recover any crash-recovery draft.
  useEffect(() => {
    void restoreSession()
      .then((restored) => (restored ? undefined : loadWelcome()))
      .then(() => recoverDrafts())
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-paper">
      <TitleBar />
      <TabBar />
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
      <CommandPalette />
      <GlobalSearch />
      <RecentFiles />
      <BrowseVersions />
      <PageSetupModal />
      <PreferencesModal />
      <PandocDownload />
      <PromptModal />
      <ConfirmUnsavedModal />
    </div>
  )
}
