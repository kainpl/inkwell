import type { EditorView } from '@codemirror/view'
import { useAppStore } from '@renderer/store/useAppStore'
import { dataUrl, imageMarkdown, mimeFromName, pastedName } from './imageInput'

/**
 * Insert image bytes at `pos`: copy them into the document's `assets/` folder
 * (via the main process) and insert a relative-path image; if the document is
 * unsaved, embed the bytes as a data: URL instead. Shared by paste/drag-drop
 * (Editor/imagePaste) and Format → Image (the file picker).
 */
export async function insertImageBytes(
  view: EditorView,
  name: string,
  type: string,
  bytes: Uint8Array,
  pos: number
): Promise<void> {
  const docPath = useAppStore.getState().doc.path
  const fname = name && name !== 'image.png' ? name : pastedName(type, Date.now())
  const alt = fname.replace(/\.[^.]+$/, '')

  let src: string | null = null
  if (docPath) src = await window.api.saveImage(docPath, fname, bytes)
  if (!src) src = dataUrl(type || 'image/png', bytes)

  const md = imageMarkdown(src, alt)
  view.dispatch({ changes: { from: pos, insert: md }, selection: { anchor: pos + md.length } })
  view.focus()
}

/**
 * Format → Image: open a native file picker, then insert the chosen image at the
 * caret (copied into assets/, or embedded as data: for an unsaved document).
 * No-ops if the user cancels the dialog.
 */
export async function insertLocalImage(view: EditorView): Promise<void> {
  const picked = await window.api.pickImage()
  if (!picked) return
  const pos = view.state.selection.main.head
  await insertImageBytes(view, picked.name, mimeFromName(picked.name), picked.data, pos)
}
