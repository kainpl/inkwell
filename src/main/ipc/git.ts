import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC, type GitChanges, type GitResult } from '../../shared/ipc'
import { gitStatusChar, parseGitChanges } from '../../shared/gitStatus'

/**
 * Git integration for the file tree and Source Control panel. Everything runs
 * through `execFile` (no shell) so paths and messages are passed as argv and
 * never interpolated into a command line. Mutations (stage/unstage/commit) run
 * with cwd = the repo root so the porcelain-relative paths line up.
 */

const run = promisify(execFile)

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', cwd, ...args], { windowsHide: true })
  return stdout
}

/** Resolve the repo root for a folder, or null if it is not a git repo. */
async function repoTop(folder: string): Promise<string | null> {
  try {
    return (await git(folder, ['rev-parse', '--show-toplevel'])).trim()
  } catch {
    return null
  }
}

export function registerGitIpc(): void {
  // Read-only status for the file-tree badges (path → single status char).
  ipcMain.handle(IPC.gitStatus, async (_e, folder: string): Promise<Record<string, string> | null> => {
    const top = await repoTop(folder)
    if (!top) return null
    try {
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
      return null
    }
  })

  // Detailed staged/unstaged lists for the Source Control panel.
  ipcMain.handle(IPC.gitChanges, async (_e, folder: string): Promise<GitChanges> => {
    const top = await repoTop(folder)
    if (!top) return { branch: null, staged: [], unstaged: [] }
    try {
      const out = await git(top, ['status', '--porcelain=v1', '--branch', '--untracked-files=all'])
      return parseGitChanges(out)
    } catch {
      return { branch: null, staged: [], unstaged: [] }
    }
  })

  // Stage the given repo-relative paths (handles modifications and deletions).
  ipcMain.handle(IPC.gitStage, async (_e, folder: string, paths: string[]): Promise<GitResult> => {
    return mutate(folder, (top) => git(top, ['add', '-A', '--', ...paths]))
  })

  // Unstage the given repo-relative paths (restore them in the index).
  ipcMain.handle(IPC.gitUnstage, async (_e, folder: string, paths: string[]): Promise<GitResult> => {
    return mutate(folder, (top) => git(top, ['reset', '-q', '--', ...paths]))
  })

  // Commit the staged changes with the given message.
  ipcMain.handle(IPC.gitCommit, async (_e, folder: string, message: string): Promise<GitResult> => {
    return mutate(folder, (top) => git(top, ['commit', '-m', message]))
  })
}

/** Resolve the repo root, run a mutation, and normalise success/error. */
async function mutate(folder: string, fn: (top: string) => Promise<string>): Promise<GitResult> {
  const top = await repoTop(folder)
  if (!top) return { ok: false, error: 'Not a git repository.' }
  try {
    await fn(top)
    return { ok: true }
  } catch (e) {
    const err = e as { stderr?: string; message?: string }
    return { ok: false, error: (err.stderr || err.message || 'git failed').trim() }
  }
}
