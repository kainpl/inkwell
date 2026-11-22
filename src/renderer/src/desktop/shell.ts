import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
  type PredefinedMenuItemOptions
} from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { message } from '@tauri-apps/plugin-dialog'
import { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import {
  guardUnsaved,
  installAutosave,
  newDocument,
  openFileFromDialog,
  openFolderFromDialog,
  saveDoc,
  saveDocAs
} from '@renderer/lib/docActions'
import { useAppStore } from '@renderer/store/useAppStore'
import { translate } from '@renderer/lib/i18n'
import { commands, defaultShortcuts, eventShortcut, type Command } from '@renderer/lib/shortcuts'
import { openSearchPanel } from '@codemirror/search'
import { applyFormat } from '@renderer/components/Editor/formatCommands'
import { useConfirm } from '@renderer/store/useConfirm'

function reportFileError(error: unknown): Promise<unknown> {
  return message(String(error), { title: 'Inkwell', kind: 'error' })
}

export async function installDesktopShell(): Promise<void> {
  const win = getCurrentWindow()
  const webview = getCurrentWebview()
  const store = useAppStore.getState()
  const mac = navigator.platform.startsWith('Mac')
  let zoom = 1
  let busy = false

  const entries: { label: string; item: MenuItem | Submenu | PredefinedMenuItem }[] = []
  const bindings = new Map<Command, MenuItem>()
  const handlers = new Map<Command, () => Promise<void>>()
  const nativeAccel = (id: Command) =>
    useAppStore.getState().shortcuts[id].replace('Mod', 'CmdOrCtrl') || null
  const action = async (id: Command, callback: () => unknown) => {
    const run = async () => {
      if (busy || useConfirm.getState().open || useAppStore.getState().preferencesOpen) return
      if (id === 'Close') {
        await win.close()
        return
      }
      busy = true
      try {
        await callback()
      } catch (error) {
        await reportFileError(error)
      } finally {
        busy = false
      }
    }
    handlers.set(id, run)
    const item = await MenuItem.new({
      text: translate(id),
      accelerator: nativeAccel(id) ?? undefined,
      action: run
    })
    entries.push({ label: id, item })
    bindings.set(id, item)
    return item
  }
  const predefined = async (kind: PredefinedMenuItemOptions['item'], label?: string) => {
    const item = await PredefinedMenuItem.new({
      item: kind,
      text: label ? translate(label) : undefined
    })
    if (label) entries.push({ label, item })
    return item
  }
  const group = async (label: string, children: Promise<MenuItem | PredefinedMenuItem>[]) => {
    const item = await Submenu.new({ text: translate(label), items: await Promise.all(children) })
    entries.push({ label, item })
    return item
  }
  const edit = (run: (editor: EditorView) => unknown) => {
    const host = document.querySelector<HTMLElement>('.cm-editor')
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
  const close = () => win.close()
  const separator = () => predefined('Separator')
  const menus = await Promise.all([
    group('File', [
      action('New', newDocument),
      action('Open File…', openFileFromDialog),
      action('Open Folder…', openFolderFromDialog),
      separator(),
      action('Save', saveDoc),
      action('Save As…', saveDocAs),
      separator(),
      action('Settings', () => store.showPreferences(true)),
      action('Close', close)
    ]),
    group('Edit', [
      action('Undo', () => history(true)),
      action('Redo', () => history(false)),
      separator(),
      predefined('Cut', 'Cut'),
      predefined('Copy', 'Copy'),
      predefined('Paste', 'Paste'),
      predefined('SelectAll', 'Select all'),
      separator(),
      action('Find', () => edit(openSearchPanel)),
      separator(),
      action('Bold', () => edit((v) => applyFormat(v, 'bold'))),
      action('Italic', () => edit((v) => applyFormat(v, 'italic'))),
      action('Strikethrough', () => edit((v) => applyFormat(v, 'strike'))),
      action('Inline code', () => edit((v) => applyFormat(v, 'code'))),
      action('Link', () => edit((v) => applyFormat(v, 'link')))
    ]),
    group('View', [
      action('Sidebar', store.toggleSidebar),
      action('Outline', store.toggleOutline),
      action('Source', store.toggleSourceMode),
      action('Focus', store.toggleFocusMode),
      action('Typewriter', store.toggleTypewriter),
      separator(),
      action('Reload', async () => {
        if (await guardUnsaved()) location.reload()
      }),
      action('Actual Size', () => changeZoom(0)),
      action('Zoom In', () => changeZoom(0.1)),
      action('Zoom Out', () => changeZoom(-0.1)),
      action('Full Screen', async () => win.setFullscreen(!(await win.isFullscreen())))
    ]),
    group('Window', [predefined('Minimize', 'Minimize'), predefined('Maximize', 'Maximize')])
  ])
  if (mac)
    menus.unshift(
      await group('Inkwell', [
        predefined({ About: { name: 'Inkwell' } }, 'About Inkwell'),
        predefined('Hide', 'Hide'),
        MenuItem.new({ text: translate('Quit Inkwell'), accelerator: 'Cmd+Q', action: close }).then(
          (item) => {
            entries.push({ label: 'Quit Inkwell', item })
            return item
          }
        )
      ])
    )
  const menu = await Menu.new({ items: menus })
  await menu.setAsAppMenu()
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
      if (!event.repeat) void handlers.get(id)?.()
    },
    true
  )
  let updating = Promise.resolve()
  useAppStore.subscribe((s, p) => {
    if (s.language === p.language && s.shortcuts === p.shortcuts) return
    updating = updating
      .then(async () => {
        if (s.language !== p.language)
          await Promise.all(
            entries.map(({ item, label }) => item.setText(translate(label, s.language)))
          )
        for (const [id, item] of bindings)
          if (s.shortcuts[id] !== p.shortcuts[id]) await item.setAccelerator(nativeAccel(id))
      })
      .catch(async (error) => {
        await reportFileError(error)
      })
  })
  installAutosave((error) => {
    void reportFileError(error)
  })

  await win.onCloseRequested(async (event) => {
    if (!useAppStore.getState().doc.dirty) return
    event.preventDefault()
    if (useConfirm.getState().open || busy) return
    store.showPreferences(false)
    busy = true
    try {
      if (await guardUnsaved()) await win.destroy()
    } catch (error) {
      await reportFileError(error)
    } finally {
      busy = false
    }
  })
}
