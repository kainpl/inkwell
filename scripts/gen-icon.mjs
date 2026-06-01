// Generates the app icon (resources/icon.png + resources/icon.ico) with no
// external tooling — draws an "ink drop on paper" mark into an RGBA buffer and
// encodes PNG/ICO by hand (zlib only). Re-run with: node scripts/gen-icon.mjs
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- drawing -----------------------------------------------------------------

const TOP = [0x3c, 0x4f, 0x73] // gradient top (slate blue)
const BOTTOM = [0x22, 0x2e, 0x47] // gradient bottom (deep ink)
const DROP = [0xf2, 0xec, 0xe0] // ink drop (warm paper)
const GLINT = [0xff, 0xfc, 0xf6] // tiny highlight on the drop

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

function sample(S, px, py) {
  const m = S * 0.045
  const r = (S - 2 * m) * 0.24
  // rounded-square mask
  if (px < m || px > S - m || py < m || py > S - m) return null
  const ccx = clamp(px, m + r, S - m - r)
  const ccy = clamp(py, m + r, S - m - r)
  const ddx = px - ccx
  const ddy = py - ccy
  if (ddx * ddx + ddy * ddy > r * r) return null

  // ink drop = disk (bottom) ∪ triangle (pointed top)
  const cx = S / 2
  const cy = S * 0.58
  const R = S * 0.2
  const tip = S * 0.2
  const inDisk = (px - cx) ** 2 + (py - cy) ** 2 <= R * R
  // triangle (cx,tip) (cx-R,cy) (cx+R,cy)
  const sign = (ax, ay, bx, by, cxx, cyy) => (ax - cxx) * (by - cyy) - (bx - cxx) * (ay - cyy)
  const d1 = sign(px, py, cx, tip, cx - R, cy)
  const d2 = sign(px, py, cx - R, cy, cx + R, cy)
  const d3 = sign(px, py, cx + R, cy, cx, tip)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  const inTri = !(hasNeg && hasPos)
  if (inDisk || inTri) {
    const gx = cx - S * 0.06
    const gy = cy - S * 0.12
    if ((px - gx) ** 2 + (py - gy) ** 2 <= (S * 0.05) ** 2) return GLINT
    return DROP
  }
  // background gradient
  const t = clamp((py - m) / (S - 2 * m), 0, 1)
  return [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)]
}

function render(S) {
  const buf = Buffer.alloc(S * S * 4)
  const SS = 4 // supersampling
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const c = sample(S, x + (i + 0.5) / SS, y + (j + 0.5) / SS)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 255
          }
        }
      }
      const n = SS * SS
      const o = (y * S + x) * 4
      const cov = a / n / 255 || 0
      // un-premultiply so partially-covered edge pixels keep their colour
      buf[o] = cov ? Math.round(r / (n * cov)) : 0
      buf[o + 1] = cov ? Math.round(g / (n * cov)) : 0
      buf[o + 2] = cov ? Math.round(b / (n * cov)) : 0
      buf[o + 3] = Math.round(a / n)
    }
  }
  return buf
}

// --- PNG / ICO encoders ------------------------------------------------------

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function encodePNG(S, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const raw = Buffer.alloc((S * 4 + 1) * S)
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
function encodeICO(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = []
  for (const im of images) {
    const e = Buffer.alloc(16)
    e[0] = im.size >= 256 ? 0 : im.size
    e[1] = im.size >= 256 ? 0 : im.size
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(im.png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += im.png.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

// --- write -------------------------------------------------------------------

mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'resources', 'icon.png'), encodePNG(512, render(512)))
const icoSizes = [16, 32, 48, 64, 128, 256]
writeFileSync(
  join(root, 'resources', 'icon.ico'),
  encodeICO(icoSizes.map((size) => ({ size, png: encodePNG(size, render(size)) })))
)
console.log('wrote resources/icon.png (512) and resources/icon.ico [' + icoSizes.join(',') + ']')
