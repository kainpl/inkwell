# Phase 6.3 — External `.css` themes + user.css cascade

## Goal

Let users drop `.css` theme files into a folder, pick them in Preferences
alongside the built-ins, and hot-reload on edit. Plus a Typora-style override
cascade: `base.user.css` (always) and `{theme}.user.css` (per active theme).
Builds directly on the `[data-theme]` / CSS-token foundation from 6.2.

## Folder

`userData/themes/`, created on first launch. Seeded with a `README.txt` (token
reference + conventions) and an `example.css` so users have a working template.

## Convention for a theme file

A theme redefines the existing tokens on `:root` (rename-proof — the file is
only injected while active):

```css
/* My Theme. Add the marker on the next line to mark it dark: inkwell: dark */
:root {
  --paper: 253 246 227;  /* "R G B" triplets, used as rgb(var(--token)) */
  --ink: 88 110 117;
  --accent: 38 139 210;
  /* …--muted --faint --line --chrome --syn-keyword/string/number/literal/name/type */
}
```

Dark-ness is opt-in via a marker comment (`inkwell: dark`) in the file head;
detected by `parseThemeDark`. A dark theme also gets the `.dark` class so the
title-bar icon and live-preview mermaid follow.

## Main process — `main/ipc/themes.ts` (`registerThemeIpc`)

- `IPC.listThemes` → scan `themes/*.css` (excluding `*.user.css`) →
  `ExternalTheme[] = { id, label, dark }`. `id` = filename without `.css`.
- `IPC.readThemeCss(id)` → `{ theme, base, themeUser }`: contents of `<id>.css`,
  `base.user.css`, `<id>.user.css` (each `string | null`).
- `IPC.openThemesFolder` → ensure dir + `shell.openPath`.
- `fs.watch(themesDir)` (debounced ~200ms) → broadcast `IPC.themesChanged` to
  every window for hot-reload.
- Security: `id` validated (`isValidThemeId`, no separators / `..`) and the
  resolved path must sit directly inside `themesDir`.

Pure helpers live in `shared/themeFile.ts` (no electron) so they are unit
tested: `isValidThemeId`, `parseThemeDark`, `themeIdToLabel`, `isThemeFile`,
`themeIdFromFile`.

## Renderer — `lib/themeApply.ts` + store

- Store gains `externalThemes: ExternalTheme[]` + `setExternalThemes`.
- `applyTheme(id, external)`: sets `data-theme` + `.dark` **synchronously**
  (no flash), then (guarded by a latest-wins token) injects two `<style>`s:
  - `#ink-theme-css` — the external theme file (empty for built-ins),
  - `#ink-user-css` — `base.user.css` + `{id}.user.css` (applies to built-ins too).
- `startThemeSync()`: apply current theme immediately; fetch `listThemes` →
  `setExternalThemes` → re-apply; re-apply on store `theme` change; refresh +
  re-apply on `onThemesChanged`. Returns cleanup. Owns all theme application
  (the old `App.tsx` data-theme/`.dark` effect is removed).
- `themes.ts` gains `isDarkThemeResolved(id, external)` (built-in `THEMES` first,
  then the external list); `TitleBar` and `livePreview` use it so external dark
  themes resolve correctly.
- `PreferencesModal` Theme dropdown lists built-in `THEMES` + `externalThemes`,
  plus an "Open themes folder…" button.

## IPC / preload

`shared/ipc.ts`: channels `listThemes`, `readThemeCss`, `openThemesFolder`,
`themesChanged` + types `ExternalTheme`, `ThemeCss`. `preload` exposes
`listThemes()`, `readThemeCss(id)`, `openThemesFolder()`, `onThemesChanged(cb)`.

## Out of scope

Theme marketplace / download; editing themes inside the app; non-`:root`
selectors are allowed but undocumented. No Welcome sample (not a Markdown feature).

## Verification

Unit tests for `shared/themeFile.ts` and `themeApply` (jsdom: injection,
`.dark`, latest-wins). Live: drop a `.css` into the folder, switch to it, confirm
injection + hot-reload + that `base.user.css` cascades over a built-in.
