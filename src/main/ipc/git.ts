import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC } from '../../shared/ipc'
import { gitStatusChar } from '../../shared/gitStatus'

/**
 * Read-only git status for the file tree. Runs `git status --porcelain` in the
 * open folder (via execFile — no shell) and maps each changed path to a single
 * status char keyed by its absolute, forward-slash path (so it matches tree
 * node paths once those are normalised).
 */

const run = promisify(execFile)

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', cwd, ...args], { windowsHide: true })
  return stdout
}

export function registerGitIpc(): void {
  ipcMain.handle(IPC.gitStatus, async (_e, folder: string): Promise<Record<string, string> | null> => {
    try {
      const top = (await git(folder, ['rev-parse', '--show-toplevel'])).trim()
      const out = await git(folder, ['status', '--porcelain', '--untracked-files=all'])
      const map: Record<string, string> = {}
      for (const line of out.split('\n')) {
        if (line.length < 4) continue
        const code = line.slice(0, 2)
        let rel = line.slice(3).trim()
        if (rel.includes(' -> ')) rel = rel.split(' -> ')[1] // renamed: take the new path
        rel = rel.replace(/^"|"$/g, '')
        map[`${top}/${rel}`.replace(/\\/g, '/')] = gitStatusChar(code)
      }
      return map
    } catch {
      return null // not a repo, or git unavailable
    }
  })
}
