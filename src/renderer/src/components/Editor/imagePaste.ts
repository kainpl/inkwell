import { EditorView } from '@codemirror/view'
import { useAppStore } from '@renderer/store/useAppStore'
import { dataUrl, imageMarkdown, pastedName } from '@renderer/lib/imageInput'

/**
 * Insert an image File at `pos`: copy it into the document's `assets/` folder
 * (via the main process) and insert a relative-path image; if the document is
 * unsaved, embed the bytes as a data: URL instead.
 */
async function insertImageFile(view: EditorView, file: File, pos: number): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const docPath = useAppStore.getState().doc.path
  const name = file.name && file.name !== 'image.png' ? file.name : pastedName(file.type, Date.now())
  const alt = name.replace(/\.[^.]+$/, '')

  let src: string | null = null
  if (docPath) src = await window.api.saveImage(docPath, name, bytes)
  if (!src) src = dataUrl(file.type || 'image/png', bytes)

  const md = imageMarkdown(src, alt)
  view.dispatch({ changes: { from: pos, insert: md }, selection: { anchor: pos + md.length } })
  view.focus()
}

/** Image files from a clipboard's DataTransferItemList. */
function imagesFromItems(items: DataTransferItemList | undefined): File[] {
  if (!items) return []
  const out: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) out.push(f)
    }
  }
  return out
}

/** Image files from a drag-and-drop FileList. */
function imagesFromFiles(files: FileList | undefined): File[] {
  if (!files) return []
  return Array.from(files).filter((f) => f.type.startsWith('image/'))
}

/** Paste / drag-and-drop image handling for the editor. */
export const imagePaste = EditorView.domEventHandlers({
  paste(event, view) {
    const files = imagesFromItems(event.clipboardData?.items)
    if (!files.length) return false
    event.preventDefault()
    void insertImageFile(view, files[0], view.state.selection.main.head)
    return true
  },
  drop(event, view) {
    const files = imagesFromFiles(event.dataTransfer?.files)
    if (!files.length) return false
    event.preventDefault()
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos != null) view.dispatch({ selection: { anchor: pos } })
    // Insert sequentially at the caret; each insert advances the selection.
    void files.reduce(
      (p, f) => p.then(() => insertImageFile(view, f, view.state.selection.main.head)),
      Promise.resolve()
    )
    return true
  }
})
