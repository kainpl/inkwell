import { useAppStore } from '@renderer/store/useAppStore'
import { renderDocumentHtml, renderPlainText } from './exportRender'
import { pdfOptions } from './pageSetup'

/** Output file name derived from the current document name (or "document"). */
function outName(ext: string): string {
  const name = useAppStore.getState().doc.name || 'document'
  return name.replace(/\.[^./\\]*$/, '') + '.' + ext
}

/** Export the current document as standalone HTML (with or without styles). */
export async function exportHtmlFile(styled: boolean): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await renderDocumentHtml(doc.content, { docPath: doc.path, styled })
  await window.api.exportHtml(html, outName('html'))
}

/** Export the current document as a PDF using the configured page setup. */
export async function exportPdfFile(): Promise<void> {
  const { doc, pageSetup } = useAppStore.getState()
  const html = await renderDocumentHtml(doc.content, {
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
  const html = await renderDocumentHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.clipboardWrite({ html, text: renderPlainText(doc.content) })
}

/** Copy the document as plain text (Markdown markers stripped). */
export async function copyAsPlainText(): Promise<void> {
  await window.api.clipboardWrite({ text: renderPlainText(useAppStore.getState().doc.content) })
}

/** Export the rendered document as a PNG image. */
export async function exportImageFile(): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await renderDocumentHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.exportImage(html, outName('png'))
}

/** Copy the rendered document as a PNG image to the clipboard. */
export async function copyAsImage(): Promise<void> {
  const { doc } = useAppStore.getState()
  const html = await renderDocumentHtml(doc.content, { docPath: doc.path, styled: true })
  await window.api.copyImage(html)
}

/** Print the current document (system print dialog). */
export async function printDocument(): Promise<void> {
  const { doc, pageSetup } = useAppStore.getState()
  const html = await renderDocumentHtml(doc.content, {
    docPath: doc.path,
    styled: true,
    breakBeforeH1: pageSetup.breakBeforeH1
  })
  await window.api.printDoc(html, pdfOptions(pageSetup))
}
