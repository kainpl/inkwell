# Mind‑map / schema‑editor — working docs

Knowledge base for the new architectural layer: a **schema / mind‑map editor** inside Inkwell, backed by a **single self‑contained project file** (custom‑extension ZIP holding a schema + bundled `.md` docs). We port the *idea* and the *format* from the **AiOffice / AI‑Протоколист (MindSuite)** ecosystem, decoupled from its cloud machinery.

Branch: `feat/mindmap`. Started 2026‑06‑02.

## Files

| File | What |
| --- | --- |
| [`reference-ecosystem.md`](reference-ecosystem.md) | **How the source works now** — the thing we’re porting. Accumulated analysis of the 3 reference repos: the `.mind-map` format, the React Flow editor, the node data model, persistence, export interop, the MindDoc design docs. |
| [`our-vision.md`](our-vision.md) | **What we build & how** — the `.inkproj` ZIP project, Inkwell integration, take/adapt/drop, locked decisions **D1–D13**, backlog. |
| [`m1-spec.md`](m1-spec.md) | **Milestone 1 spec** — the read‑only vertical slice (open `.inkproj` → render schema → click node → open doc). |
| [`m1-plan.md`](m1-plan.md) | **Milestone 1 implementation plan** — 14 task‑by‑task steps (TDD), exact files, ready to execute. |

## Source repos (read‑only, gitignored, under `temp/ref/`)

- `ai-office-main` — AiOffice main branch (no mind‑map).
- `ai-office-dev` — AiOffice dev branch (MindSuite integration + design docs).
- `ai-protocolist-dev` — **the real implementation** of the live mind‑map editor + `.mind-map` format.

## One‑line glossary

- **MindSuite** — the source product family (Protocolist, Stenographist, MindManager, MindDoc).
- **`.mind-map`** — shipped format: one Markdown file, nested bullets, per‑node `<!-- mindmap {…} -->` data bags.
- **MindDoc** — designed‑but‑unbuilt grander format (AST → markdown/visual projections).
- **`.inkproj`** (placeholder) — *our* project file: a ZIP bundling a schema + `docs/` + `assets/`.
- **Polysystem** — the source’s coupling (node == Drive folder == Telegram topic == Trello board); **we drop it**.

## Status

Research complete; **vision locked (D1–D13)**; **M1 shipped** on `feat/mindmap` (pushed to origin) — read-only slice (open `.inkproj` → React Flow schema + typed cross-links → click node → doc pane with anchor scroll) **+ projects open as tabs** (switch/close via TabBar). Manual acceptance passed. Next: **M2 — editing + save**.
