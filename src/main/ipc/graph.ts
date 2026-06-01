import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { IPC } from '../../shared/ipc'
import { buildNoteGraph, type NoteGraph } from '../../shared/noteGraph'

/** Read every markdown note under `folder` and build its wiki-link graph. */

const MD = /\.(md|markdown|mdown|mkd)$/i

async function collect(dir: string, notes: { name: string; content: string }[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null)
  if (!entries) return
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collect(full, notes)
    } else if (MD.test(entry.name)) {
      const content = await fs.readFile(full, 'utf8').catch(() => '')
      notes.push({ name: entry.name, content })
    }
  }
}

export function registerGraphIpc(): void {
  ipcMain.handle(IPC.noteGraph, async (_e, folder: string): Promise<NoteGraph> => {
    const notes: { name: string; content: string }[] = []
    await collect(folder, notes)
    return buildNoteGraph(notes)
  })
}
