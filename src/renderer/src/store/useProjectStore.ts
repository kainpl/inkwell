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
  /** Extra multi-selected nodes (beyond `selectedId`); the full selection is the union. */
  multi: Set<string>
  /** Node currently in inline-rename mode (its `MindNode` shows an input). */
  editingId: string | null
  /** Selected cross-link (mutually exclusive with `selectedId`). */
  selectedLink: { fromNodeId: string; linkId: string } | null
  openDoc: OpenDoc | null
  /** Bundle-relative doc path → edited content not yet saved (flushed on Save). */
  dirtyDocs: Record<string, string>
  /** External doc `src` → content the user granted this session (transient, never saved). */
  externalDocs: Record<string, string>
  /** Whether the canvas search box is open. */
  searchOpen: boolean
  /** Whether the quick-entry box is open. */
  quickOpen: boolean
  /** When set, nodes without this tag are dimmed. */
  highlightTag: string | null
  /** When set, nodes outside this node's focus set (it + ancestors + descendants) are dimmed. */
  focusId: string | null
  /** Which view the left column shows: mind-map, outline, table, or split. */
  viewMode: 'map' | 'outline' | 'table' | 'split'
  /** Map growth direction: `right` = horizontal, `down` = vertical. */
  direction: 'right' | 'down'
  /** Node count at the last successful save — the shrink-guard's baseline (0 until first save). */
  savedNodeCount: number
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
  /** Replace the whole collapsed set (used by expand-to-level). */
  setCollapsed: (ids: Set<string>) => void
  select: (nodeId: string | null) => void
  /** Toggle a node in the multi-selection (Shift/Cmd-click); first pick becomes primary. */
  toggleInSelection: (nodeId: string) => void
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
  /** Buffer an edited doc's content (marks the tab dirty). */
  setDocBuffer: (path: string, content: string) => void
  /** Drop all buffered doc edits (after a successful save). */
  clearDirtyDocs: () => void
  /** Cache a user-granted external doc's content (transient; no dirty). */
  setExternalDoc: (src: string, content: string) => void
  /** Toggle / set the canvas search box. */
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void
  /** Toggle / set the quick-entry box. */
  toggleQuick: () => void
  setQuickOpen: (open: boolean) => void
  /** Toggle the highlighted tag (passing the current one clears it). */
  setHighlightTag: (tag: string | null) => void
  /** Set / clear the focused node. */
  setFocus: (id: string | null) => void
  /** Switch the left-column view (map / outline / table / split). */
  setViewMode: (mode: 'map' | 'outline' | 'table' | 'split') => void
  /** Set the map growth direction (horizontal / vertical). */
  setDirection: (dir: 'right' | 'down') => void
  /** Record the node count persisted by the last save (shrink-guard baseline). */
  setSavedNodeCount: (n: number) => void
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
          multi: new Set<string>(),
          editingId: null,
          selectedLink: null,
          openDoc: null,
          dirtyDocs: {},
          externalDocs: {},
          searchOpen: false,
          quickOpen: false,
          highlightTag: null,
          focusId: null,
          viewMode: 'map',
          direction: 'right',
          savedNodeCount: 0
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

  setCollapsed: (ids) => set((s) => patchActive(s, (e) => ({ ...e, collapsed: ids }))),

  select: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => ({
        ...e,
        selectedId: nodeId,
        multi: e.multi.size ? new Set<string>() : e.multi,
        selectedLink: null
      }))
    ),

  toggleInSelection: (nodeId) =>
    set((s) =>
      patchActive(s, (e) => {
        if (e.selectedId == null) return { ...e, selectedId: nodeId }
        if (nodeId === e.selectedId) return e
        const multi = new Set(e.multi)
        if (multi.has(nodeId)) multi.delete(nodeId)
        else multi.add(nodeId)
        return { ...e, multi, selectedLink: null }
      })
    ),

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
      patchActive(s, (e) => {
        const base = { ...e, selectedId: nodeId, selectedLink: null, multi: new Set<string>() }
        return ref ? { ...base, openDoc: { nodeId, ref } } : base
      })
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
    set((s) => patchActive(s, (e) => (e.manifestDirty ? { ...e, manifestDirty: false } : e))),

  setDocBuffer: (path, content) => {
    set((s) => patchActive(s, (e) => ({ ...e, dirtyDocs: { ...e.dirtyDocs, [path]: content } })))
    useAppStore.getState().setTabDirty(useAppStore.getState().activeId, true)
  },

  clearDirtyDocs: () =>
    set((s) =>
      patchActive(s, (e) => (Object.keys(e.dirtyDocs).length ? { ...e, dirtyDocs: {} } : e))
    ),

  setExternalDoc: (src, content) =>
    set((s) => patchActive(s, (e) => ({ ...e, externalDocs: { ...e.externalDocs, [src]: content } }))),

  toggleSearch: () => set((s) => patchActive(s, (e) => ({ ...e, searchOpen: !e.searchOpen }))),
  setSearchOpen: (open) => set((s) => patchActive(s, (e) => ({ ...e, searchOpen: open }))),

  toggleQuick: () => set((s) => patchActive(s, (e) => ({ ...e, quickOpen: !e.quickOpen }))),
  setQuickOpen: (open) => set((s) => patchActive(s, (e) => ({ ...e, quickOpen: open }))),

  setHighlightTag: (tag) =>
    set((s) => patchActive(s, (e) => ({ ...e, highlightTag: e.highlightTag === tag ? null : tag }))),
  setFocus: (id) => set((s) => patchActive(s, (e) => ({ ...e, focusId: id }))),
  setViewMode: (mode) => set((s) => patchActive(s, (e) => ({ ...e, viewMode: mode }))),
  setDirection: (dir) => set((s) => patchActive(s, (e) => ({ ...e, direction: dir }))),
  setSavedNodeCount: (n) => set((s) => patchActive(s, (e) => ({ ...e, savedNodeCount: n })))
}))

/** The active tab's project entry, or null. Subscribes to both stores so it
 *  re-renders on tab switch AND on project-state change. */
export function useActiveProject(): ProjectEntry | null {
  const activeId = useAppStore((s) => s.activeId)
  return useProjectStore((s) => s.byTab[activeId] ?? null)
}
