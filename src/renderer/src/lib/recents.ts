import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'

export type RecentKind = 'files' | 'folders'
type History = Record<RecentKind, { paths: string[]; limit: number }>
export type HistoryChange =
  | { type: 'visit' | 'remove'; kind: RecentKind; path: string }
  | { type: 'clear'; kind: RecentKind }
  | { type: 'limit'; kind: RecentKind; limit: number }

export const recentLabels = { files: 'Recent Files', folders: 'Recent Folders' }
export const useRecents = create<History>(() => ({
  files: { paths: [], limit: 10 },
  folders: { paths: [], limit: 10 }
}))

let pending = Promise.resolve()
export function updateRecents(change?: HistoryChange): Promise<void> {
  const update = pending.then(async () => {
    const history = await invoke<History>('recent_history', { change: change ?? null })
    useRecents.setState(history)
  })
  pending = update.catch(() => {})
  return update
}
