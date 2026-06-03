import JSZip from 'jszip'
import type { MarkdownNode } from '@shared/mindmap/types'
import { cleanImportedOutline, type ImportResult } from './importFormats'

/**
 * Minimal MindNode `.mindnode` (v2 / `Contents.data` protobuf) importer: extracts
 * the node tree (text + parent→child relations + sibling order), skipping the
 * source's heavy styling/image/theme/viewport decoding. Adapted from the source's
 * `parseMindnodeV2` (we inherit it — §1a); field paths verified against a real file.
 */
type Fields = Record<number, (Uint8Array | number)[]>

function pbDecode(buf: Uint8Array): Fields {
  let p = 0
  const fields: Fields = {}
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const varint = (): number => {
    let r = 0
    let s = 0
    while (p < buf.length && s < 35) {
      const b = buf[p++]
      r |= (b & 0x7f) << s
      s += 7
      if (!(b & 0x80)) break
    }
    return r >>> 0
  }
  while (p < buf.length) {
    const tag = varint()
    const fn = tag >>> 3
    const wt = tag & 7
    if (fn === 0 || fn > 500 || p > buf.length) break
    const slot = (fields[fn] ??= [])
    if (wt === 2) {
      const len = varint()
      if (len > buf.length - p) break
      slot.push(buf.subarray(p, p + len))
      p += len
    } else if (wt === 0) {
      slot.push(varint())
    } else if (wt === 1) {
      if (p + 8 <= buf.length) slot.push(dv.getFloat64(p, true))
      p += 8
    } else if (wt === 5) {
      if (p + 4 <= buf.length) slot.push(dv.getFloat32(p, true))
      p += 4
    } else {
      break
    }
  }
  return fields
}

const pbBuf = (f: Fields, fn: number, idx = 0): Uint8Array | null => {
  const v = f[fn]?.[idx]
  return v instanceof Uint8Array ? v : null
}
const pbStr = (b: Uint8Array): string => new TextDecoder().decode(b)
const pbHex = (b: Uint8Array): string =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')

/** A node's title text — content.f11 (title wrap) → f1[] runs → f4[] → f1 (string). */
function nodeText(contentBuf: Uint8Array | null): string {
  if (!contentBuf) return ''
  const titleWrapBuf = pbBuf(pbDecode(contentBuf), 11)
  if (!titleWrapBuf) return ''
  let text = ''
  for (const run of pbDecode(titleWrapBuf)[1] ?? []) {
    if (!(run instanceof Uint8Array)) continue
    for (const f4 of pbDecode(run)[4] ?? []) {
      if (!(f4 instanceof Uint8Array)) continue
      const s = pbBuf(pbDecode(f4), 1)
      if (s) text += pbStr(s)
    }
  }
  return text
}

/** Decode the protobuf node tree from a MindNode `Contents.data` payload. */
export function mindnodeContentsToOutline(contents: Uint8Array): ImportResult {
  const root = pbDecode(contents)
  const cw = pbBuf(root, 1)
  const canvas = cw ? pbBuf(pbDecode(cw), 2) : null
  const mmBuf = canvas ? pbBuf(pbDecode(canvas), 1) : null
  if (!mmBuf) throw new Error('Unsupported .mindnode layout (no mind-map message)')
  const mm = pbDecode(mmBuf)

  // mm.f2[] = flat node list → id (n.f1) + text.
  const texts: Record<string, string> = {}
  for (const entry of mm[2] ?? []) {
    if (!(entry instanceof Uint8Array)) continue
    const n = pbDecode(entry)
    const idBuf = pbBuf(n, 1)
    if (!idBuf) continue
    texts[pbHex(idBuf)] = nodeText(pbBuf(n, 2))
  }

  // mm.f3 = relations (f2[]: child f1, parent f2, order f4.f1.f2) + tombstones (f3[]).
  const childrenOf: Record<string, { id: string; order: number }[]> = {}
  const tombstones = new Set<string>()
  const treeBuf = pbBuf(mm, 3)
  if (treeBuf) {
    const tree = pbDecode(treeBuf)
    for (const t of tree[3] ?? []) if (t instanceof Uint8Array && t.length === 16) tombstones.add(pbHex(t))
    for (const rel of tree[2] ?? []) {
      if (!(rel instanceof Uint8Array)) continue
      const r = pbDecode(rel)
      const c = pbBuf(r, 1)
      const p = pbBuf(r, 2)
      if (!c || !p) continue
      const childId = pbHex(c)
      if (tombstones.has(childId)) continue
      let order = 0
      const ob = pbBuf(r, 4)
      if (ob) {
        const inner = pbBuf(pbDecode(ob), 1)
        const v = inner ? pbDecode(inner)[2]?.[0] : undefined
        if (typeof v === 'number') order = v
      }
      ;(childrenOf[pbHex(p)] ??= []).push({ id: childId, order })
    }
    for (const arr of Object.values(childrenOf)) arr.sort((a, b) => a.order - b.order)
  }

  // Root = mm.f1.f1, or (fallback) the id with the most children.
  const rootRef = pbBuf(mm, 1)
  const rootIdBuf = rootRef ? pbBuf(pbDecode(rootRef), 1) : null
  let rootId = rootIdBuf ? pbHex(rootIdBuf) : ''
  if (!childrenOf[rootId]?.length) {
    let best = ''
    let max = 0
    for (const [pid, arr] of Object.entries(childrenOf)) {
      if (arr.length > max) {
        max = arr.length
        best = pid
      }
    }
    if (best) rootId = best
  }

  const seen = new Set<string>()
  const build = (id: string): MarkdownNode => {
    seen.add(id)
    const children = (childrenOf[id] ?? [])
      .filter((k) => !seen.has(k.id))
      .map((k) => build(k.id))
    return { name: (texts[id] ?? '').trim(), children }
  }
  const outline = rootId ? cleanImportedOutline([build(rootId)]) : []
  return { title: outline[0]?.name || 'MindNode', outline }
}

/** Unzip a `.mindnode` bundle and import its `Contents.data` node tree. */
export async function importMindnode(bytes: Uint8Array): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(bytes)
  const file = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith('contents.data')
  )
  if (!file) throw new Error('Unsupported .mindnode (no Contents.data)')
  return mindnodeContentsToOutline(await file.async('uint8array'))
}
