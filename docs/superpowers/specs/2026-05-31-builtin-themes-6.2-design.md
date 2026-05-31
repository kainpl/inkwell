# Phase 6.2 — Built-in themes

## Goal

Ship several built-in editor themes, selectable in Preferences ▸ Appearance ▸
Theme (and the quick light/dark toggle in the title bar). Each theme is a set of
CSS-variable values over the tokens already defined in `index.css`
(`--paper`, `--ink`, `--muted`, `--faint`, `--line`, `--accent`, `--chrome`,
`--syn-*`). Lays the groundwork for external `.css` themes (6.3).

## Model

`theme` widens from `'light' | 'dark'` to a **theme id** (string). A registry in
`lib/themes.ts` is the single source of truth:

```ts
interface ThemeDef { id: string; label: string; dark: boolean }
const THEMES = [
  { id: 'light',     label: 'Light',     dark: false }, // :root
  { id: 'dark',      label: 'Dark',      dark: true  }, // .dark
  { id: 'github',    label: 'GitHub',    dark: false },
  { id: 'newsprint', label: 'Newsprint', dark: false },
  { id: 'night',     label: 'Night',     dark: true  },
  { id: 'pixyll',    label: 'Pixyll',    dark: false },
]
isDarkTheme(id)  // dark flag, unknown → false
isKnownTheme(id) // membership, for settings migration
```

## Applying a theme

One effect in `App.tsx`:

```ts
root.dataset.theme = theme                        // [data-theme="github"]
root.classList.toggle('dark', isDarkTheme(theme)) // .dark stays for components
```

Palettes are `[data-theme="x"] { --paper: …; … }` blocks in `@layer base`,
placed **after** `:root`/`.dark` so the attribute selector (equal specificity)
wins by source order. `light`/`dark` need no block — they fall back to
`:root`/`.dark`. Dark-based themes (`night`) set both `.dark` (component styling)
and `[data-theme="night"]` (its specific palette, which overrides `.dark`).

## Touch points

- `lib/themes.ts` (new): registry + `isDarkTheme` + `isKnownTheme`.
- `lib/settings.ts`: `theme: string`; `sanitize` maps an unknown id → `light`.
- `store/useAppStore.ts`: widen `theme`/`setTheme` to string; `toggleTheme`
  stays a quick `light ↔ dark` switch (full set lives in Preferences).
- `App.tsx`: set `data-theme` + `.dark`.
- `components/PreferencesModal.tsx`: Theme `<select>` maps `THEMES`.
- `lib/mermaidRender.ts`: `isDarkTheme(theme)` instead of `theme === 'dark'`.
- `index.css`: `[data-theme]` palette blocks for github / newsprint / night /
  pixyll.

## Out of scope (later 6.x)

External `.css` theme loading + `base.user.css` cascade (6.3); Markdown feature
flags. No Welcome sample (themes are not a Markdown rendering feature).

## Verification

typecheck / lint / unit tests, plus a live screenshot of each theme (editor +
chrome) — palettes must be eyeballed.
