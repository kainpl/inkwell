import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { message } from '@tauri-apps/plugin-dialog'
import { EditorView } from '@codemirror/view'
import { undo, redo, selectAll } from '@codemirror/commands'
import {
  closeTab,
  guardAllUnsaved,
  guardUnsaved,
  installAutosave,
  installFileRefresh,
  newDocument,
  openFileFromDialog,
  openFolderFromDialog,
  openRecent,
  reloadFromDisk,
  saveDoc,
  saveDocAs
} from '@renderer/lib/docActions'
import { useAppStore } from '@renderer/store/useAppStore'
import { commands, defaultShortcuts, eventShortcut } from '@renderer/lib/shortcuts'
import { openSearchPanel } from '@codemirror/search'
import { applyFormat } from '@renderer/components/Editor/formatCommands'
import { useConfirm } from '@renderer/store/useConfirm'
import { updateRecents } from '@renderer/lib/recents'
import type { DesktopActions, MenuAction } from './menu'
import { installNativeMenu } from './nativeMenu'

function reportFileError(error: unknown): Promise<unknown> {
  return message(String(error), { title: 'Inkwell', kind: 'error' })
}

export async function installDesktopShell(): Promise<DesktopActions> {
  const win = getCurrentWindow()
  const webview = getCurrentWebview()
  const store = useAppStore.getState()
  let zoom = 1
  let busy = false

  const guarded = async (callback: () => unknown, closing = false) => {
    if (busy || useConfirm.getState().open || useAppStore.getState().preferencesOpen) return
    // The close-request handler acquires the guard while prompting about edits.
    if (!closing) busy = true
    try {
      await callback()
    } catch (error) {
      await reportFileError(error)
    } finally {
      if (!closing) busy = false
    }
  }
  const edit = (run: (editor: EditorView) => unknown, documentOnly = false) => {
    const host =
      (!documentOnly && document.activeElement?.closest<HTMLElement>('.cm-editor')) ||
      document.querySelector<HTMLElement>('.cm-editor')
    const editor = host && EditorView.findFromDOM(host)
    if (editor) run(editor)
  }
  const history = (back: boolean) => {
    const host = document.querySelector<HTMLElement>('.cm-editor')
    const editor = host && EditorView.findFromDOM(host)
    if (editor && (!document.activeElement?.matches('input,textarea') || editor.hasFocus)) {
      const command = back ? undo : redo
      command(editor)
      editor.focus()
    } else {
      document.execCommand(back ? 'undo' : 'redo')
    }
  }
  const changeZoom = async (step: number) => {
    zoom = step ? Math.max(0.5, Math.min(3, zoom + step)) : 1
    await webview.setZoom(zoom)
  }
  const callbacks: Record<MenuAction, () => unknown> = {
    New: newDocument,
    'Open File…': openFileFromDialog,
    'Open Folder…': openFolderFromDialog,
    Save: saveDoc,
    'Save As…': saveDocAs,
    Settings: () => store.showPreferences(true),
    Close: () => closeTab(),
    Undo: () => history(true),
    Redo: () => history(false),
    Cut: () => document.execCommand('cut'),
    Copy: () => document.execCommand('copy'),
    Paste: async () => {
      if (document.execCommand('paste')) return
      const target = document.activeElement
      const text = await navigator.clipboard.readText()
      if (!text || !target || target !== document.activeElement) return
      if (target.closest('.cm-content')) {
        const data = new DataTransfer()
        data.setData('text/plain', text)
        target.dispatchEvent(
          new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
        )
      } else if (target.matches('textarea,input,[contenteditable=true]')) {
        document.execCommand('insertText', false, text)
      }
    },
    'Select all': () =>
      document.activeElement?.closest('.cm-content')
        ? edit(selectAll)
        : document.execCommand('selectAll'),
    Find: () => edit(openSearchPanel, true),
    Bold: () => edit((v) => applyFormat(v, 'bold')),
    Italic: () => edit((v) => applyFormat(v, 'italic')),
    Strikethrough: () => edit((v) => applyFormat(v, 'strike')),
    'Inline code': () => edit((v) => applyFormat(v, 'code')),
    Link: () => edit((v) => applyFormat(v, 'link')),
    Sidebar: store.toggleSidebar,
    Outline: store.toggleOutline,
    Source: store.toggleSourceMode,
    Focus: store.toggleFocusMode,
    Typewriter: store.toggleTypewriter,
    Reload: async () => {
      if (await guardUnsaved()) await reloadFromDisk()
    },
    'Actual Size': () => changeZoom(0),
    'Zoom In': () => changeZoom(1),
    'Zoom Out': () => changeZoom(-1),
    'Full Screen': async () => win.setFullscreen(!(await win.isFullscreen())),
    Minimize: () => win.minimize(),
    Maximize: () => win.toggleMaximize()
  }
  const actions: DesktopActions = {
    customFrame: navigator.platform.startsWith('Win'),
    run: (id) => guarded(callbacks[id]),
    closeWindow: () => guarded(() => win.close(), true),
    recent: (kind, path) => guarded(() => openRecent(kind, path))
  }
  await updateRecents().catch(reportFileError)
  if (!actions.customFrame) await installNativeMenu(actions, reportFileError)
  // Another Inkwell window may have changed the history.
  window.addEventListener('focus', () => {
    void updateRecents().catch(console.error)
  })
  // Tauri applies the native menu theme to menus already attached to a window.
  const setShellTheme = (theme: typeof store.theme) => invoke<void>('set_shell_theme', { theme })
  await setShellTheme(store.theme)
  // A focused webview can receive keys before its host menu on Windows.
  window.addEventListener(
    'keydown',
    (event) => {
      const state = useAppStore.getState()
      if (
        event.defaultPrevented ||
        event.isComposing ||
        state.preferencesOpen ||
        useConfirm.getState().open
      )
        return
      if (event.key === 'Tab' && event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault()
        const index = state.tabs.findIndex((tab) => tab.id === state.documentId)
        const next = (index + (event.shiftKey ? -1 : 1) + state.tabs.length) % state.tabs.length
        state.activateTab(state.tabs[next].id)
        return
      }
      const shortcut = eventShortcut(event)
      const id = shortcut && commands.find((cmd) => state.shortcuts[cmd] === shortcut)
      if (!id) {
        if (
          shortcut &&
          event.target instanceof HTMLElement &&
          event.target.closest('.cm-content') &&
          commands.some(
            (cmd) => defaultShortcuts[cmd] === shortcut && state.shortcuts[cmd] !== shortcut
          )
        ) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.matches('input,textarea') &&
        ['Undo', 'Redo', 'Italic', 'Bold', 'Link', 'Inline code', 'Strikethrough'].includes(id)
      )
        return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) void actions.run(id)
    },
    true
  )
  useAppStore.subscribe((next, prev) => {
    if (next.theme !== prev.theme) void setShellTheme(next.theme).catch(reportFileError)
  })
  installAutosave((error) => {
    void reportFileError(error)
  })
  installFileRefresh()

  await win.onCloseRequested(async (event) => {
    if (!useAppStore.getState().tabs.some((tab) => tab.doc.dirty)) return
    event.preventDefault()
    if (useConfirm.getState().open || busy) return
    store.showPreferences(false)
    busy = true
    try {
      if (await guardAllUnsaved()) await win.destroy()
    } catch (error) {
      await reportFileError(error)
    } finally {
      busy = false
    }
  })
  return actions
}
