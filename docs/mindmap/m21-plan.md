# Milestone 21 — plan (backlog polish: the small ⬜ items)

> ## ✅ SHIPPED — all 6 groups (live-QA OK)
> Built on **`feat/polish`** (7 green commits incl. a commit-review security fix), merged into
> **`feat/mindmap`** (`--no-ff`). Groups: word-count popover + goal · Save All · Reopen with
> Encoding · outline popover · opt-in iframe/video embeds · table inline toolbar + column resize.
> **New Window** and **flowchart.js/js-sequence** were explicitly scoped out (see below); grammar excluded.

> **For agentic workers:** build inline, commit each green task-group, hand off for live QA,
> mark shipped on the user's OK. Branch **`feat/polish`** (off `feat/mindmap`) → merge back on QA-ok.

**Goal:** Clear the small `⬜ "за потреби"` polish items from the ROADMAP/backlog (all of them
**except grammar**), each additive and self-contained.

**Scope decisions (made up front):**
- **New Window** is *not* in scope — it needs real multi-window infrastructure (a second
  `BrowserWindow` with its own renderer state + IPC routing + session). That's its own milestone.
  **Save All** (save every dirty tab) **is** in scope.
- **flowchart.js / js-sequence** legacy diagram engines are **skipped** — unmaintained deps,
  redundant with mermaid (the ROADMAP marks them "only if needed").
- **Grammar** is explicitly **out** (needs LanguageTool — a separate effort).

---

## Group 1 — Word-count popover + word goal  *(Phase 3/7)*

**Files:** `lib/textStats.ts` (+ test), `components/StatusBar.tsx`, `components/WordCountPopover.tsx`
(new), `lib/settings.ts` (+ `wordGoal`), `components/PreferencesModal.tsx`, `shared/i18n/*`.

`computeStats` already returns `words/chars/charsNoSpaces/lines/readingMinutes` — only the UI is missing.

- [x] **1a** Pure helper `goalProgress(words, goal): { pct, remaining, done }` in `textStats.ts` + tests
  (goal `null`/`0` → no goal; pct clamped 0–100).
- [x] **1b** `wordGoal: number | null` in settings (`lib/settings.ts` default `null`, persisted via
  `settingsSync`); a number input in Preferences ▸ Editor ("Word goal", 0/empty = off).
- [x] **1c** `WordCountPopover.tsx` — a small popover anchored above the status-bar count: Words,
  Characters, Characters (no spaces), Lines, Reading time; when a goal is set, a row "N / goal words"
  + a thin progress bar (`goalProgress`). Closes on outside-click / Esc.
- [x] **1d** StatusBar: make the Words/Chars span a button that toggles the popover; when a goal is
  set show a tiny `· N%` after the count. i18n keys for all labels.
- [x] **1e** `typecheck`/`lint`/`vitest run` green. Commit `feat(editor): word-count popover + word goal`.

## Group 2 — Save All  *(Phase 4)*

**Files:** `lib/docActions.ts` (saveAll), `lib/commands.ts`, `main/menu.ts`, `shared/ipc.ts`
(`menuSaveAll`), `preload/index.ts`, `App.tsx` (menu wiring), `shared/i18n/*`.

- [x] **2a** `saveAllTabs()` in `docActions.ts`: for each tab with `dirty && path`, write via the
  existing save path (reuse `saveActive`'s core, iterating tabs); unsaved-no-path tabs are left for a
  normal Save-As (skip silently). Uses `useAppStore.getState()` tabs.
- [x] **2b** `IPC.menuSaveAll` channel + `menu.ts` File → "Save All" (`CmdOrCtrl+Alt+S`) → emits it;
  `App.tsx` listens and calls `saveAllTabs`; register in command palette.
- [x] **2c** `typecheck`/`lint`/`vitest run` green. Commit `feat(files): Save All (all dirty tabs)`.

## Group 3 — Reopen with Encoding  *(Phase 4)*

**Files:** `main/ipc/files.ts` (`readFileAs`), `shared/ipc.ts`, `preload/index.ts`,
`lib/encodings.ts` (new, + test), `main/menu.ts` (submenu), `App.tsx`, `lib/docActions.ts`.

Node 18+ ships full-ICU, so `new TextDecoder(label)` decodes windows-1251, shift_jis, gbk, big5,
iso-8859-*, koi8-r, … — **no new dependency**.

- [x] **3a** `lib/encodings.ts` — `ENCODINGS: {label, id}[]` (UTF-8, UTF-16LE/BE, Windows-1251/1252,
  ISO-8859-1/2, KOI8-R, Shift_JIS, GBK, Big5, EUC-KR, Macintosh) + a `decode(bytes, id)` thin wrapper
  over `TextDecoder`; tests (round-trip a windows-1251 byte buffer of Cyrillic).
- [x] **3b** `IPC.readFileAs(path, encoding)` in main: `const buf = await fs.readFile(path)` →
  `new TextDecoder(encoding, { fatal: false }).decode(buf)`; returns `OpenedFile`.
- [x] **3c** `menu.ts` File → "Reopen with Encoding" ▸ submenu (one item per encoding) emitting
  `IPC.menuReopenEncoding` with the chosen id; `App.tsx` guards a dirty buffer (Confirm), re-reads the
  current `doc.path` via `readFileAs`, replaces the buffer (keeps the path/name). Disabled when no file.
- [x] **3d** `typecheck`/`lint`/`vitest run` green. Commit `feat(files): Reopen with Encoding (non-UTF-8)`.

## Group 4 — Outline quick popover  *(Phase 3)*

**Files:** `components/OutlinePopover.tsx` (new), `lib/commands.ts`, `lib/outline.ts` (reuse),
`shared/ipc.ts` (`menuOutlinePopover`), `main/menu.ts`, `App.tsx`, `shared/i18n/*`.

A floating quick-jump outline (so you can jump headings without opening the sidebar), in the
QuickOpen/CommandPalette modal idiom.

- [x] **4a** `OutlinePopover.tsx` — a centered floating panel listing `parseOutline(content)` with a
  filter input; ↑/↓ move, Enter dispatches `GOTO_EVENT` to the caret offset, Esc closes; indented by
  heading level. Reuses the existing modal styling (see QuickOpen).
- [x] **4b** Open via command palette ("Outline…") + `View` menu + a hotkey (`Ctrl/⌘+Shift+O`);
  `menuOutlinePopover` channel; `App.tsx` toggles it.
- [x] **4c** `typecheck`/`lint`/`vitest run` green. Commit `feat(outline): quick outline popover`.

## Group 5 — Embeds: iframe / video (opt-in)  *(Phase 2)*

**Files:** `index.html` (CSP), `lib/settings.ts` (`allowEmbeds`), `components/PreferencesModal.tsx`
(Markdown section), `components/Editor/livePreview.ts` (HTML-block sanitize config),
`lib/exportRender.ts` (export sanitize), `shared/i18n/*`, `resources/Welcome.md` (sample).

Default **off** (strict CSP preserved). The sanitizer is the gate; CSP is widened only enough to
*permit* https frames/media (no inline, no script).

- [x] **5a** `allowEmbeds: boolean` setting (default `false`); Preferences ▸ Markdown toggle
  ("Allow iframe/video embeds (less safe)").
- [x] **5b** When on, the HTML-block DOMPurify config (livePreview + exportRender) adds
  `iframe,video,audio,source` to allowed tags with a tight attr allowlist; **iframe `src` forced
  `https:` only + `sandbox` added**; drop any `srcdoc`. Hook via `DOMPurify.addHook` /
  `ALLOWED_TAGS`/`ALLOWED_ATTR`. When off → current behavior (tags stripped, raw shown).
- [x] **5c** `index.html` CSP: add `frame-src https:;` and widen `media-src` to `https: data: blob:
  file:` (still no `script-src` change). Document the trade-off in a comment.
- [x] **5d** Welcome sample (an iframe + a video) behind the note "enable in Preferences". Gate the
  decoration in `buildDecorations` on the flag (like other markdown flags) so it shows raw when off.
- [x] **5e** `typecheck`/`lint`/`vitest run` green. Commit `feat(editor): opt-in iframe/video embeds`.

## Group 6 — Table inline toolbar + column-resize drag  *(Phase 2/7)*

**Files:** `components/Editor/livePreview.ts` (`TableWidget`), `lib/tableModel.ts` /
`lib/tableCommands.ts` (reuse), `index.css` (toolbar/handle styles).

The `TableWidget` (livePreview.ts ~288) renders a static `<table>`. Add interactivity, but keep the
**source as SSOT** — every control dispatches a CM edit through `tableCommands` against the table's
document range; the field re-renders. Only on **idle** blocks (active block stays raw/editable).

- [x] **6a** Pass the table's document `from`/`to` into `TableWidget` so its DOM controls can target
  the right source range; `toDOM(view)` receives the view for `view.dispatch`.
- [x] **6b** A floating mini-toolbar shown on hover over the rendered table: add row above/below,
  add col left/right, delete row, delete col, cycle column alignment — each calling the matching
  `tableCommands` helper on the table range, then `view.dispatch`.
- [x] **6c** Column-resize: draggable separators on the `<th>` right edges. Tables are markdown
  (no real column widths), so dragging sets a visual width persisted as an HTML comment marker the
  widget reads — OR (simpler, chosen) drag adjusts a CSS `--col-w` on the rendered table only
  (visual, non-persistent) with a note. Pick the simplest that doesn't corrupt the markdown source.
- [x] **6d** `index.css` styles for `.ink-table-toolbar` + `.ink-col-resize`. Disable during drag
  selection; don't steal the caret.
- [x] **6e** `typecheck`/`lint`/`vitest run` green. Commit `feat(editor): table inline toolbar + column resize`.

---

## Phase Z — ship

- [x] **Z1** Full `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [x] **Z2** Live QA matrix (below). On user OK: mark items ✅ in `backlog.md`/`ROADMAP.md`, merge
  `feat/polish` → `feat/mindmap` (`--no-ff`), push per the user's word.

## Live QA matrix
- **Word count:** click the count → popover with all 5 stats; set a goal in Preferences → progress bar
  + `· N%` in the bar; goal 0/empty hides it.
- **Save All:** two dirty tabs → Save All → both clean on disk; unsaved-no-path tab untouched.
- **Encoding:** open a windows-1251 Cyrillic `.txt` (mojibake) → Reopen with Encoding ▸ Windows-1251 →
  readable; dirty buffer prompts first.
- **Outline popover:** `Ctrl+Shift+O` → filter → Enter jumps to the heading; Esc closes.
- **Embeds:** off by default (iframe shown raw); enable in Preferences → YouTube iframe + a video
  render on idle lines; export keeps them; CSP didn't break normal pages.
- **Table toolbar:** hover a rendered table → toolbar; add/del row+col + alignment edit the source
  correctly; column drag resizes without corrupting the markdown; active block still edits raw.

## Hard rules
- Every render-affecting change → a Welcome.md sample + a `buildDecorations`/pure-helper test.
- Embeds: the sanitizer is the security gate; never allow `script`/`srcdoc`/`on*`; iframe = https + sandbox.
- Table controls mutate the **markdown source** via `tableCommands` — never desync widget vs source.
