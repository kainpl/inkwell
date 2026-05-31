import type { EditorView } from '@codemirror/view'
import { useAppStore } from '@renderer/store/useAppStore'
import { imageSrcOnLine, setImageSrc } from '@renderer/lib/formatCommands'
import { resolveImageSrc } from '@renderer/components/Editor/livePreview'

/**
 * Upload the image on the current line via the user-configured shell command
 * and replace its src with the returned URL. No-ops with a console warning when
 * no command is set, the line is not an image, or the image is already remote.
 */
export async function uploadCurrentImage(view: EditorView): Promise<void> {
  const command = useAppStore.getState().imageUploadCommand
  if (!command.trim()) {
    console.warn('Inkwell: set an image upload command in Preferences first.')
    return
  }
  const src = imageSrcOnLine(view)
  if (!src) return
  if (/^https?:/i.test(src)) return // already remote

  const docPath = useAppStore.getState().doc.path
  const filePath = resolveImageSrc(src, docPath).replace(/^file:\/\/\/?/, '')
  try {
    const url = await window.api.uploadImage(command, decodeURI(filePath))
    setImageSrc(view, url)
  } catch (err) {
    console.error('Inkwell: image upload failed:', err)
  }
}
