/**
 * Text encodings offered by File → Reopen with Encoding. Shared so the native
 * menu (main) and the IPC handler agree on the list. Every `id` is a label the
 * WHATWG `TextDecoder` understands — Node 18+ ships full ICU, so legacy code
 * pages (windows-1251, shift_jis, gbk, …) decode without an extra dependency.
 */

export interface Encoding {
  /** A WHATWG encoding label accepted by `new TextDecoder(id)`. */
  id: string
  /** Human label for the menu. */
  label: string
}

export const ENCODINGS: Encoding[] = [
  { id: 'utf-8', label: 'UTF-8' },
  { id: 'utf-16le', label: 'UTF-16 LE' },
  { id: 'utf-16be', label: 'UTF-16 BE' },
  { id: 'windows-1251', label: 'Windows-1251 (Cyrillic)' },
  { id: 'windows-1252', label: 'Windows-1252 (Western)' },
  { id: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { id: 'iso-8859-2', label: 'ISO-8859-2 (Latin-2)' },
  { id: 'koi8-r', label: 'KOI8-R (Cyrillic)' },
  { id: 'shift_jis', label: 'Shift_JIS (Japanese)' },
  { id: 'gbk', label: 'GBK (Simplified Chinese)' },
  { id: 'big5', label: 'Big5 (Traditional Chinese)' },
  { id: 'euc-kr', label: 'EUC-KR (Korean)' },
  { id: 'macintosh', label: 'Macintosh Roman' }
]

/** Whether `id` is one of the offered encodings (validates an IPC argument). */
export function isEncoding(id: string): boolean {
  return ENCODINGS.some((e) => e.id === id)
}

/**
 * Decode raw bytes with the given encoding, falling back to UTF-8 for an
 * unknown id. Non-fatal: invalid sequences become the replacement character
 * rather than throwing, so a wrong guess shows mojibake instead of failing.
 */
export function decode(bytes: Uint8Array, id: string): string {
  const label = isEncoding(id) ? id : 'utf-8'
  return new TextDecoder(label, { fatal: false }).decode(bytes)
}
