import { create } from 'zustand'
import { t } from '@renderer/lib/i18n'

export type ConfirmChoice = 'save' | 'discard' | 'cancel'

/** Text shown by the confirm dialog; defaults suit the unsaved-changes guard. */
export interface ConfirmText {
  title: string
  message: string
  /** Label for the 'save' choice. */
  confirmLabel: string
  /** Label for the 'discard' choice. */
  discardLabel: string
}

/** English fallback used if i18n isn't available; live defaults come from `t()`. */
export const DEFAULT_CONFIRM_TEXT: ConfirmText = {
  title: 'Unsaved changes',
  message:
    'Do you want to save the changes you made? Your changes will be lost if you don’t save them.',
  confirmLabel: 'Save',
  discardLabel: 'Don’t Save'
}

/** The unsaved-changes wording, translated into the active locale (computed at ask time). */
function localizedDefaults(): ConfirmText {
  return {
    title: t('confirm.unsavedTitle'),
    message: t('confirm.unsavedMessage'),
    confirmLabel: t('confirm.save'),
    discardLabel: t('confirm.dontSave')
  }
}

interface ConfirmState {
  open: boolean
  text: ConfirmText
  _resolve: ((choice: ConfirmChoice) => void) | null
  /** Open the dialog; pass partial text to override the unsaved-changes wording. */
  ask: (text?: Partial<ConfirmText>) => Promise<ConfirmChoice>
  answer: (choice: ConfirmChoice) => void
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  open: false,
  text: DEFAULT_CONFIRM_TEXT,
  _resolve: null,
  ask: (text) =>
    new Promise<ConfirmChoice>((resolve) => {
      set({ open: true, text: { ...localizedDefaults(), ...text }, _resolve: resolve })
    }),
  answer: (choice) => {
    const resolve = get()._resolve
    set({ open: false, _resolve: null })
    resolve?.(choice)
  }
}))
