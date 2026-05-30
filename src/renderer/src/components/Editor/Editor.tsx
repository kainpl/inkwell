import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { inkwellExtensions } from './markdownExtensions'
import { useAppStore } from '@renderer/store/useAppStore'

/** OutlinePanel dispatches this to jump the caret to a heading. */
export const GOTO_EVENT = 'ink:goto'

export default function Editor(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // The last value we pushed *into* the editor, to avoid echo loops.
  const lastPushed = useRef<string>('')

  const setContent = useAppStore((s) => s.setContent)
  const focusMode = useAppStore((s) => s.focusMode)

  // Mount once.
  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: useAppStore.getState().doc.content,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        ...inkwellExtensions((value) => {
          lastPushed.current = value
          setContent(value)
        })
      ]
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    lastPushed.current = state.doc.toString()
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [setContent])

  // Push external content changes (file open / new doc) into the editor.
  useEffect(() => {
    const unsub = useAppStore.subscribe((s) => {
      const view = viewRef.current
      if (!view) return
      const next = s.doc.content
      if (next !== lastPushed.current && next !== view.state.doc.toString()) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next }
        })
        lastPushed.current = next
      }
    })
    return unsub
  }, [])

  // Jump-to-offset from the outline panel.
  useEffect(() => {
    const handler = (e: Event): void => {
      const view = viewRef.current
      if (!view) return
      const offset = (e as CustomEvent<number>).detail
      view.dispatch({
        selection: { anchor: offset },
        effects: EditorView.scrollIntoView(offset, { y: 'start' })
      })
      view.focus()
    }
    window.addEventListener(GOTO_EVENT, handler)
    return () => window.removeEventListener(GOTO_EVENT, handler)
  }, [])

  return (
    <div
      ref={hostRef}
      className={
        'h-full w-full overflow-hidden transition-opacity ' +
        (focusMode ? 'ink-focus' : '')
      }
    />
  )
}
