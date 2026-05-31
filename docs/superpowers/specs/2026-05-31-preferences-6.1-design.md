# 6.1 — Preferences panel + typography

Date: 2026-05-31 · Status: approved

First slice of Phase 6. Builds the Preferences panel (the home for all settings)
and adds editor **typography** (font, size, line height, content width). Existing
scattered settings are surfaced here, and all Preferences-managed settings now
**persist** to localStorage.

## Settings persistence (`lib/settings.ts`)

A pure module: `Settings` interface, `DEFAULT_SETTINGS`, `FONT_STACKS`,
`loadSettings()` / `saveSettings(s)` (one localStorage key, merge onto defaults).
Persisted fields: `theme`, `autoSave`, `lineEnding`, `insertFinalNewline`,
`formatBarOpen`, `imageUploadCommand`, `editorFont` (`system|sans|serif|mono`),
`editorFontSize` (px), `editorLineHeight`, `contentWidth` (px), `embedImages`.
Unit-tested.

The store initialises these fields from `loadSettings()`. A renderer
`startSettingsSync()` subscribes to the store, and on change (a) re-applies the
typography CSS variables and (b) writes the settings — guarded by a shallow diff
so doc edits don't trigger writes.

## Typography → CSS variables

`startSettingsSync()` sets on `documentElement`: `--ink-editor-font` (from
`FONT_STACKS`), `--ink-editor-size`, `--ink-editor-leading`, `--ink-content-width`.
`index.css` `.cm-content` consumes them and centres the column
(`max-width: var(--ink-content-width); margin: 0 auto`). Defaults: system font,
16px, 1.7 line height, 820px width (matching the export column).

## Preferences panel (`components/PreferencesModal.tsx`)

Modal opened by **Edit → Preferences… (`Ctrl/⌘ ,`)**. Left section list, right
content pane. Sections:

- **Appearance** — theme (light/dark); editor font (System/Sans/Serif/Mono),
  size, line height, content width.
- **Editor** — Auto Save, Line Endings (LF/CRLF), Insert Final Newline,
  Formatting Bar (existing store actions).
- **Image** — image upload command (existing).
- **Export** — "Page Setup…" (opens the existing modal) + **Embed images in
  exported HTML** toggle (the 5.5 export setting).

All controls read/write the store; changes apply live and persist.

## Export embed toggle

`renderDocumentHtml` gains an `embed` option (default true). When off,
`embedImages` is skipped — local images stay as links. `exportActions` passes
`embedImages` from the store for HTML export.

## Menu / IPC

Add `menuPreferences` channel + `Ctrl/⌘ ,`; the modal opens on it.

## Out of scope (later Phase 6)

Markdown feature flags (need conditional wiring in `livePreview`); built-in
themes (6.2); external `.css` themes + `user.css` cascade (6.3).

## Testing

`settings` load/save/merge + defaults; `renderDocumentHtml({embed:false})` leaves
local image src untouched. Panel behaviour via the UI.
