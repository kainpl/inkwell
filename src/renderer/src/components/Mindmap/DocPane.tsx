import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import { resolveAnchor } from '@renderer/lib/mindmap/anchors'
import { setDocView } from '@renderer/lib/mindmap/docView'

/** Doc pane for the selected node's attached doc. Internal docs are editable
 *  (buffered → flushed on Save); external docs render the user-granted content
 *  read-only (D7 — a stored `src` is never auto-read). */
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
    if (!openDoc || !workingDir) return
    const ref = openDoc.ref
    let cancelled = false

    const mount = (text: string, readOnly: boolean): void => {
      if (cancelled || !hostRef.current) return
      setError(null)
      viewRef.current?.destroy()
      const exts = [lineNumbers(), markdown(), EditorView.lineWrapping]
      if (readOnly) {
        exts.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
      } else {
        exts.push(
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && path) useProjectStore.getState().setDocBuffer(path, u.state.doc.toString())
          })
        )
      }
      const view = new EditorView({ parent: hostRef.current, state: EditorState.create({ doc: text, extensions: exts }) })
      viewRef.current = view
      setDocView(readOnly ? null : view) // only an editable internal doc takes anchor inserts
      const anchor = ref.anchor
      if (!anchor) return
      const pos = resolveAnchor(text, anchor)
      if (!pos) return
      const line = view.state.doc.line(Math.min(pos.line + 1, view.state.doc.lines))
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      })
    }

    if (ref.external) {
      const cached = ref.src ? useProjectStore.getState().byTab[activeId]?.externalDocs[ref.src] : undefined
      if (cached != null) mount(cached, true)
      else {
        viewRef.current?.destroy()
        viewRef.current = null
        setDocView(null)
      }
      return () => {
        cancelled = true
      }
    }
    if (!path) return
    const buffered = useProjectStore.getState().byTab[activeId]?.dirtyDocs[path]
    const load =
      buffered != null ? Promise.resolve(buffered) : window.api.inkproj.readDoc(workingDir, ref)
    void load.then((text) => mount(text, false)).catch((e: unknown) => {
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
  const extNoContent =
    external && !(openDoc.ref.src && project?.externalDocs[openDoc.ref.src] != null)
  return (
    <div className="relative h-full">
      {error ? (
        <div className="absolute inset-x-0 top-0 z-10 bg-paper p-2 text-[12px] text-[#d35454]">
          Couldn’t open the document: {error}
        </div>
      ) : null}
      {extNoContent ? (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-faint">
          External document — use <span className="mx-1 font-medium">Open</span> to load it.
        </div>
      ) : (
        <div ref={hostRef} className="h-full overflow-auto text-sm" />
      )}
    </div>
  )
}
