import { create } from 'zustand'
import type { EditorView } from '@codemirror/view'

/**
 * Holds the live CodeMirror EditorView so React chrome (toolbars, menus) can
 * run formatting commands against it. `selVersion` bumps on every selection or
 * doc change to drive the floating toolbar's position/visibility.
 */
interface EditorStore {
  view: EditorView | null
  selVersion: number
  setView: (view: EditorView | null) => void
  bump: () => void
}

export const useEditor = create<EditorStore>((set) => ({
  view: null,
  selVersion: 0,
  setView: (view) => set({ view }),
  bump: () => set((s) => ({ selVersion: s.selVersion + 1 }))
}))
