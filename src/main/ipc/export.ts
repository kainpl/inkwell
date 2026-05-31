import { ipcMain, dialog, BrowserWindow, app, clipboard } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { execFile } from 'child_process'
import { IPC, type PdfOptions } from '../../shared/ipc'

/**
 * Export / print. The renderer produces fully static, sanitized HTML (math and
 * diagrams already SVG, images embedded, CSS inlined); here we just write it to
 * a file, or load it into a hidden window with scripts disabled for print/PDF.
 */

/** Load static HTML into a hidden (JS-disabled) window via a temp file. */
async function offscreen(html: string): Promise<{ win: BrowserWindow; cleanup: () => void }> {
  const tmp = join(app.getPath('temp'), `inkwell-export-${Date.now()}.html`)
  await fs.writeFile(tmp, html, 'utf-8')
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false }
  })
  await win.loadFile(tmp)
  return {
    win,
    cleanup: () => {
      if (!win.isDestroyed()) win.destroy()
      void fs.unlink(tmp).catch(() => undefined)
    }
  }
}

/** Render static HTML to a full-document PNG via a hidden window + capturePage. */
async function renderToImage(html: string): Promise<Electron.NativeImage> {
  const WIDTH = 932 // body max-width (820) + horizontal padding (2×56)
  const tmp = join(app.getPath('temp'), `inkwell-img-${Date.now()}.html`)
  await fs.writeFile(tmp, html, 'utf-8')
  const win = new BrowserWindow({
    show: false,
    width: WIDTH,
    height: 800,
    webPreferences: { sandbox: true }
  })
  try {
    await win.loadFile(tmp)
    const h: number = await win.webContents.executeJavaScript(
      'Math.min(Math.ceil(document.documentElement.scrollHeight), 16000)'
    )
    win.setContentSize(WIDTH, Math.max(1, h))
    await new Promise((r) => setTimeout(r, 250)) // let layout + paint settle
    return await win.webContents.capturePage()
  } finally {
    if (!win.isDestroyed()) win.destroy()
    void fs.unlink(tmp).catch(() => undefined)
  }
}

/** Whether pandoc is on PATH. */
function pandocAvailable(): Promise<boolean> {
  return new Promise((resolve) => execFile('pandoc', ['--version'], (err) => resolve(!err)))
}

/** Run pandoc with args; rejects with its stderr on failure. */
function runPandoc(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('pandoc', args, { timeout: 120_000 }, (err, _out, errOut) => {
      if (err) reject(new Error(errOut || err.message))
      else resolve()
    })
  })
}

export function registerExportIpc(): void {
  // Write text and/or HTML to the system clipboard (Copy as Markdown/HTML/Plain).
  ipcMain.handle(IPC.clipboardWrite, (_e, data: { text?: string; html?: string }): boolean => {
    clipboard.write(data)
    return true
  })

  ipcMain.handle(IPC.exportImage, async (e, html: string, defaultName: string): Promise<boolean> => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
      defaultPath: defaultName,
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    })
    if (canceled || !filePath) return false
    const img = await renderToImage(html)
    await fs.writeFile(filePath, img.toPNG())
    return true
  })

  ipcMain.handle(IPC.copyImage, async (_e, html: string): Promise<boolean> => {
    clipboard.writeImage(await renderToImage(html))
    return true
  })

  // Export to docx / odt / rtf / epub / latex via pandoc (read Markdown source).
  ipcMain.handle(
    IPC.exportPandoc,
    async (
      e,
      markdown: string,
      format: string,
      ext: string,
      docPath: string | null,
      defaultName: string
    ): Promise<boolean> => {
      const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
      if (!(await pandocAvailable())) {
        await dialog.showMessageBox(parent!, {
          type: 'info',
          message: 'Pandoc is not installed',
          detail: 'Install pandoc from https://pandoc.org to export to this format.'
        })
        return false
      }
      const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
        defaultPath: defaultName,
        filters: [{ name: format.toUpperCase(), extensions: [ext] }]
      })
      if (canceled || !filePath) return false
      const tmp = join(app.getPath('temp'), `inkwell-pandoc-${Date.now()}.md`)
      await fs.writeFile(tmp, markdown, 'utf-8')
      const args = ['-f', 'gfm+tex_math_dollars', '-t', format, '-o', filePath, tmp]
      if (docPath) args.push('--resource-path', dirname(docPath))
      try {
        await runPandoc(args)
        return true
      } catch (err) {
        await dialog.showMessageBox(parent!, {
          type: 'error',
          message: 'Export failed',
          detail: String(err instanceof Error ? err.message : err)
        })
        return false
      } finally {
        void fs.unlink(tmp).catch(() => undefined)
      }
    }
  )

  ipcMain.handle(IPC.exportHtml, async (e, html: string, defaultName: string): Promise<boolean> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })
    if (canceled || !filePath) return false
    await fs.writeFile(filePath, html, 'utf-8')
    return true
  })

  ipcMain.handle(
    IPC.exportPdf,
    async (e, html: string, pdfOptions: PdfOptions, defaultName: string): Promise<boolean> => {
      const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
        defaultPath: defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return false
      const { win, cleanup } = await offscreen(html)
      try {
        const pdf = await win.webContents.printToPDF(pdfOptions as Electron.PrintToPDFOptions)
        await fs.writeFile(filePath, pdf)
      } finally {
        cleanup()
      }
      return true
    }
  )

  // Print: render to a PDF and show it in an in-app window using Chromium's
  // built-in PDF viewer (zoom + print). Electron's webContents.print() goes
  // straight to the system dialog with no preview pane.
  ipcMain.handle(IPC.printDoc, async (e, html: string, pdfOptions: PdfOptions): Promise<boolean> => {
    const { win, cleanup } = await offscreen(html)
    let pdf: Buffer
    try {
      pdf = await win.webContents.printToPDF(pdfOptions as Electron.PrintToPDFOptions)
    } finally {
      cleanup()
    }
    const out = join(app.getPath('temp'), `inkwell-print-${Date.now()}.pdf`)
    await fs.writeFile(out, pdf)

    const preview = new BrowserWindow({
      width: 880,
      height: 1000,
      title: 'Print Preview',
      parent: BrowserWindow.fromWebContents(e.sender) ?? undefined,
      autoHideMenuBar: true,
      show: false,
      webPreferences: { sandbox: true, plugins: true }
    })
    preview.on('closed', () => void fs.unlink(out).catch(() => undefined))
    await preview.loadFile(out)
    preview.show()
    return true
  })
}
