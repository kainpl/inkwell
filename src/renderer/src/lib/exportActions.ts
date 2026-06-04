import { useAppStore } from '@renderer/store/useAppStore'
import { renderDocumentHtml, renderPlainText, type RenderDocOptions } from './exportRender'
import { clampMode } from './themes'
import { pdfOptions } from './pageSetup'

/** Output file name derived from the current document name (or "document"). */
function outName(ext: string): string {
  const name = useAppStore.getState().doc.name || 'document'
  return name.replace(/\.[^./\\]*$/, '') + '.' + ext
}

/**
 * When the export style is "match theme", build a CSS override that maps the
 * active theme's tokens onto the print stylesheet (read live so external themes
 * work too), and report whether to use the dark code-highlight theme.
 */
function exportThemeCss(): { css: string; dark: boolean } | null {
  const { exportStyle, theme, mode, externalThemes } = useAppStore.getState()
  if (exportStyle !== 'theme') return null
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string): string => cs.getPropertyValue(name).trim()
  const css =
    `:root{ --ink:rgb(${v('--ink')}); --muted:rgb(${v('--muted')}); ` +
    `--line:rgb(${v('--line')}); --accent:rgb(${v('--accent')}); --code-bg:rgb(${v('--chrome')}); }\n` +
    `body{ background:rgb(${v('--paper')}); color:rgb(${v('--ink')}); }`
  return { css, dark: clampMode(theme, mode, externalThemes) === 'dark' }
}

/** Optional user export stylesheet (themes/export.user.css), or '' if absent. */
async function exportUserCss(): Promise<string> {
  try {
    return (await window.api.readThemeCss('export')).themeUser ?? ''
  } catch {
    return ''
  }
}

/** Render document HTML with the configured export style (theme + user CSS) applied. */
async function buildExportHtml(content: string, opts: RenderDocOptions): Promise<string> {
  const themed = exportThemeCss()
  const userCss = await exportUserCss()
  const themeCss = [themed?.css, userCss].filter(Boolean).join('\n\n') || undefined
  const { markdownFeatures: features, allowEmbeds } = useAppStore.getState()
  return renderDocumentHtml(content, { ...opts, themeCss, dark: themed?.dark, features, allowEmbeds })
}

/** Export the current document as standalone HTML (with or without styles). */
export async function exportHtmlFile(styled: boolean): Promise<void> {
  const { doc, embedImages } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, { docPath: doc.path, styled, embed: embedImages })
  await window.api.exportHtml(html, outName('html'))
}

/** Export the current document as a PDF using the configured page setup. */
export async function exportPdfFile(): Promise<void> {
  const { doc, pageSetup } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, {
    docPath: doc.path,
    styled: true,
    breakBeforeH1: pageSetup.breakBeforeH1
  })
  await window.api.exportPdf(html, pdfOptions(pageSetup), outName('pdf'))
}

/** Copy the raw Markdown source to the clipboard. */
export async function copyAsMarkdown(): Promise<void> {
  await window.api.clipboardWrite({ text: useAppStore.getState().doc.content })
}

/** Copy the rendered document as HTML (formatting carries into Word / Docs). */
export async function copyAsHtml(): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.clipboardWrite({ html, text: renderPlainText(doc.content) })
}

/** Copy the document as plain text (Markdown markers stripped). */
export async function copyAsPlainText(): Promise<void> {
  await window.api.clipboardWrite({ text: renderPlainText(useAppStore.getState().doc.content) })
}

/** Export the rendered document as a PNG image. */
export async function exportImageFile(): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.exportImage(html, outName('png'))
}

/** Copy the rendered document as a PNG image to the clipboard. */
export async function copyAsImage(): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.copyImage(html)
}

/** Output file extension per pandoc format. */
const PANDOC_EXT: Record<string, string> = {
  docx: 'docx',
  odt: 'odt',
  rtf: 'rtf',
  epub: 'epub',
  latex: 'tex'
}

/** Export the document to a pandoc format (docx/odt/rtf/epub/latex). */
export async function exportPandocFile(format: string): Promise<void> {
  const { doc } = useAppStore.getState()
  const ext = PANDOC_EXT[format] ?? format
  await window.api.exportPandoc(doc.content, format, ext, doc.path, outName(ext))
}

/** Print the current document (system print dialog). */
export async function printDocument(): Promise<void> {
  const { doc, pageSetup } = useAppStore.getState()
  const html = await buildExportHtml(doc.content, {
    docPath: doc.path,
    styled: true,
    breakBeforeH1: pageSetup.breakBeforeH1
  })
  await window.api.printDoc(html, pdfOptions(pageSetup))
}
