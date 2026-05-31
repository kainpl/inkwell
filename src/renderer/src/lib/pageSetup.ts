import type { PdfOptions } from '@shared/ipc'

/**
 * Page Setup for Print / Export PDF. Pure mapping + localStorage persistence so
 * it can be unit-tested without Electron.
 */

export type Paper = 'A4' | 'Letter' | 'A5' | 'Custom'

export interface PageSetup {
  paper: Paper
  /** Custom paper size in millimetres (used when paper === 'Custom'). */
  customW: number
  customH: number
  /** Uniform page margin in millimetres. */
  margin: number
  orientation: 'portrait' | 'landscape'
  /** Start each H1 (except the first) on a new page. */
  breakBeforeH1: boolean
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  paper: 'A4',
  customW: 210,
  customH: 297,
  margin: 20,
  orientation: 'portrait',
  breakBeforeH1: false
}

const MM_PER_INCH = 25.4

/** Map a PageSetup to `printToPDF` options (sizes/margins in inches). */
export function pdfOptions(s: PageSetup): PdfOptions {
  const m = s.margin / MM_PER_INCH
  return {
    landscape: s.orientation === 'landscape',
    printBackground: true,
    margins: { marginType: 'custom', top: m, bottom: m, left: m, right: m },
    pageSize:
      s.paper === 'Custom'
        ? { width: s.customW / MM_PER_INCH, height: s.customH / MM_PER_INCH }
        : s.paper
  }
}

const KEY = 'inkwell.pageSetup'

export function loadPageSetup(): PageSetup {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_PAGE_SETUP, ...(JSON.parse(raw) as Partial<PageSetup>) } : DEFAULT_PAGE_SETUP
  } catch {
    return DEFAULT_PAGE_SETUP
  }
}

export function savePageSetup(s: PageSetup): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable — non-fatal */
  }
}
