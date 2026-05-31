import { EditorView } from '@codemirror/view'
import { insertImageBytes } from '@renderer/lib/imageInsert'

/** Insert an image File (from paste / drag-drop) at `pos`. */
async function insertImageFile(view: EditorView, file: File, pos: number): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  await insertImageBytes(view, file.name, file.type, bytes, pos)
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
