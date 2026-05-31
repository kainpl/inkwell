import { ipcMain, shell, app } from 'electron'
import { promises as fs } from 'fs'
import { dirname, join, resolve } from 'path'
import { IPC, type TemplateEntry } from '../../shared/ipc'

/** Absolute path of the user's document-templates folder. */
function templatesDir(): string {
  return join(app.getPath('userData'), 'templates')
}

/** A template id is a bare filename stem — reject separators and traversal. */
function isValidId(id: string): boolean {
  return id.trim().length > 0 && !/[/\\]/.test(id) && !id.includes('..')
}

const MEETING = `# Meeting Notes

**Date:**
**Attendees:**

## Agenda
-

## Notes
-

## Action items
- [ ]
`

const BLOG = `# Title

_Draft — written {date}._

## Introduction

## Body

## Conclusion
`

/** Create the templates folder (with examples) if it doesn't exist. */
async function ensureTemplatesDir(): Promise<string> {
  const dir = templatesDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(join(dir, 'Meeting Notes.md'), MEETING, { flag: 'wx' }).catch(() => {})
    await fs.writeFile(join(dir, 'Blog Post.md'), BLOG, { flag: 'wx' }).catch(() => {})
  } catch {
    /* non-fatal */
  }
  return dir
}

export function registerTemplateIpc(): void {
  void ensureTemplatesDir()

  ipcMain.handle(IPC.listTemplates, async (): Promise<TemplateEntry[]> => {
    const dir = await ensureTemplatesDir()
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      return []
    }
    return names
      .filter((n) => n.toLowerCase().endsWith('.md'))
      .map((n) => ({ id: n.replace(/\.md$/i, ''), name: n.replace(/\.md$/i, '') }))
      .filter((t) => isValidId(t.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle(IPC.readTemplate, async (_e, id: string): Promise<string> => {
    if (!isValidId(id)) return ''
    const dir = await ensureTemplatesDir()
    const full = resolve(dir, `${id}.md`)
    if (dirname(full) !== resolve(dir)) return ''
    try {
      return await fs.readFile(full, 'utf8')
    } catch {
      return ''
    }
  })

  ipcMain.handle(IPC.openTemplatesFolder, async (): Promise<void> => {
    await shell.openPath(await ensureTemplatesDir())
  })
}
