import { useCallback, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { inkwellExtensions } from './markdownExtensions'
import { refreshPreview } from './livePreview'
import { setSourceMode, setTypewriter } from './editorModes'
import { useAppStore } from '@renderer/store/useAppStore'
import { useEditor } from '@renderer/store/useEditor'
import { getCaret, setCaret } from '@renderer/lib/persistence'

/** OutlinePanel dispatches this to jump the caret to a heading. */
export const GOTO_EVENT = 'ink:goto'

export default function Editor(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Per-tab editor state (content + undo history + selection), keyed by tab id.
  const statesRef = useRef<Map<string, EditorState>>(new Map())
  // Per-tab scroll: the top visible document position. Scroll lives on the DOM,
  // not in EditorState, so it's captured/restored separately — restoring that
  // position to the top of the viewport puts the reader back where they were.
  const scrollsRef = useRef<Map<string, number>>(new Map())
  const prevActiveRef = useRef<string>('')
  // The last value we pushed *into* the editor, to avoid echo loops.
  const lastPushed = useRef<string>('')
  // Set while we swap tab states so the content sync doesn't fire spuriously.
  const suppress = useRef<boolean>(false)

  const focusMode = useAppStore((s) => s.focusMode)
  const activeId = useAppStore((s) => s.activeId)
  const selVersion = useEditor((s) => s.selVersion)

  // Jump to the caret remembered for the active file (after a fresh content load).
  const restoreCaret = useCallback((view: EditorView): void => {
    const path = useAppStore.getState().doc.path
    if (!path) return
    const off = getCaret(path)
    if (off == null) return
    const pos = Math.min(off, view.state.doc.length)
    view.dispatch({ selection: { anchor: pos } })
    try {
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
    } catch {
      /* no layout (headless) — selection set, skip the scroll */
    }
  }, [])

  // Build a fresh EditorState for `content` with the full extension stack. Stable
  // (reads the store via getState) so the mount/swap effects don't re-run.
  const makeState = useCallback(
    (content: string): EditorState =>
      EditorState.create({
        doc: content,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          ...inkwellExtensions((value) => {
            if (suppress.current) return
            lastPushed.current = value
            useAppStore.getState().setContent(value)
          }),
          // Notify the editor store of selection/doc changes (drives toolbars).
          EditorView.updateListener.of((u) => {
            if (u.selectionSet || u.docChanged) useEditor.getState().bump()
          })
        ]
      }),
    []
  )

  // Mount once.
  useEffect(() => {
    if (!hostRef.current) return

    const state = makeState(useAppStore.getState().doc.content)
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    statesRef.current.set(useAppStore.getState().activeId, view.state)
    prevActiveRef.current = useAppStore.getState().activeId
    lastPushed.current = state.doc.toString()
    useEditor.getState().setView(view)
    view.focus()

    // Push external content changes into the ACTIVE tab (file reload / draft
    // recovery / welcome / in-place open). Tab switches go through the activeId
    // effect below, so skip when the active tab changed.
    const unsub = useAppStore.subscribe((s) => {
      if (suppress.current || s.activeId !== prevActiveRef.current) return
      const next = s.doc.content
      if (next !== lastPushed.current && next !== view.state.doc.toString()) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
        lastPushed.current = next
        restoreCaret(view) // file (re)loaded in place → restore its remembered caret
      }
    })

    return () => {
      unsub()
      useEditor.getState().setView(null)
      view.destroy()
      viewRef.current = null
    }
  }, [makeState, restoreCaret])

  // Re-render the live preview when the Markdown feature flags change (the
  // StateField recomputes on a refresh effect, no doc edit needed).
  useEffect(() => {
    let last = useAppStore.getState().markdownFeatures
    return useAppStore.subscribe(() => {
      const cur = useAppStore.getState().markdownFeatures
      if (cur === last) return
      last = cur
      viewRef.current?.dispatch({ effects: refreshPreview.of(null) })
    })
  }, [])

  // Switch tabs: stash the outgoing tab's full state, restore (or build) the
  // incoming one, then re-apply the global view modes.
  useEffect(() => {
    const view = viewRef.current
    if (!view || prevActiveRef.current === activeId) return

    // Save the outgoing tab's full state + scroll position (top visible doc pos).
    // posAtCoords needs layout, so guard it (a no-op without a real viewport).
    statesRef.current.set(prevActiveRef.current, view.state)
    try {
      const rect = view.scrollDOM.getBoundingClientRect()
      const top = view.posAtCoords({ x: rect.left + 4, y: rect.top + 4 })
      if (top != null) scrollsRef.current.set(prevActiveRef.current, top)
    } catch {
      /* no layout (headless) — skip scroll capture */
    }

    suppress.current = true
    const saved = statesRef.current.get(activeId)
    view.setState(saved ?? makeState(useAppStore.getState().doc.content))
    const s = useAppStore.getState()
    setSourceMode(view, s.sourceMode)
    setTypewriter(view, s.typewriterMode)
    prevActiveRef.current = activeId
    lastPushed.current = view.state.doc.toString()
    suppress.current = false
    view.focus()

    if (saved) {
      // Returning to an open tab — restore its in-memory scroll position.
      const savedTop = scrollsRef.current.get(activeId)
      if (savedTop != null && savedTop <= view.state.doc.length) {
        view.dispatch({ effects: EditorView.scrollIntoView(savedTop, { y: 'start' }) })
      }
    } else {
      // Freshly opened tab — jump to the remembered caret for this file.
      restoreCaret(view)
    }
  }, [activeId, makeState, restoreCaret])

  // Reconfigure Source Code / Typewriter modes when their store flags change.
  useEffect(() => {
    let lastSource = useAppStore.getState().sourceMode
    let lastTypewriter = useAppStore.getState().typewriterMode
    const unsub = useAppStore.subscribe((s) => {
      const view = viewRef.current
      if (!view) return
      if (s.sourceMode !== lastSource) {
        lastSource = s.sourceMode
        setSourceMode(view, lastSource)
      }
      if (s.typewriterMode !== lastTypewriter) {
        lastTypewriter = s.typewriterMode
        setTypewriter(view, lastTypewriter)
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

  // Remember the caret position per file (debounced) for restore on reopen.
  useEffect(() => {
    const view = viewRef.current
    const path = useAppStore.getState().doc.path
    if (!view || !path) return
    const head = view.state.selection.main.head
    const t = setTimeout(() => setCaret(path, head), 400)
    return () => clearTimeout(t)
  }, [selVersion])

  return (
    <div
      ref={hostRef}
      className={
        'h-full w-full overflow-hidden transition-opacity ' + (focusMode ? 'ink-focus' : '')
      }
    />
  )
}
