import { useAppStore } from '@renderer/store/useAppStore'
import { useEditor } from '@renderer/store/useEditor'
import { renderPlainText } from './exportRender'

/**
 * Text-to-speech via the Web Speech API (built into Electron — no deps). Speaks
 * the selection if there is one, otherwise the whole document, with Markdown
 * markers stripped for natural speech.
 */

/** Pick and clean the text to speak (pure — unit tested). */
export function speechText(selection: string, docContent: string): string {
  return renderPlainText(selection.trim() ? selection : docContent)
}

export function startSpeaking(): void {
  if (typeof speechSynthesis === 'undefined') return
  const view = useEditor.getState().view
  const sel = view
    ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
    : ''
  const text = speechText(sel, useAppStore.getState().doc.content)
  if (!text.trim()) return
  speechSynthesis.cancel()
  speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export function stopSpeaking(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
