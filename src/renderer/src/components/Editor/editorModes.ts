import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { Compartment, type Extension } from '@codemirror/state'
import { livePreview, openLinksOnClick } from './livePreview'

/**
 * Editor view modes that can be reconfigured at runtime via compartments.
 *
 * - Source Code Mode: drops the live-preview decoration layer so the whole
 *   document shows raw Markdown (still syntax-highlighted by inkHighlight).
 * - Typewriter Mode: keeps the active line vertically centered while typing.
 */

/** Compartment toggling the live-preview layer (empty = Source Code Mode). */
export const previewCompartment = new Compartment()

/** Extensions enabled when live preview is ON (the default WYSIWYG mode). */
export const previewExtensions: Extension = [livePreview, openLinksOnClick]

/**
 * Typewriter mode: on each selection/doc change, scroll so the caret line sits
 * in the vertical middle of the viewport.
 */
const typewriterPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet) {
        const head = update.state.selection.main.head
        update.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) })
      }
    }
  }
)

/** Compartment toggling typewriter mode (empty = off). */
export const typewriterCompartment = new Compartment()
export const typewriterExtension: Extension = typewriterPlugin

/** Reconfigure live preview on/off. */
export function setSourceMode(view: EditorView, sourceMode: boolean): void {
  view.dispatch({
    effects: previewCompartment.reconfigure(sourceMode ? [] : previewExtensions)
  })
}

/** Reconfigure typewriter mode on/off. */
export function setTypewriter(view: EditorView, on: boolean): void {
  view.dispatch({
    effects: typewriterCompartment.reconfigure(on ? typewriterExtension : [])
  })
}
