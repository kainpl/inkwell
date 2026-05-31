import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
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

export function registerExportIpc(): void {
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

  ipcMain.handle(IPC.printDoc, async (_e, html: string): Promise<boolean> => {
    const { win, cleanup } = await offscreen(html)
    return new Promise<boolean>((resolve) => {
      win.webContents.print({ printBackground: true }, (success) => {
        cleanup()
        resolve(success)
      })
    })
  })
}
