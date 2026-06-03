/**
 * Shared types for the mind-map / schema layer (the `.inkproj` project format).
 * Kept dependency-free so both main and renderer can import them. The `data`
 * bag is intentionally open-ended (forward-compat): unknown keys are parsed,
 * preserved, and ignored by M1 rendering. See docs/mindmap/m1-spec.md §4.
 */

/** One node in the schema outline (mirrors the source `.mind-map` model). */
export interface MarkdownNode {
  name: string
  children?: MarkdownNode[]
  data?: NodeData
}

/** Per-node data bag. These are the M1-consumed keys; any other key survives. */
export interface NodeData {
  /** Stable node id; cross-links and doc refs resolve to it. */
  id?: string
  /** Typed cross-link edges originating from this node. */
  links?: CrossLink[]
  /** Links to other `.inkproj` files (opened via a user grant; path stored, not read). */
  extLinks?: { file: string; title: string }[]
  /** Attached documents (whole doc or an anchor inside one). */
  docs?: DocRef[]
  /** Sanitized inline rich caption (HTML). */
  labelHtml?: string
  /** Whole-label format flags — applied at render (rename-safe), not stored as HTML. */
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** A short per-node note (lighter than an attached doc). */
  note?: string
  color?: string
  lineColor?: string
  fillColor?: string
  shape?: string
  /** Draw a frame around this node's visible subtree (group bracket / underline). */
  frame?: 'bracket' | 'underline'
  icon?: string[]
  tag?: string[]
  task?: boolean
  taskStatus?: 'open' | 'done' | 'cancelled'
  taskType?: string
  /** `false` ⇒ this node's subtree starts collapsed. */
  expand?: boolean
  /** Manual position pins (honored if present, else auto-layout). */
  offsetX?: number
  offsetY?: number
  customLeft?: number
  customTop?: number
  [k: string]: unknown
}

/** A typed cross-link edge (any node → any node, across branches/levels). */
export interface CrossLink {
  id: string
  /** Target node id. */
  to: string
  /** Link type key (resolves against the manifest link-type registry). */
  type: string
  label?: string
  /** Reserved for future cross-`.inkproj` links (unused in M1). */
  file?: string
}

/** A reference from a node to a bundled or external document. */
export interface DocRef {
  /** Bundle-relative path (e.g. `docs/notes.md`); omitted when `external`. */
  path?: string
  /** Anchor inside the doc (`#id` — a `{#id}` heading or a `^id` block). */
  anchor?: string
  title?: string
  external?: boolean
  /** Absolute/on-disk source when `external` is true. */
  src?: string
}

/** Visual + semantic definition of a cross-link type. */
export interface LinkType {
  label: string
  color: string
  arrow?: 'to' | 'none' | 'both'
  directed?: boolean
  icon?: string
}

/** `manifest.json` — project metadata + the link-type registry. */
export interface InkprojManifest {
  format: 'inkproj'
  formatVersion: number
  app?: string
  appVersion?: string
  title?: string
  createdAt?: string
  updatedAt?: string
  /** Entry path of the schema inside the bundle (default `schema.mind-map`). */
  schema?: string
  /** Overrides for built-in types + first-class custom types. */
  linkTypes?: Record<string, LinkType>
  /** Free-text project notes / instructions, surfaced on open. */
  instructions?: string
}

/** Payload for an atomic bundle save: the schema text, plus (when changed) the
 *  manifest and any edited docs. Main writes each, then re-zips the working dir. */
export interface InkprojSavePayload {
  schema: string
  manifest?: InkprojManifest
  /** Bundle-relative path → new content for edited/created docs. */
  docs?: { path: string; content: string }[]
}

/** A user-picked external document (read once via a main-side dialog grant — D7). */
export interface PickedExternal {
  /** Absolute on-disk path the user chose. */
  src: string
  content: string
  title: string
}

/** Result of opening a `.inkproj`: the extracted working dir + parsed entries. */
export interface OpenedInkproj {
  workingDir: string
  manifest: InkprojManifest
  schema: string
  /** The source `.inkproj` path — where Save writes back to. */
  srcPath: string
}

/** Renderer graph model (engine-agnostic — D8; React Flow consumes it). */
export interface GraphNode {
  id: string
  label: string
  depth: number
  parentId: string | null
  data: NodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: 'tree' | 'cross'
  /** Cross-link type (only for `kind === 'cross'`). */
  type?: string
  label?: string
  /** The owning `CrossLink.id` (only for `kind === 'cross'`) — lets an edge resolve
   *  back to `{ source node, link }` for editing. */
  linkId?: string
}

export interface GraphModel {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** node id → child node ids (tree). */
  childrenOf: Map<string, string[]>
  /** node id → cross-link edges pointing at it. */
  incomingCross: Map<string, GraphEdge[]>
}
