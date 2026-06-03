import JSZip from 'jszip'
import type { MarkdownNode } from '@shared/mindmap/types'

/**
 * MindNode `.mindnode` **writer** — the inverse of `importMindnode`'s protobuf walk:
 * builds a `Contents.data` payload (root → contentWrapper.f2 → canvas.f1 → mind-map),
 * with `mm.f1.f1` = root id, `mm.f2[]` = node list (`id` + `content.f11→f1[]→f4[]→f1`
 * title), and `mm.f3.f2[]` = parent→child relations (with order).
 *
 * **Caveat:** verified by round-tripping through our own reader. MindNode-app
 * compatibility is **unverified** (no MindNode here to test against) — the app may
 * require styling/theme/viewport fields we omit.
 */

// ── protobuf primitives ─────────────────────────────────────────────────────

function pbVarint(n: number): number[] {
  const out: number[] = []
  let v = n >>> 0
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v) b |= 0x80
    out.push(b)
  } while (v)
  return out
}
const pbTag = (field: number, wire: number): number[] => pbVarint((field << 3) | wire)
const pbLen = (field: number, bytes: number[]): number[] => [
  ...pbTag(field, 2),
  ...pbVarint(bytes.length),
  ...bytes
]
const pbVar = (field: number, value: number): number[] => [...pbTag(field, 0), ...pbVarint(value)]

/** A 16-byte node id from a counter (unique per node; the reader keys nodes by hex). */
function idBytes(n: number): number[] {
  const b = new Array<number>(16).fill(0)
  b[12] = (n >>> 24) & 0xff
  b[13] = (n >>> 16) & 0xff
  b[14] = (n >>> 8) & 0xff
  b[15] = n & 0xff
  return b
}

// ── message builders (mirror the reader's field paths) ──────────────────────

const encodeTitle = (text: string): number[] => {
  const str = [...new TextEncoder().encode(text)]
  const f4 = pbLen(1, str) // f4: f1 = string
  const run = pbLen(4, f4) // run: f4 = [f4]
  const titleWrap = pbLen(1, run) // titleWrap: f1 = [run]
  return pbLen(11, titleWrap) // content: f11 = titleWrap
}
const encodeNode = (id: number[], text: string): number[] => [...pbLen(1, id), ...pbLen(2, encodeTitle(text))]
const encodeRelation = (child: number[], parent: number[], order: number): number[] => {
  const inner = pbVar(2, order) // inner: f2 = order
  const orderWrap = pbLen(1, inner) // wrap: f1 = inner
  return [...pbLen(1, child), ...pbLen(2, parent), ...pbLen(4, orderWrap)]
}

/** Encode an outline into a MindNode `Contents.data` byte payload. */
export function outlineToMindnodeContents(title: string, outline: MarkdownNode[]): Uint8Array {
  const root: MarkdownNode =
    outline.length === 1 ? outline[0] : { name: title || 'Mind Map', children: outline }
  let counter = 1
  const nodes: number[][] = []
  const relations: number[][] = []
  let rootId: number[] = []
  const walk = (n: MarkdownNode, parentId: number[] | null, order: number): void => {
    const id = idBytes(counter++)
    nodes.push(encodeNode(id, (n.name ?? '').trim()))
    if (parentId) relations.push(encodeRelation(id, parentId, order))
    else rootId = id
    let i = 0
    for (const child of n.children ?? []) walk(child, id, i++)
  }
  walk(root, null, 0)

  const tree = relations.flatMap((r) => pbLen(2, r)) // mm.f3.f2[] = relations
  const mm = [
    ...pbLen(1, pbLen(1, rootId)), // mm.f1.f1 = root id
    ...nodes.flatMap((n) => pbLen(2, n)), // mm.f2[] = nodes
    ...pbLen(3, tree) // mm.f3 = tree
  ]
  const canvas = pbLen(1, mm) // canvas.f1 = mm
  const cw = pbLen(2, canvas) // contentWrapper.f2 = canvas
  return Uint8Array.from(pbLen(1, cw)) // root.f1 = contentWrapper
}

/** Pack a `Contents.data` payload into a `.mindnode` ZIP. */
export async function exportMindnodeBytes(contents: Uint8Array): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('Contents.data', contents)
  return zip.generateAsync({ type: 'uint8array' })
}
