import * as Y from 'yjs'
import type { MarkdownNode } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, nodesOf, outlineToYjs } from './yjsModel'

export interface ProjectDoc {
  doc: Y.Doc
  undo: Y.UndoManager
  srcPath: string
}

/** Y.Docs for open project tabs, keyed by tab id. Lives outside React/Zustand
 *  (Y.Doc is mutable external state). */
const registry = new Map<string, ProjectDoc>()

export function createProjectDoc(
  tabId: string,
  outline: MarkdownNode[],
  title: string,
  srcPath: string
): ProjectDoc {
  const doc = new Y.Doc()
  outlineToYjs(doc, outline, title)
  const undo = new Y.UndoManager(nodesOf(doc), {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 400
  })
  const entry: ProjectDoc = { doc, undo, srcPath }
  registry.set(tabId, entry)
  return entry
}

export const getProjectDoc = (tabId: string): ProjectDoc | undefined => registry.get(tabId)

export function destroyProjectDoc(tabId: string): void {
  const entry = registry.get(tabId)
  if (!entry) return
  entry.undo.destroy()
  entry.doc.destroy()
  registry.delete(tabId)
}
