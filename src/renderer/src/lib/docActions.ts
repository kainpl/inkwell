import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'
import type { RecentKind } from './recents'

// Serialize writes so a slower old save cannot overwrite a newer one.
let pending: Promise<unknown> = Promise.resolve()
let refreshing: Promise<void> = Promise.resolve()

function enqueueSave(id: number, as: boolean, automatic = false): Promise<boolean> {
  const run = async () => {
    const state = useAppStore.getState()
    const tab = state.tabs.find((entry) => entry.id === id)
    if (!tab) return false
    const { doc, documentEol, diskContent } = tab
    if (
      automatic &&
      (!state.autoSave ||
        !doc.path ||
        !doc.dirty ||
        tab.externalChange ||
        useConfirm.getState().open)
    )
      return false
    const text =
      state.finalNewline && !/[\r\n]$/.test(doc.content) ? doc.content + documentEol : doc.content
    let path = doc.path
    let name = doc.name
    if (as || !path) {
      const result = await window.api.saveFileAs(text, name, id)
      if (!result) return false
      path = result.path
      name = result.name
    } else {
      const latest = await window.api.readDocumentText(path)
      const current = useAppStore.getState().tabs.find((entry) => entry.id === id)
      if (!current || current.doc.path !== path) return false
      if (latest !== diskContent) {
        state.receiveDiskContent(latest, false, id)
        return !useAppStore.getState().tabs.find((entry) => entry.id === id)?.doc.dirty
      }
      if (!(await window.api.saveFile(path, text))) return false
    }
    state.markSaved(id, doc.content, text, path, name)
    const saved = useAppStore.getState().tabs.find((entry) => entry.id === id)
    return !!saved && !saved.doc.dirty
  }
  const result = pending.then(run)
  pending = result.catch(() => false)
  return result
}
export const saveDoc = (id = useAppStore.getState().documentId) => enqueueSave(id, false)
export const saveDocAs = () => enqueueSave(useAppStore.getState().documentId, true)

function refreshFromDisk(id: number, discardEdits: boolean, active = () => true): Promise<void> {
  const tab = useAppStore.getState().tabs.find((entry) => entry.id === id)
  const path = tab?.doc.path
  const result = refreshing.then(async () => {
    const writes = pending
    await writes
    const currentTab = () => {
      if (!active() || writes !== pending) return
      const current = useAppStore.getState().tabs.find((entry) => entry.id === id)
      if (current?.doc.path === path) return current
    }
    if (!path || !currentTab()) return
    const content = await window.api.readDocumentText(path)
    const current = currentTab()
    if (current && (!discardEdits || current.doc.content === tab?.doc.content)) {
      useAppStore.getState().receiveDiskContent(content, discardEdits, id)
    }
  })
  refreshing = result.catch(() => {})
  return result
}

export const reloadFromDisk = () => refreshFromDisk(useAppStore.getState().documentId, true)

export function installFileRefresh(): () => void {
  let active = true
  let reading = false
  let background = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const refresh = async () => {
    if (!active || reading) return
    clearTimeout(timer)
    reading = true
    try {
      const { tabs, documentId } = useAppStore.getState()
      const rest = tabs.filter((tab) => tab.id !== documentId && tab.doc.path)
      const ids = [documentId]
      if (rest.length) ids.push(rest[background++ % rest.length].id)
      for (const id of ids) {
        try {
          await refreshFromDisk(id, false, () => active)
        } catch {
          // The file may temporarily disappear during an atomic replacement.
        }
      }
    } finally {
      reading = false
      if (active && useAppStore.getState().tabs.some((tab) => tab.doc.path))
        timer = setTimeout(refresh, 1000)
    }
  }
  const unsubscribe = useAppStore.subscribe((next, prev) => {
    if (
      next.documentId !== prev.documentId ||
      activeTab(next).doc.path !== activeTab(prev).doc.path
    )
      void refresh()
  })
  window.addEventListener('focus', refresh)
  void refresh()
  return () => {
    active = false
    clearTimeout(timer)
    unsubscribe()
    window.removeEventListener('focus', refresh)
  }
}

export function installAutosave(onError: (error: unknown) => void): () => void {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  const cancel = (id: number) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
  }
  const schedule = (state: ReturnType<typeof useAppStore.getState>, previous?: typeof state) => {
    for (const id of timers.keys()) if (!state.tabs.some((tab) => tab.id === id)) cancel(id)
    for (const tab of state.tabs) {
      if (state.autoSave === previous?.autoSave && previous.tabs.includes(tab)) continue
      cancel(tab.id)
      if (
        state.autoSave &&
        tab.doc.path &&
        tab.doc.dirty &&
        !tab.externalChange &&
        !useConfirm.getState().open
      ) {
        timers.set(
          tab.id,
          setTimeout(() => {
            timers.delete(tab.id)
            void enqueueSave(tab.id, false, true).catch(onError)
          }, 900)
        )
      }
    }
  }
  const unsubscribe = useAppStore.subscribe((state, previous) => {
    if (state.tabs !== previous.tabs || state.autoSave !== previous.autoSave)
      schedule(state, previous)
  })
  schedule(useAppStore.getState())
  const unconfirm = useConfirm.subscribe((s) => {
    if (s.open) for (const id of timers.keys()) cancel(id)
    else schedule(useAppStore.getState())
  })
  return () => {
    for (const id of timers.keys()) cancel(id)
    unsubscribe()
    unconfirm()
  }
}

export async function guardUnsaved(id = useAppStore.getState().documentId): Promise<boolean> {
  await pending
  if (useConfirm.getState().open) return false
  const state = useAppStore.getState()
  if (!state.tabs.find((tab) => tab.id === id)?.doc.dirty) return true
  state.activateTab(id)
  const choice = await useConfirm.getState().ask()
  if (choice === 'save') return saveDoc(id)
  return choice === 'discard'
}

export async function closeTab(id = useAppStore.getState().documentId): Promise<void> {
  if (useConfirm.getState().open) return
  const { documentId, activateTab, removeTab } = useAppStore.getState()
  try {
    if (!(await guardUnsaved(id))) return
    if (id !== documentId && useAppStore.getState().documentId === id) activateTab(documentId)
    removeTab(id)
  } finally {
    if (id !== documentId && useAppStore.getState().documentId === id) activateTab(documentId)
  }
}

export async function guardAllUnsaved(): Promise<boolean> {
  await pending
  const { tabs, documentId, activateTab } = useAppStore.getState()
  for (const tab of tabs) {
    if (!(await guardUnsaved(tab.id))) {
      activateTab(documentId)
      return false
    }
  }
  return true
}

export function newDocument(): void {
  useAppStore.getState().newDoc()
}

export async function openFileFromDialog(): Promise<void> {
  const file = await window.api.openFileDialog()
  if (file) useAppStore.getState().loadDoc(file)
}

/** Opening a folder only changes the sidebar tree, so it needs no guard. */
export async function openFolderFromDialog(): Promise<void> {
  const node = await window.api.openFolderDialog()
  if (node) useAppStore.getState().setRoot(node)
}

export async function openPath(path: string, recent = false): Promise<number> {
  const state = useAppStore.getState()
  const existing = state.tabs.find((tab) => tab.doc.path === path)
  if (existing) {
    state.activateTab(existing.id)
    return existing.id
  }
  if (recent) await window.api.restoreRecentAccess('files', path)
  const file = await window.api.readFile(path)
  return useAppStore.getState().loadDoc(file)
}

export async function openRecent(kind: RecentKind, path: string): Promise<void> {
  if (kind === 'files') {
    await openPath(path, true)
    return
  }
  await window.api.restoreRecentAccess(kind, path)
  useAppStore.getState().setRoot(await window.api.readFolder(path))
}
