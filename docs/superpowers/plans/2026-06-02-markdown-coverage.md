# Markdown coverage — design & plan

**Goal:** Close the gap between markdownguide.org (Basic + Extended syntax) and
Inkwell so that every standard Markdown construct is (1) rendered in the live
editor + export and (2) insertable via a Toolbar button / Format menu / command
palette.

**Branch:** `feat/markdown-coverage`

## Gap analysis (from research against markdownguide.org)

**Render gaps** (not read today):
- Heading IDs `### H {#id}`
- Definition lists (`Term` / `: definition`)
- Bare-URL autolinking inside the editor (export already linkifies)

**UI gaps** (rendered already, but no way to insert via button/menu):
- Footnotes `[^1]`, Subscript `~x~`, Superscript `^x^`, Math `$…$` / `$$…$$`,
  Mermaid ` ```mermaid `, Alerts `> [!NOTE]`, TOC `[toc]`, Headings 4–6.

## Decisions

- New `FormatAction`s flow through `applyFormat()` (`formatCommands.ts`) and are
  surfaced in `menu.ts` (Format), `commands.ts` (palette) and `Toolbar.tsx`.
- **Alerts**: a Format ▸ Alert submenu with NOTE / TIP / IMPORTANT / WARNING /
  CAUTION (`alert:note` … action ids).
- **Math**: inline (`$…$` wrap) + block (`$$` block).
- New render features get `markdownFeatures` flags: `headingIds`, `defList`.
  Bare-URL autolinking is always on (matches export `linkify: true`).
- **Export**: hand-rolled heading-id core rule (no dep); add `markdown-it-deflist`
  for definition lists (one small dep).
- **Welcome.md** gains samples for the new render features (heading IDs, deflist,
  bare URL). Math/footnote/sub/sup/etc. already have samples.

## Phases (inline, TDD on pure parts, commit per phase)

- **P1 — Insert UI for already-rendered features.** Add FormatActions: `h4 h5 h6`,
  `sub`, `sup`, `mathInline`, `mathBlock`, `mermaid`, `footnote`, `toc`,
  `alert:note|tip|important|warning|caution`. Unit-test the pure insert helpers.
  Wire menu + commands + toolbar.
- **P2a — Bare-URL autolink in the editor.** Regex decoration in `livePreview`
  (style + Ctrl/Cmd-click open), TDD via `buildDecorations`. Welcome sample.
- **P2b — Heading IDs.** `headingIds` flag; live-preview hides `{#id}` on idle
  heading lines; export sets the heading `id`; outline strips `{#id}` from the
  display text. Tests + Welcome sample.
- **P2c — Definition lists.** `defList` flag; live-preview styles `Term` / `: def`;
  export via `markdown-it-deflist`. Tests + Welcome sample.
- **P3 — Finish.** ROADMAP, full verify (typecheck/lint/build/tests), live probe,
  merge.
