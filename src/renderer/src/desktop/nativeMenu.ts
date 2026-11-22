import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
  type PredefinedMenuItemOptions
} from '@tauri-apps/api/menu'
import { useAppStore } from '@renderer/store/useAppStore'
import { translate } from '@renderer/lib/i18n'
import type { Command } from '@renderer/lib/shortcuts'
import { recentLabels, useRecents, type RecentKind } from '@renderer/lib/recents'
import { menuGroups, systemItems, type MenuEntry, type DesktopActions } from './menu'

export async function installNativeMenu(
  actions: DesktopActions,
  onError: (error: unknown) => Promise<unknown>
) {
  const mac = navigator.platform.startsWith('Mac')
  const entries: { label: string; item: MenuItem | Submenu | PredefinedMenuItem }[] = []
  const bindings = new Map<Command, MenuItem>()
  const nativeAccel = (id: Command) =>
    useAppStore.getState().shortcuts[id].replace('Mod', 'CmdOrCtrl') || null
  const action = async (id: Command) => {
    const item = await MenuItem.new({
      text: translate(id),
      accelerator: nativeAccel(id) ?? undefined,
      action: () => actions.run(id)
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
  const group = async (
    label: string,
    children: Promise<MenuItem | PredefinedMenuItem | Submenu>[]
  ) => {
    const item = await Submenu.new({ text: translate(label), items: await Promise.all(children) })
    entries.push({ label, item })
    return item
  }
  const recentMenu = async (kind: RecentKind) => {
    const submenu = await group(recentLabels[kind], [])
    const rows: { path: string; item: MenuItem }[] = []
    let updating = Promise.resolve()
    async function render(paths: string[]) {
      while (rows.length > paths.length) {
        const row = rows[rows.length - 1]
        await submenu.remove(row.item)
        rows.pop()
        await row.item.close()
      }
      for (const [i, path] of paths.entries()) {
        const text = mac ? path : path.replaceAll('&', '&&')
        const row = rows[i]
        if (!row) {
          const item = await MenuItem.new({
            text,
            action: () => actions.recent(kind, rows[i].path)
          })
          await submenu.append(item)
          rows.push({ path, item })
        } else if (row.path !== path) {
          await row.item.setText(text)
          row.path = path
        }
      }
      await submenu.setEnabled(paths.length > 0)
    }
    await render(useRecents.getState()[kind].paths)
    useRecents.subscribe((next, prev) => {
      const paths = next[kind].paths
      if (
        paths.length === prev[kind].paths.length &&
        paths.every((p, i) => p === prev[kind].paths[i])
      )
        return
      updating = updating
        .then(() => render(paths))
        .catch(async (error) => {
          await onError(error)
        })
    })
    return submenu
  }
  function item(entry: MenuEntry) {
    if (entry === '-') return predefined('Separator')
    if (entry === 'files' || entry === 'folders') return recentMenu(entry)
    if (entry in systemItems)
      return predefined(systemItems[entry as keyof typeof systemItems], entry)
    return action(entry as Command)
  }
  const menus = await Promise.all(
    Object.entries(menuGroups).map(([label, items]) => group(label, items.map(item)))
  )
  if (mac)
    menus.unshift(
      await group('Inkwell', [
        predefined({ About: { name: 'Inkwell' } }, 'About Inkwell'),
        predefined('Hide', 'Hide'),
        MenuItem.new({
          text: translate('Quit Inkwell'),
          accelerator: 'Cmd+Q',
          action: () => actions.run('Close')
        }).then((item) => {
          entries.push({ label: 'Quit Inkwell', item })
          return item
        })
      ])
    )
  const menu = await Menu.new({ items: menus })
  await menu.setAsAppMenu()
  let updating = Promise.resolve()
  useAppStore.subscribe((next, prev) => {
    if (next.language === prev.language && next.shortcuts === prev.shortcuts) return
    updating = updating
      .then(async () => {
        if (next.language !== prev.language) {
          await Promise.all(
            entries.map(({ item, label }) => item.setText(translate(label, next.language)))
          )
        }
        for (const [id, item] of bindings) {
          if (next.shortcuts[id] !== prev.shortcuts[id]) await item.setAccelerator(nativeAccel(id))
        }
      })
      .catch(async (error) => {
        await onError(error)
      })
  })
}
