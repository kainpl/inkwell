import { parseOutline } from './outline'

const MD_EXT = /\.(md|markdown|mdown|mkd)$/i

/**
 * The document's display title: its first heading (i.e. the title shown at the
 * top of the outline), or the file name without its markdown extension when the
 * document has no headings.
 */
export function documentTitle(name: string, content: string): string {
  const top = parseOutline(content)[0]?.text.trim()
  if (top) return top
  return name.replace(MD_EXT, '') || name
}

/**
 * Full window / taskbar title: "<display> — Inkwell", prefixed with a bullet
 * when the document has unsaved changes. The display part comes first so a
 * narrow taskbar button truncates to the file/heading, not the app name.
 */
export function windowTitle(name: string, content: string, dirty: boolean): string {
  return `${dirty ? '• ' : ''}${documentTitle(name, content)} - Inkwell`
}
