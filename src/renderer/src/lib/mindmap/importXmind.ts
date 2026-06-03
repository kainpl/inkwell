import JSZip from 'jszip'
import type { MarkdownNode } from '@shared/mindmap/types'
import { cleanImportedOutline, type ImportResult } from './importFormats'

/**
 * Import a real `.xmind` (a ZIP, not the legacy `.mm`). Prefers `content.json`
 * (XMind Zen / 2018+: `[ { rootTopic } ]`, subtopics under `children.attached[]`),
 * falling back to `content.xml` (XMind 8). A topic's `notes.plain.content` rides along
 * as `data.note` (the subtitle). Only the first sheet is imported.
 */
export async function importXmind(bytes: Uint8Array): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(bytes)
  const find = (suffix: string): JSZip.JSZipObject | undefined =>
    Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(suffix))
  const json = find('content.json')
  if (json) return parseXmindJson(await json.async('string'))
  const xml = find('content.xml')
  if (xml) return parseXmindXml(await xml.async('string'))
  throw new Error('Unsupported .xmind (no content.json or content.xml)')
}

// ── helpers ───────────────────────────────────────────────────────────────

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

// ── content.json (XMind Zen) ────────────────────────────────────────────────

function topicNote(t: Record<string, unknown>): string {
  return asStr(asObj(asObj(t.notes).plain).content)
}

function convJsonTopic(t: Record<string, unknown>): MarkdownNode {
  const attached = asObj(t.children).attached
  const children = Array.isArray(attached) ? attached.map((c) => convJsonTopic(asObj(c))) : []
  const note = topicNote(t)
  return { name: asStr(t.title), children, data: note ? { note } : undefined }
}

function parseXmindJson(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid .xmind: malformed content.json')
  }
  const sheet = asObj(Array.isArray(data) ? data[0] : data)
  const root = sheet.rootTopic
  if (!root) throw new Error('Unsupported .xmind (no rootTopic)')
  const outline = cleanImportedOutline([convJsonTopic(asObj(root))])
  return { title: outline[0]?.name || asStr(sheet.title) || 'Mind Map', outline }
}

// ── content.xml (XMind 8) ────────────────────────────────────────────────────

const directChildren = (el: Element, tag: string): Element[] =>
  Array.from(el.children).filter((c) => c.tagName.toLowerCase() === tag.toLowerCase())
const directChild = (el: Element, tag: string): Element | null => directChildren(el, tag).at(0) ?? null

function convXmlTopic(el: Element): MarkdownNode {
  const name = directChild(el, 'title')?.textContent?.trim() ?? ''
  const topics = directChild(el, 'children')
    ? directChild(directChild(el, 'children')!, 'topics')
    : null
  const children = topics ? directChildren(topics, 'topic').map(convXmlTopic) : []
  return { name, children }
}

function parseXmindXml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid .xmind: malformed content.xml')
  const sheet = doc.querySelector('sheet')
  const root = sheet ? directChild(sheet, 'topic') : null
  if (!root) throw new Error('Unsupported .xmind (no root topic)')
  const outline = cleanImportedOutline([convXmlTopic(root)])
  return { title: outline[0]?.name || 'Mind Map', outline }
}
