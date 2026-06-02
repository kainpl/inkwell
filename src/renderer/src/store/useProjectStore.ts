import { create } from 'zustand'
import { useAppStore } from '@renderer/store/useAppStore'
import type { DocRef, GraphModel, InkprojManifest, LinkType } from '@shared/mindmap/types'

interface OpenDoc {
  nodeId: string
  ref: DocRef
}

/** One open project's runtime state — keyed by its tab id in `byTab`. */
export interface ProjectEntry {
  workingDir: string
  manifest: InkprojManifest
  graph: GraphModel
  linkTypes: Record<string, LinkType>
  collapsed: Set<string>
  selectedId: string | null
  openDoc: OpenDoc | null
}

interface ProjectsState {
  /** Open projects, keyed by their tab id (multiple projects can be open). */
  byTab: Record<string, ProjectEntry>
  setProjectForTab: (
    tabId: string,
    p: {
      workingDir: string
      manifest: InkprojManifest
      graph: GraphModel
      linkTypes: Record<string, LinkType>
    }
  ) => void
  removeProjectForTab: (tabId: string) => void
  // The following mutate the *active* tab's project (active tab id read from useAppStore).
  toggleCollapse: (nodeId: string) => void
  select: (nodeId: string | null) => void
  /** Select a node and, if it has docs, open its first one. */
  openDocFor: (nodeId: string) => void
  clearDoc: () => void
}

/** Immutably update the active tab's entry (no-op if the active tab isn't a project). */
function patchActive(
  state: ProjectsState,
  fn: (e: ProjectEntry) => ProjectEntry
): Partial<ProjectsState> {
  const tabId = useAppStore.getState().activeId
  const entry = state.byTab[tabId]
  if (!entry) return {}
  return { byTab: { ...state.byTab, [tabId]: fn(entry) } }
}

export const useProjectStore = create<ProjectsState>((set) => ({
  byTab: {},

  setProjectForTab: (tabId, { workingDir, manifest, graph, linkTypes }) =>
    set((s) => {
      const collapsed = new Set<string>()
      for (const n of graph.nodes) if (n.data.expand === false) collapsed.add(n.id)
      const entry: ProjectEntry = {
        workingDir,
        manifest,
        graph,
        linkTypes,
        collapsed,
        selectedId: null,
        openDoc: null
      }
      return { byTab: { ...s.byTab, [tabId]: entry } }
    }),

  removeProjectForTab: (tabId) =>
    set((s) => {
      if (!(tabId in s.byTab)) return {}
      const byTab = { ...s.byTab }
      delete byTab[tabId]
      return { byTab }
    }),

  toggleCollapse: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => {
        const collapsed = new Set(e.collapsed)
        if (collapsed.has(nodeId)) collapsed.delete(nodeId)
        else collapsed.add(nodeId)
        return { ...e, collapsed }
      })
    ),

  select: (nodeId) => set((s) => patchActive(s, (e) => ({ ...e, selectedId: nodeId }))),

  openDocFor: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => {
        const node = e.graph.nodes.find((n) => n.id === nodeId)
        const ref = node?.data.docs?.[0]
        return ref ? { ...e, openDoc: { nodeId, ref }, selectedId: nodeId } : { ...e, selectedId: nodeId }
      })
    ),

  clearDoc: () => set((s) => patchActive(s, (e) => ({ ...e, openDoc: null })))
}))

/** The active tab's project entry, or null. Subscribe to both stores so the
 *  hook re-renders on tab switch AND on project-state change. */
export function useActiveProject(): ProjectEntry | null {
  const activeId = useAppStore((s) => s.activeId)
  return useProjectStore((s) => s.byTab[activeId] ?? null)
}
