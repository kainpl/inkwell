# File Tabs — Design

Date: 2026-05-31 · Status: approved

## Goal

Multi-document editing via a tab bar. Each open file is a tab; tabs show a
**dirty indicator** and a **× close** button. The tab bar is **always visible**
(even with a single tab). Switching tabs preserves each tab's **full editor
state** — content, undo history, cursor, and scroll.

## State (`useAppStore`)

- `tabs: Tab[]` where `Tab = { id: string; path: string | null; name: string; content: string; dirty: boolean }`.
  Each tab is a full `DocState` plus an `id`. `content` is the text snapshot,
  kept in sync with the active tab's live editor on every edit.
- `activeId: string`.
- `doc: DocState` stays as a **mirror of the active tab** (`path/name/content/dirty`)
  so existing consumers (TitleBar, StatusBar, save, autosave, drafts, watcher,
  outline, versions) keep working unchanged. `doc` always equals the active tab.
- Per-tab CM `EditorState` (undo history + selection + scroll) lives in a
  `Map<id, EditorState>` **inside the Editor component**, not in the store
  (EditorState is heavy and non-serializable). Its document text matches the
  tab's `content`; the map adds the history/cursor that `content` alone can't carry.

### Actions

- `openDocInTab(file)` — if a tab with the same non-null `path` exists, activate
  it (no duplicates); otherwise create a tab and activate it.
- `newTab()` — create an Untitled tab and activate it.
- `activateTab(id)` — set `activeId`; mirror that tab into `doc`.
- `closeTab(id)` — remove it; if it was active, activate the right neighbour
  (else left); if none remain, open a fresh Welcome tab.
- Existing `setContent` / `markSaved` / `loadDoc` operate on the active tab and
  mirror into `tabs[active]`. `newDoc` becomes `newTab`.

## Editor integration

One `EditorView`. A `useEffect` watches `activeId`:

1. `editorStates.set(prevId, view.state)` — save outgoing tab.
2. `view.setState(editorStates.get(newId) ?? makeState(activeContent))`.
3. Re-apply global modes (Source / Typewriter) to the new state.
4. Update `prevId` and the echo-guard `lastPushed`.

A `suppress` flag wraps the swap so the content-sync `updateListener` and the
store→view push don't fire spuriously during a switch. The active tab's edits
continue to mirror into `doc.content` (and thus `tabs[active].content`).

## Tab bar (`TabBar.tsx`)

Horizontal row **between TitleBar and the formatting Toolbar**, always shown.
Each tab: name + a dirty dot (when `dirty`) + a **×** button. Active tab
highlighted. Click = activate; middle-click or × = close (guarded if dirty).
Overflow scrolls horizontally.

## Integration with existing flows

- Opening a file (dialog / file tree / Quick Open / global search / reopen) →
  `openDocInTab`. Opening **adds** a tab and discards nothing, so the unsaved
  guard is no longer needed on open — it moves to **closing** a tab.
- `New` → `newTab` (no guard).
- `File → Close` → close the active tab (guard if dirty).
- `File → Close Folder` → close all tabs + clear folder → fresh Welcome tab.
- **Window close**: renderer reports `anyDirty` via `setDirty`. On `tryClose`,
  iterate dirty tabs — activate each, prompt Save / Don't Save / Cancel; Cancel
  aborts the close. All resolved → `closeWindow`.
- Autosave / drafts / disk watcher / versions / session restore act on the
  active `doc`, unchanged. Session restore still reopens only the last active
  file (one tab), per decision.

## Out of scope (v1)

- Restoring all open tabs on relaunch (only the active file is restored).
- Drag-to-reorder tabs.
- Watching inactive tabs for external disk changes.

## Testing

- Pure store-tab logic (open/activate/close/dedup-by-path, neighbour selection
  on close, last-close → welcome) as unit tests on a `tabsModel` helper.
- Existing suites must stay green (the `doc` mirror keeps consumers working).
