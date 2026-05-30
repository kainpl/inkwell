import { create } from 'zustand'

export type ConfirmChoice = 'save' | 'discard' | 'cancel'

/**
 * Imperative, promise-based confirm dialog state. `ask()` opens the modal and
 * resolves once the user picks an option; the `ConfirmUnsavedModal` component
 * renders it and calls `answer()`. Lets non-component code (docActions, the
 * window-close handler) await a user decision.
 */
interface ConfirmState {
  open: boolean
  _resolve: ((choice: ConfirmChoice) => void) | null
  ask: () => Promise<ConfirmChoice>
  answer: (choice: ConfirmChoice) => void
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  open: false,
  _resolve: null,
  ask: () =>
    new Promise<ConfirmChoice>((resolve) => {
      set({ open: true, _resolve: resolve })
    }),
  answer: (choice) => {
    const resolve = get()._resolve
    set({ open: false, _resolve: null })
    resolve?.(choice)
  }
}))
