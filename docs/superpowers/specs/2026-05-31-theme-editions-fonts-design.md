# Theme light/dark editions + JetBrains Mono

## Goal

Make each theme an umbrella with up to two **editions** (light / dark) instead of
a theme being inherently one or the other. A `mode` selects the active edition;
the title-bar button toggles it and is disabled when the theme has only one
edition. Also bundle **JetBrains Mono** as a real editor-font option.

## State model

- `theme: string` — the theme **name** (`inkwell`, `github`, `newsprint`,
  `pixyll`, `tokyo`).
- `mode: 'light' | 'dark'` — the active edition.
- Active appearance = the theme's edition for `mode`, **clamped** to what the
  theme actually provides (`clampMode`). The `.dark` class follows the clamped
  mode.

The standalone `Light`/`Dark` themes are gone — they become the two editions of
the default **Inkwell** theme. `Night` is renamed **Tokyo** (it now also has a
light edition, so the name must not imply darkness).

## Built-in lineup (all light + dark)

| id | label | light | dark |
|----|-------|-------|------|
| `inkwell` | Inkwell | warm off-white (old Light) | warm dark (old Dark) |
| `github` | GitHub | current | GitHub-dark |
| `newsprint` | Newsprint | sepia | dark sepia |
| `pixyll` | Pixyll | minimal white | minimal dark |
| `tokyo` | Tokyo | Tokyo Day | Tokyo Night (old Night) |

## CSS

`:root` / `.dark` stay as Inkwell's two editions. Every other theme:

```css
[data-theme="github"] { …light tokens… }
[data-theme="github"].dark { …dark tokens… }
```

`[data-theme]` (0,1,0) wins the light edition over `:root` by order;
`[data-theme].dark` (0,2,0) wins the dark edition over `.dark`.

## Registry (`lib/themes.ts`)

`ThemeDef = { id, label, light, dark }`. Helpers replace `isDarkTheme*`:
- `themeEditions(id, external) → { light, dark }`
- `clampMode(id, mode, external) → 'light' | 'dark'` (requested mode if
  available, else the other, else light)

`TitleBar` / `livePreview` / export use `clampMode(...) === 'dark'`.

## External themes

A `.css` may define both editions in one file:

```css
:root { …light… }
:root.dark { …dark… }
```

`shared/themeFile.ts` `parseThemeEditions(css) → { light, dark }` detects them
(`:root.dark` / `.dark` → dark; a plain `:root` → light; the legacy
`inkwell: dark` marker → dark only). `ExternalTheme` gains `light`/`dark`. The
folder README/example show the dual-edition convention. The toggle is disabled
for an external theme that ships only one edition.

## Fonts

`npm i @fontsource/jetbrains-mono`; import `400.css` + `700.css` in the renderer
(self-hosted woff2, served same-origin → fine under `font-src 'self'`).
`EditorFont` gains `'jetbrains'`; `FONT_STACKS.jetbrains =
'"JetBrains Mono", ui-monospace, …'`; a 4th dropdown option.

## Migration

`settings.ts` adds `mode` (default `light`). `sanitize` migrates stale theme ids:
`light → {inkwell, light}`, `dark → {inkwell, dark}`, `night → {tokyo, dark}`;
unknown → `{inkwell, light}`; known ids keep their id and clamp `mode`.

## Verification

Unit tests: `themes.ts` (editions/clampMode), `themeFile.ts`
(parseThemeEditions), `settings.ts` (migration), `markdownFeatures` untouched.
Live: screenshot each theme in both editions; confirm the toggle flips editions
and is disabled for a one-edition external theme; confirm JetBrains Mono renders.
