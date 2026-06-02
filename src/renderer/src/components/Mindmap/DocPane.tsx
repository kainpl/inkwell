import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { useActiveProject } from '@renderer/store/useProjectStore'
import { resolveAnchor } from '@renderer/lib/mindmap/anchors'

/** Read-only CodeMirror pane that shows the clicked node's attached doc (M1). */
export default function DocPane(): JSX.Element {
  const project = useActiveProject()
  const openDoc = project?.openDoc ?? null
  const workingDir = project?.workingDir ?? null
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!openDoc || !workingDir) return
    let cancelled = false
    void window.api.inkproj
      .readDoc(workingDir, openDoc.ref)
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
              markdown(),
              EditorView.lineWrapping,
              EditorState.readOnly.of(true),
              EditorView.editable.of(false)
            ]
          })
        })
        viewRef.current = view
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
  }, [openDoc, workingDir])

  useEffect(() => () => viewRef.current?.destroy(), [])

  if (!openDoc) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-faint">
        Select a node with a document to read it here.
      </div>
    )
  }
  // The CM host is always mounted while a doc is selected; an error shows as an
  // overlay banner (so a prior error never blocks the next mount).
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
