import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { diskReload } from './reload'
export const typewriterPlugin = ViewPlugin.fromClass(
  class {
    private raf: number | null = null
    update(update: ViewUpdate): void {
      if (!update.docChanged && !update.selectionSet) return
      // Dispatching the scroll inside update() is forbidden (nested update) — defer
      // it to the next frame, deduped, reading the caret fresh at that point.
      const view = update.view
      if (this.raf !== null) cancelAnimationFrame(this.raf)
      this.raf = null
      if (update.transactions.some((tr) => tr.annotation(diskReload))) return
      this.raf = requestAnimationFrame(() => {
        this.raf = null
        view.dispatch({
          effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' })
        })
      })
    }
    destroy(): void {
      if (this.raf !== null) cancelAnimationFrame(this.raf)
    }
  }
)
