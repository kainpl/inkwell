// Builds resources/fixtures/sample.inkproj — a hand-authored project for
// manual testing + M1 acceptance. Run: node scripts/make-fixture-inkproj.mjs
//
// Deliberately rich: a 4-level tree (~25 nodes), every built-in cross-link type
// plus a custom one, a collapsed branch, task nodes in each status, styled
// nodes, and several long multi-section markdown docs so anchor scrolling has
// somewhere to scroll to.
import JSZip from 'jszip'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'resources', 'fixtures', 'sample.inkproj')

// ── long-markdown helpers ────────────────────────────────────────────
const SENT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '
const para = (seed) => `Notes on **${seed}**. ${SENT.repeat(5)}`
/** sections: [{ title, id?, paras?, block? }] → a long markdown doc. */
const longDoc = (title, intro, sections) => {
  const lines = [`# ${title}`, '', intro, '']
  for (const s of sections) {
    lines.push(`## ${s.title}${s.id ? ` {#${s.id}}` : ''}`, '')
    for (let i = 0; i < (s.paras ?? 4); i += 1) lines.push(para(`${s.title} · ${i + 1}`), '')
    if (s.list) {
      for (const item of s.list) lines.push(`- ${item}`)
      lines.push('')
    }
    if (s.block) lines.push(`> Decision: ${s.block.text} ^${s.block.id}`, '')
  }
  return lines.join('\n')
}

// ── node helper ──────────────────────────────────────────────────────
const meta = (o) => `<!-- mindmap ${JSON.stringify(o)} -->`
const n = (depth, name, data) => `${'  '.repeat(depth)}- ${name} ${meta(data)}`

// ── manifest (custom first-class link type) ──────────────────────────
const manifest = {
  format: 'inkproj',
  formatVersion: 1,
  app: 'inkwell',
  appVersion: '0.1.0',
  title: 'Inkwell — Product Plan',
  createdAt: '2026-06-02T10:00:00.000Z',
  schema: 'schema.mind-map',
  linkTypes: {
    'ship-blocker': { label: 'blocks ship', color: '#c0392b', arrow: 'to', directed: true, icon: '🚧' }
  }
}

// ── schema (4-level tree + varied cross-links) ───────────────────────
const schema = [
  '---',
  'title: Inkwell — Product Plan',
  'createdAt: 2026-06-02T10:00:00.000Z',
  '---',
  '',
  `# Inkwell — Product Plan ${meta({ id: 'root' })}`,
  '',
  n(0, 'Vision', { id: 'vision', fillColor: '#eef4ff', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#overview' }] }),
  n(1, 'Problem', { id: 'problem', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#goals' }] }),
  n(1, 'Differentiators', { id: 'diff' }),
  n(2, '2-in-1 markdown + schema', { id: 'twoinone', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#architecture' }] }),
  n(2, 'Self-contained .inkproj', { id: 'selfcontained' }),
  n(0, 'Product', { id: 'product' }),
  n(1, 'PRD', { id: 'prd', color: '#2b6', docs: [{ path: 'docs/prd/product-plan.md' }], links: [{ id: 'l1', to: 'eng-spec', type: 'depends-on' }] }),
  n(2, 'Goals', { id: 'goals', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#goals' }] }),
  n(2, 'Scope', { id: 'scope', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#scope' }] }),
  n(1, 'Roadmap', { id: 'roadmap' }),
  n(2, 'M1 read-only', { id: 'm1', task: true, taskStatus: 'done' }),
  n(2, 'M2 editing', { id: 'm2', task: true, taskStatus: 'open', links: [{ id: 'l2', to: 'release', type: 'blocks' }] }),
  n(2, 'M3 collaboration', { id: 'm3', expand: false }),
  n(3, 'Yjs networking', { id: 'yjs' }),
  n(3, 'P2P transport', { id: 'p2p' }),
  n(0, 'Engineering', { id: 'eng' }),
  n(1, 'Spec', { id: 'eng-spec', docs: [{ path: 'docs/eng/spec.md', anchor: '#data-model' }], links: [{ id: 'l3', to: 'prd', type: 'references' }] }),
  n(1, 'Architecture', { id: 'arch', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#architecture' }] }),
  n(1, 'Risks', { id: 'risks', task: true, taskStatus: 'cancelled', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#risks' }], links: [{ id: 'l4', to: 'market', type: 'see-also' }, { id: 'l5', to: 'release', type: 'ship-blocker' }] }),
  n(0, 'Research', { id: 'research' }),
  n(1, 'Market', { id: 'market', docs: [{ path: 'docs/research/market.md', anchor: '#landscape' }] }),
  n(1, 'Competitors', { id: 'competitors', docs: [{ path: 'docs/research/market.md', anchor: '#competitors' }], links: [{ id: 'l6', to: 'diff', type: 'relates-to' }] }),
  n(0, 'Release', { id: 'release' }),
  n(1, 'Timeline', { id: 'timeline', docs: [{ path: 'docs/prd/product-plan.md', anchor: '#timeline' }] }),
  ''
].join('\n')

// ── long docs ────────────────────────────────────────────────────────
const productPlan = longDoc(
  'Inkwell — Product Plan',
  'A long PRD-style document; sections below are anchor targets for schema nodes.',
  [
    { title: 'Overview', id: 'overview', paras: 5 },
    { title: 'Goals', id: 'goals', paras: 5, list: ['2-in-1 markdown + schema', 'Self-contained project file', 'Offline-first, local'] },
    { title: 'Scope', id: 'scope', paras: 6 },
    { title: 'Architecture', id: 'architecture', paras: 7, block: { id: 'decision-1', text: 'schema canonical as `.mind-map`, sidecar index for scale.' } },
    { title: 'Risks', id: 'risks', paras: 5 },
    { title: 'Timeline', id: 'timeline', paras: 4 }
  ]
)
const engSpec = longDoc(
  'Engineering Spec',
  'Implementation spec; the schema node "Spec" deep-links into the Data model section.',
  [
    { title: 'Design', id: 'design', paras: 5 },
    { title: 'Data model', id: 'data-model', paras: 7 },
    { title: 'IPC', id: 'ipc', paras: 4 },
    { title: 'Security', id: 'security', paras: 5 },
    { title: 'Testing', id: 'testing', paras: 4 }
  ]
)
const market = longDoc(
  'Market Research',
  'Long research note with anchored sections.',
  [
    { title: 'Landscape', id: 'landscape', paras: 6 },
    { title: 'Competitors', id: 'competitors', paras: 7, list: ['Typora', 'Obsidian', 'MindNode', 'XMind'] },
    { title: 'Opportunities', id: 'opportunities', paras: 5 }
  ]
)

const zip = new JSZip()
zip.file('manifest.json', JSON.stringify(manifest, null, 2))
zip.file('schema.mind-map', schema)
zip.file('docs/prd/product-plan.md', productPlan)
zip.file('docs/eng/spec.md', engSpec)
zip.file('docs/research/market.md', market)
const buf = await zip.generateAsync({ type: 'nodebuffer' })
await mkdir(dirname(out), { recursive: true })
await writeFile(out, buf)
console.log(
  'wrote',
  out,
  `(${buf.length} bytes; docs ${productPlan.length}+${engSpec.length}+${market.length} chars)`
)
