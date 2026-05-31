import type { DraftEntry } from '@shared/ipc'

/**
 * Crash-recovery drafts: while a document is dirty we periodically snapshot it
 * to a drafts folder (in the main process). On launch we offer to recover any
 * draft whose content differs from what's on disk.
 */

/** Stable draft id for a document path (or a fixed id for the unsaved doc). */
export function draftId(docPath: string | null): string {
  if (!docPath) return 'untitled'
  // Hash the path into a filesystem-safe, collision-resistant id.
  let h = 0
  for (let i = 0; i < docPath.length; i++) {
    h = (Math.imul(31, h) + docPath.charCodeAt(i)) | 0
  }
  const base = docPath.replace(/[^a-zA-Z0-9]+/g, '-').slice(-40).replace(/^-+/, '')
  return `${base}-${(h >>> 0).toString(36)}`
}

/**
 * Whether a draft is worth offering for recovery: it must have content, and
 * that content must differ from what is currently on disk (`diskContent` is
 * null when the file is gone or was unsaved/untitled).
 */
export function isRecoverable(draft: DraftEntry, diskContent: string | null): boolean {
  if (draft.content.trim() === '') return false
  return draft.content !== (diskContent ?? '')
}

/** The most recently saved draft from a list, or null if empty. */
export function newestDraft(drafts: DraftEntry[]): DraftEntry | null {
  if (drafts.length === 0) return null
  return drafts.reduce((newest, d) => (d.savedAt > newest.savedAt ? d : newest))
}
