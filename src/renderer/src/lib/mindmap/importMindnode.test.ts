// @vitest-environment node
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { importMindnode } from './importMindnode'

// ── tiny protobuf encoder (length-delimited messages only) ──
const enc = new TextEncoder()
const varint = (n: number): number[] => {
  const out: number[] = []
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n)
  return out
}
const field = (fn: number, payload: Uint8Array): number[] => [
  (fn << 3) | 2,
  ...varint(payload.length),
  ...payload
]
const strField = (fn: number, s: string): number[] => field(fn, enc.encode(s))
const msg = (...fields: number[][]): Uint8Array => Uint8Array.from(fields.flat())
const id = (b: number): Uint8Array => Uint8Array.from(new Array(16).fill(b))

const node = (idByte: number, text: string): Uint8Array => {
  const textMsg = msg(strField(1, text)) // { f1: text }
  const run = msg(field(4, textMsg)) // { f4: [textMsg] }
  const titleWrap = msg(field(1, run)) // { f1: [run] }
  const content = msg(field(11, titleWrap)) // { f11: titleWrap }
  return msg(field(1, id(idByte)), field(2, content)) // node { f1: id, f2: content }
}

describe('importMindnode', () => {
  it('decodes the Contents.data node tree (root + child)', async () => {
    const rootRef = msg(field(1, id(1)))
    const rel = msg(field(1, id(2)), field(2, id(1))) // child=2, parent=1
    const tree = msg(field(1, id(1)), field(2, rel))
    const mm = msg(field(1, rootRef), field(2, node(1, 'Root')), field(2, node(2, 'Child')), field(3, tree))
    const canvas = msg(field(1, mm))
    const wrapper = msg(field(2, canvas))
    const root = msg(field(1, wrapper))

    const zip = new JSZip()
    zip.file('Contents.data', root)
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    const { title, outline } = await importMindnode(bytes)
    expect(title).toBe('Root')
    expect(outline[0].name).toBe('Root')
    expect(outline[0].children?.map((n) => n.name)).toEqual(['Child'])
  })
})
