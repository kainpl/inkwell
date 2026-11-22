import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { translate } from '@renderer/lib/i18n'
import { applyFormat, type FormatAction } from './formatCommands'

/** Inline actions offered on a text selection (the floating toolbar). */
const BUTTONS: { action: FormatAction; label: string; title: string; cls?: string }[] = [
  { action: 'bold', label: 'B', title: 'Bold', cls: 'font-bold' },
  { action: 'italic', label: 'I', title: 'Italic', cls: 'italic' },
  { action: 'strike', label: 'S', title: 'Strikethrough', cls: 'line-through' },
  { action: 'code', label: '</>', title: 'Inline code' },
  { action: 'link', label: '🔗', title: 'Link' },
]

/**
 * A Medium/Notion-style toolbar that floats above the current text selection in
 * the markdown editor and applies inline formatting to it. Pure DOM (no React) so
 * it ships with the editor wherever it mounts. Hidden when the selection is empty,
 * the editor is read-only, or it loses focus.
 */
class FloatingToolbar {
  readonly dom: HTMLElement
  private rafId: number | null = null
  private readonly onScroll = (): void => this.reposition()

  constructor(private readonly view: EditorView) {
    this.dom = document.createElement('div')
    this.dom.className = 'cm-floating-toolbar'
    this.dom.style.display = 'none'
    for (const b of BUTTONS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = b.label
      btn.title = translate(b.title)
      btn.className = `cm-floating-btn ${b.cls ?? ''}`.trim()
      // Keep the editor's selection alive when the button is pressed.
      btn.addEventListener('mousedown', (e) => e.preventDefault())
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        applyFormat(view, b.action)
        this.reposition()
      })
      this.dom.appendChild(btn)
    }
    document.body.appendChild(this.dom)
    view.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true })
  }

  /** Defer the layout read out of CodeMirror's update cycle — `coordsAtPos`
   *  reads the editor layout, which CM forbids during an update. */
  reposition(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.place()
    })
  }

  private place(): void {
    const sel = this.view.state.selection.main
    if (sel.empty || !this.view.hasFocus || this.view.state.readOnly) {
      this.dom.style.display = 'none'
      return
    }
    const from = this.view.coordsAtPos(sel.from)
    if (!from) {
      this.dom.style.display = 'none'
      return
    }
    this.dom.style.display = 'flex'
    const rect = this.dom.getBoundingClientRect()
    const left = Math.max(4, Math.min(window.innerWidth - rect.width - 4, from.left - rect.width / 2))
    const top = Math.max(4, from.top - rect.height - 6)
    this.dom.style.left = `${left}px`
    this.dom.style.top = `${top}px`
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.view.scrollDOM.removeEventListener('scroll', this.onScroll)
    this.dom.remove()
  }
}

/** Editor extension: a floating formatting toolbar over the active selection. */
export const floatingToolbar = ViewPlugin.fromClass(
  class {
    private readonly tb: FloatingToolbar
    constructor(view: EditorView) {
      this.tb = new FloatingToolbar(view)
    }
    update(u: ViewUpdate): void {
      if (u.selectionSet || u.docChanged || u.focusChanged || u.geometryChanged) {
        this.tb.reposition()
      }
    }
    destroy(): void {
      this.tb.destroy()
    }
  },
)
