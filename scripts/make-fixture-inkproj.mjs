// Builds resources/fixtures/sample.inkproj — a hand-authored project for
// manual testing + M1 acceptance. Run: node scripts/make-fixture-inkproj.mjs
import JSZip from 'jszip'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'resources', 'fixtures', 'sample.inkproj')

const manifest = {
  format: 'inkproj',
  formatVersion: 1,
  app: 'inkwell',
  appVersion: '0.1.0',
  title: 'Sample Project',
  createdAt: '2026-06-02T10:00:00.000Z',
  schema: 'schema.mind-map',
  linkTypes: {
    'ship-blocker': { label: 'blocks ship', color: '#c0392b', arrow: 'to', directed: true, icon: '🚧' }
  }
}

const schema = `---
title: Sample Project
createdAt: 2026-06-02T10:00:00.000Z
---

# Sample Project <!-- mindmap {"id":"root"} -->

- Services <!-- mindmap {"id":"svc","color":"#4488ff","docs":[{"path":"docs/services.md"}]} -->
  - B2B <!-- mindmap {"id":"b2b","links":[{"id":"e1","to":"task-spec","type":"depends-on"}]} -->
  - B2C <!-- mindmap {"id":"b2c"} -->
- Tasks <!-- mindmap {"id":"tasks"} -->
  - Prepare estimate <!-- mindmap {"id":"task-spec","task":true,"taskStatus":"open","links":[{"id":"e2","to":"svc","type":"ship-blocker"}],"docs":[{"path":"docs/research/notes.md","anchor":"#estimate"}]} -->
`

const services = `# Services

Our service lines.

## B2B

Enterprise deals.
`

const notes = `# Research notes

Intro paragraph.

## Estimate {#estimate}

The estimate breakdown lives here.

A specific finding worth linking. ^blk1
`

const zip = new JSZip()
zip.file('manifest.json', JSON.stringify(manifest, null, 2))
zip.file('schema.mind-map', schema)
zip.file('docs/services.md', services)
zip.file('docs/research/notes.md', notes)
const buf = await zip.generateAsync({ type: 'nodebuffer' })
await mkdir(dirname(out), { recursive: true })
await writeFile(out, buf)
console.log('wrote', out, `(${buf.length} bytes)`)
