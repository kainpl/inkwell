import { create } from 'zustand'
import { useAppStore } from '@renderer/store/useAppStore'
import type { DocRef, InkprojManifest, LinkType } from '@shared/mindmap/types'

interface OpenDoc {
  nodeId: string
  ref: DocRef
}

/** One open project's UI state — keyed by its tab id in `byTab`. The live graph
 *  is derived from the Yjs doc (`useProjectGraph`), not stored here. */
export interface ProjectEntry {
  workingDir: string
  manifest: InkprojManifest
  /** Merged registry (built-ins + manifest overrides/customs) used for rendering. */
  linkTypes: Record<string, LinkType>
  /** The manifest's own link-type overrides/customs (what persists to `manifest.json`). */
  manifestLinkTypes: Record<string, LinkType>
  /** Link-type registry changed since last save → write `manifest.json` on Save. */
  manifestDirty: boolean
  /** Source `.inkproj` path (where Save writes back). */
  srcPath: string
  collapsed: Set<string>
  selectedId: string | null
  /** Node currently in inline-rename mode (its `MindNode` shows an input). */
  editingId: string | null
  /** Selected cross-link (mutually exclusive with `selectedId`). */
  selectedLink: { fromNodeId: string; linkId: string } | null
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
      linkTypes: Record<string, LinkType>
      srcPath: string
      collapsed: Set<string>
    }
  ) => void
  removeProjectForTab: (tabId: string) => void
  // The following mutate the *active* tab's project (active tab id read from useAppStore).
  toggleCollapse: (nodeId: string) => void
  /** Expand a node (remove it from the collapsed set) so its children show. */
  expand: (nodeId: string) => void
  select: (nodeId: string | null) => void
  /** Select a cross-link (clears node selection); `null` clears the link selection. */
  selectLink: (fromNodeId: string | null, linkId?: string) => void
  /** Select a node; open its doc if a ref is supplied (else keep the current doc). */
  openDocFor: (nodeId: string, ref: DocRef | undefined) => void
  clearDoc: () => void
  /** Enter inline-rename mode for a node. */
  beginEdit: (nodeId: string) => void
  /** Leave inline-rename mode. */
  endEdit: () => void
  /** Add/override a link type (custom or built-in tweak); marks manifest + tab dirty. */
  addLinkType: (key: string, type: LinkType) => void
  /** Clear the manifest-dirty flag (after a successful save). */
  clearManifestDirty: () => void
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

  setProjectForTab: (tabId, { workingDir, manifest, linkTypes, srcPath, collapsed }) =>
    set((s) => ({
      byTab: {
        ...s.byTab,
        [tabId]: {
          workingDir,
          manifest,
          linkTypes,
          manifestLinkTypes: manifest.linkTypes ?? {},
          manifestDirty: false,
          srcPath,
          collapsed,
          selectedId: null,
          editingId: null,
          selectedLink: null,
          openDoc: null
        }
      }
    })),

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

  expand: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => {
        if (!e.collapsed.has(nodeId)) return e
        const collapsed = new Set(e.collapsed)
        collapsed.delete(nodeId)
        return { ...e, collapsed }
      })
    ),

  select: (nodeId) =>
    set((s) => patchActive(s, (e) => ({ ...e, selectedId: nodeId, selectedLink: null }))),

  selectLink: (fromNodeId, linkId) =>
    set((s) =>
      patchActive(s, (e) => ({
        ...e,
        selectedLink: fromNodeId == null || linkId == null ? null : { fromNodeId, linkId },
        selectedId: null,
        editingId: null
      }))
    ),

  openDocFor: (nodeId, ref) =>
    set((s) =>
      patchActive(s, (e) =>
        ref
          ? { ...e, openDoc: { nodeId, ref }, selectedId: nodeId, selectedLink: null }
          : { ...e, selectedId: nodeId, selectedLink: null }
      )
    ),

  clearDoc: () => set((s) => patchActive(s, (e) => ({ ...e, openDoc: null }))),

  beginEdit: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => ({ ...e, editingId: nodeId, selectedId: nodeId, selectedLink: null }))
    ),

  endEdit: () => set((s) => patchActive(s, (e) => (e.editingId == null ? e : { ...e, editingId: null }))),

  addLinkType: (key, type) => {
    set((s) =>
      patchActive(s, (e) => ({
        ...e,
        manifestLinkTypes: { ...e.manifestLinkTypes, [key]: type },
        linkTypes: { ...e.linkTypes, [key]: type },
        manifestDirty: true
      }))
    )
    useAppStore.getState().setTabDirty(useAppStore.getState().activeId, true)
  },

  clearManifestDirty: () =>
    set((s) => patchActive(s, (e) => (e.manifestDirty ? { ...e, manifestDirty: false } : e)))
}))

/** The active tab's project entry, or null. Subscribes to both stores so it
 *  re-renders on tab switch AND on project-state change. */
export function useActiveProject(): ProjectEntry | null {
  const activeId = useAppStore((s) => s.activeId)
  return useProjectStore((s) => s.byTab[activeId] ?? null)
}
