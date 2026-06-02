import { create } from 'zustand'
import type { DocRef, GraphModel, InkprojManifest, LinkType } from '@shared/mindmap/types'

interface OpenDoc {
  nodeId: string
  ref: DocRef
}

interface ProjectState {
  /** True when a `.inkproj` is open (project mode). */
  active: boolean
  workingDir: string | null
  manifest: InkprojManifest | null
  graph: GraphModel | null
  linkTypes: Record<string, LinkType>
  collapsed: Set<string>
  selectedId: string | null
  /** The doc to show in the read-only pane (a node's primary attached doc). */
  openDoc: OpenDoc | null
  setProject: (p: {
    workingDir: string
    manifest: InkprojManifest
    graph: GraphModel
    linkTypes: Record<string, LinkType>
  }) => void
  closeProject: () => void
  toggleCollapse: (id: string) => void
  select: (id: string | null) => void
  /** Select a node and, if it has docs, open its first one. */
  openDocFor: (nodeId: string) => void
  clearDoc: () => void
}

const EMPTY = {
  active: false,
  workingDir: null,
  manifest: null,
  graph: null,
  linkTypes: {},
  collapsed: new Set<string>(),
  selectedId: null,
  openDoc: null
}

export const useProjectStore = create<ProjectState>((set) => ({
  ...EMPTY,

  setProject: ({ workingDir, manifest, graph, linkTypes }) =>
    set(() => {
      const collapsed = new Set<string>()
      for (const n of graph.nodes) if (n.data.expand === false) collapsed.add(n.id)
      return { active: true, workingDir, manifest, graph, linkTypes, collapsed, selectedId: null, openDoc: null }
    }),

  closeProject: () => set(() => ({ ...EMPTY, collapsed: new Set<string>() })),

  toggleCollapse: (id) =>
    set((s) => {
      const collapsed = new Set(s.collapsed)
      if (collapsed.has(id)) collapsed.delete(id)
      else collapsed.add(id)
      return { collapsed }
    }),

  select: (selectedId) => set({ selectedId }),

  openDocFor: (nodeId) =>
    set((s) => {
      const node = s.graph?.nodes.find((n) => n.id === nodeId)
      const ref = node?.data.docs?.[0]
      return ref ? { openDoc: { nodeId, ref }, selectedId: nodeId } : { selectedId: nodeId }
    }),

  clearDoc: () => set({ openDoc: null })
}))
