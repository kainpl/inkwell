# Phase 9 — Git status in the file tree

Show each file's git status as a small badge in the tree (modified / new /
deleted …). Read-only this slice; staging/commit is a later slice.

## Main — `main/ipc/git.ts`

`gitStatus(folder)` runs `git -C <folder> rev-parse --show-toplevel` and
`git status --porcelain --untracked-files=all` (via `execFile`, no shell). It
maps each entry to a single status char and an **absolute, forward-slash** path
(git emits `/`; Node tree paths get normalised the same way for lookup):

- `??` → `?` (untracked) · `A` → added · `M` → modified · `D` → deleted ·
  `R` → renamed · conflicts → `U`.

Returns `Record<path, char>` (empty when clean) or `null` when the folder isn't a
git repo / git is unavailable.

## Renderer

- `shared/ipc.ts` channel + `preload.gitStatus`.
- Store: `gitStatus: Record<string, string>` + `setGitStatus`.
- `lib/git.ts`: `refreshGitStatus()` (reads `root`, calls the IPC, stores the
  map); `startGitSync()` re-fetches when the open folder changes. Mounted in App;
  also refreshed after a save.
- `FileTree` rows show a coloured badge for `gitStatus[node.path]` (paths
  normalised to `/`): green new/added, amber modified, red deleted, blue renamed.

## Verification

Live: open this repo, edit + save a file, and confirm its tree row gets an `M`
badge; an untracked file shows `?`.
