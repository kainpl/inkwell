import { create } from 'zustand'

/**
 * Imperative text-input prompt (Electron disables window.prompt). `ask()` opens
 * the modal and resolves with the entered string, or null if cancelled.
 */
interface PromptState {
  open: boolean
  title: string
  value: string
  _resolve: ((value: string | null) => void) | null
  ask: (title: string, initial?: string) => Promise<string | null>
  setValue: (value: string) => void
  submit: () => void
  cancel: () => void
}

export const usePrompt = create<PromptState>((set, get) => ({
  open: false,
  title: '',
  value: '',
  _resolve: null,
  ask: (title, initial = '') =>
    new Promise<string | null>((resolve) => {
      set({ open: true, title, value: initial, _resolve: resolve })
    }),
  setValue: (value) => set({ value }),
  submit: () => {
    const { _resolve, value } = get()
    set({ open: false, _resolve: null })
    _resolve?.(value.trim() === '' ? null : value.trim())
  },
  cancel: () => {
    const { _resolve } = get()
    set({ open: false, _resolve: null })
    _resolve?.(null)
  }
}))
