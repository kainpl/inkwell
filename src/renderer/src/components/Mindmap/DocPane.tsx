import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import { resolveAnchor } from '@renderer/lib/mindmap/anchors'
import { setDocView } from '@renderer/lib/mindmap/docView'

/** Editable CodeMirror pane for the selected node's attached doc. Edits are
 *  buffered in the store (`dirtyDocs`) and flushed into the bundle on project Save.
 *  External refs stay read-only (D7 — opened only via a future file-picker grant). */
export default function DocPane(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const openDoc = project?.openDoc ?? null
  const workingDir = project?.workingDir ?? null
  const external = openDoc?.ref.external === true
  const path = openDoc?.ref.path ?? null
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!openDoc || !workingDir || external || !path) return
    let cancelled = false
    const buffered = useProjectStore.getState().byTab[activeId]?.dirtyDocs[path]
    const load =
      buffered != null ? Promise.resolve(buffered) : window.api.inkproj.readDoc(workingDir, openDoc.ref)
    void load
      .then((text) => {
        if (cancelled || !hostRef.current) return
        setError(null)
        viewRef.current?.destroy()
        const view = new EditorView({
          parent: hostRef.current,
          state: EditorState.create({
            doc: text,
            extensions: [
              lineNumbers(),
              history(),
              keymap.of([...defaultKeymap, ...historyKeymap]),
              markdown(),
              EditorView.lineWrapping,
              EditorView.updateListener.of((u) => {
                if (u.docChanged) useProjectStore.getState().setDocBuffer(path, u.state.doc.toString())
              })
            ]
          })
        })
        viewRef.current = view
        setDocView(view)
        const anchor = openDoc.ref.anchor
        if (!anchor) return
        const pos = resolveAnchor(text, anchor)
        if (!pos) return
        const line = view.state.doc.line(Math.min(pos.line + 1, view.state.doc.lines))
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start' })
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [openDoc, workingDir, external, path, activeId])

  useEffect(
    () => () => {
      setDocView(null)
      viewRef.current?.destroy()
    },
    []
  )

  if (!openDoc) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-faint">
        Select a node with a document to read it here.
      </div>
    )
  }
  if (external) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-faint">
        External document — read-only.
      </div>
    )
  }
  return (
    <div className="relative h-full">
      {error ? (
        <div className="absolute inset-x-0 top-0 z-10 bg-paper p-2 text-[12px] text-[#d35454]">
          Couldn’t open the document: {error}
        </div>
      ) : null}
      <div ref={hostRef} className="h-full overflow-auto text-sm" />
    </div>
  )
}
