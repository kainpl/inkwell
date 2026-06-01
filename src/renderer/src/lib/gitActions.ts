import { useAppStore } from '@renderer/store/useAppStore'
import { refreshGitStatus } from '@renderer/lib/git'
import type { GitChanges, GitResult } from '@shared/ipc'

/**
 * Source Control actions for the open folder. Reads detailed staged/unstaged
 * changes and runs stage/unstage/commit through `window.api`. Every successful
 * mutation also refreshes the file-tree badges so the two stay in sync.
 */

const EMPTY: GitChanges = { branch: null, ahead: 0, behind: 0, staged: [], unstaged: [] }

export async function fetchGitChanges(): Promise<GitChanges> {
  const root = useAppStore.getState().root
  if (!root) return EMPTY
  return window.api.gitChanges(root.path).catch(() => EMPTY)
}

export function stagePaths(paths: string[]): Promise<GitResult> {
  return runGit((root) => window.api.gitStage(root, paths))
}

export function unstagePaths(paths: string[]): Promise<GitResult> {
  return runGit((root) => window.api.gitUnstage(root, paths))
}

export function commitStaged(message: string): Promise<GitResult> {
  return runGit((root) => window.api.gitCommit(root, message))
}

export function pushBranch(): Promise<GitResult> {
  return runGit((root) => window.api.gitPush(root))
}

export function pullBranch(): Promise<GitResult> {
  return runGit((root) => window.api.gitPull(root))
}

async function runGit(fn: (root: string) => Promise<GitResult>): Promise<GitResult> {
  const root = useAppStore.getState().root
  if (!root) return { ok: false, error: 'No folder open.' }
  const res = await fn(root.path).catch((e: unknown) => ({ ok: false, error: String(e) }))
  if (res.ok) await refreshGitStatus()
  return res
}
