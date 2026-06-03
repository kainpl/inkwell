# Milestone 19 — plan (AI assist — Expand + Summarize, BYOK)

> ## ⏸ STATUS: DEFERRED / PARKED (2026-06)
> AI integration is **paused indefinitely** at the user's request — back-burnered, not
> abandoned. **Nothing was built** (no code; this is design + research only). This doc is
> preserved as the future starting point. **Key reason it stalled:** the auth research below
> (a third-party app can't legitimately ride the user's Claude.ai subscription), so the only
> free/sanctioned provider is **Ollama** (local) — revisit when AI is back on the table.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.
>
> **Branch (was):** `feat/mindmap-ai` (off `feat/mindmap`) — deleted after parking; this plan doc was merged back into `feat/mindmap`. First §F item.

**Goal:** Add **AI assist** to the schema editor — **Expand** a node (brainstorm child
topics) and **Summarize** a subtree into a node note — over a **bring-your-own-key** LLM
client supporting **Anthropic**, **OpenAI-compatible** (OpenAI / OpenRouter / Groq / LiteLLM
via a base URL), and **Ollama** (local, no key). No Inkwell backend.

## Architecture

- **No backend → BYOK.** Mirror the existing Drive-credentials pattern: the key/config live
  in `Settings` (persisted), the renderer **pushes** them to main via `ai:setConfig` (like
  `drive.setCredentials`); **main holds the config in memory** and makes the HTTP call. The
  renderer calls `ai:complete({ system?, messages })` — **no key in the call** (main has it).
- **One client, three providers** — a normalized payload `{ system?, messages:[{role,content}] }`
  adapted per provider in a **pure** `buildAiRequest(config, payload) → { url, headers, body }`
  and a **pure** `parseAiResponse(provider, json) → string`; the fetch wrapper sits between them.
  Main-process `fetch` (no CSP/CORS issues — main isn't a browser).
- **Renderer AI actions** build a prompt, call `ai.complete`, then **parse + validate** the
  output (loose JSON / line parsing; trim, cap, dedupe) and apply via existing ops
  (`insertOutlineUnder` for Expand, `setNodeData({note})` for Summarize).
- **State** — `aiBusy` / `aiError` on the project entry drive a spinner + error surfacing.
- **Privacy** — cloud providers receive the node text; documented. **Ollama** keeps it local.

```
Settings(provider·model·baseUrl·apiKey) ──ai:setConfig──► main/ai (in-memory)
renderer action → ai.complete({system,messages}) ──IPC──► buildAiRequest → fetch → parseAiResponse → text
              → parseChildIdeas / summary → insertOutlineUnder / setNodeData({note})
UI: ✨ Expand / Summarize in the Node Inspector (busy spinner, error, "configure AI" when unset)
```

**Provider specifics:**
- **Anthropic** — `POST ${baseUrl||https://api.anthropic.com}/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`; body `{ model, max_tokens, system, messages }`; reply `.content[0].text`.
- **OpenAI-compatible** — `POST ${baseUrl||https://api.openai.com/v1}/chat/completions`, `Authorization: Bearer`; body `{ model, messages:[{role:'system'},…], max_tokens }`; reply `.choices[0].message.content`.
- **Ollama** — `POST ${baseUrl||http://localhost:11434}/api/chat`, no auth; body `{ model, messages:[{role:'system'},…], stream:false }`; reply `.message.content`.

**Conventions:** pure request/response adapters + output parsers tested; reuse settings/store/ops; commit per green group.

---

## Phase A — settings + main AI client

**Files:** modify `lib/settings.ts` (+ `useAppStore` mirror + `settingsSync` push), `components/PreferencesModal.tsx` (an AI section); create `main/ai/providers.ts` (+ test), `main/ai/index.ts` (IPC); modify `shared/ipc.ts`, `preload/index.ts`, `i18n`.

- [ ] **A1** `Settings` += `aiProvider: 'anthropic'|'openai'|'ollama'` (default `anthropic`), `aiModel`, `aiBaseUrl`, `aiApiKey` (defaults: empty key; model `claude-haiku-4-5` / `gpt-4o-mini` / `llama3.1`; baseUrl empty ⇒ the provider default). `DEFAULT_SETTINGS` + the validating loader + `useAppStore` mirror (+ setters) + `settingsSync` pushes via `window.api.ai.setConfig(...)`.
- [ ] **A2** `main/ai/providers.ts` **pure**: `buildAiRequest(config, payload) → { url, headers, body }` (per-provider; throws if a cloud provider has no key) + `parseAiResponse(provider, json) → string` (per-provider; throws on a provider `error`). Tests: each provider's URL/headers/body shape; system normalization (top-level for Anthropic, a message for the others); response extraction; missing-key + error-shape throw.
- [ ] **A3** `main/ai/index.ts`: in-memory config (set by `ai:setConfig`); `ai:complete(payload)` → `buildAiRequest` → `fetch` → `parseAiResponse` (readable errors on non-2xx). `shared/ipc.ts` channels + `preload` `ai.setConfig` / `ai.complete`.
- [ ] **A4** `PreferencesModal`: an **AI** section — provider `<select>`, model input, base-URL input, API-key password input (mirrors the Drive-secret row); i18n en/uk/ru. (Key stored like `driveClientSecret`.)
- [ ] **A5** `typecheck`/`lint`. Commit `feat(mindmap): AI client (BYOK: Anthropic / OpenAI / Ollama)`.

## Phase B — Expand a node

**Files:** create `lib/mindmap/aiPrompts.ts` + `lib/mindmap/aiActions.ts` (+ tests for the parser); modify `useProjectStore.ts` (`aiBusy`/`aiError`), `NodeInspector.tsx`.

- [ ] **B1** `aiPrompts.expandPrompt(label, ancestorPath, existingChildren)` (pure string) + `parseChildIdeas(text) → string[]` (pure): parse a JSON array, else split lines/bullets; trim, drop empties, strip leading `-`/`*`/numbers, dedupe (case-insensitive) vs `existingChildren`, cap at 8. Test the parser (JSON, bullet list, dupes, junk).
- [ ] **B2** `useProjectStore`: `aiBusy: boolean` + `aiError: string | null` + setters.
- [ ] **B3** `aiActions.aiExpandNode(nodeId)`: gather context (label + ancestor labels via `ancestorsOf` + existing child labels), `system`+`messages` → `window.api.ai.complete(...)`, `parseChildIdeas`, `insertOutlineUnder(doc, nodeId, names.map(n=>({name:n})))`, expand + mark dirty; set `aiBusy` around it; `aiError` on failure.
- [ ] **B4** `NodeInspector`: a **✨ Expand** button (disabled while `aiBusy`; spinner; an inline error from `aiError`; a "configure AI in Preferences" hint when no provider key/Ollama). 
- [ ] **B5** `typecheck`/`lint`. Commit `feat(mindmap): AI expand node (brainstorm children)`.

## Phase C — Summarize a subtree → note

**Files:** modify `lib/mindmap/aiPrompts.ts` (`summarizePrompt`), `aiActions.ts` (`aiSummarizeNode`), `NodeInspector.tsx`.

- [ ] **C1** `summarizePrompt(label, subtreeOutlineText)` (pure) — ask for a 1–2 sentence summary. (Reuse `outlineToMarkdown` over the node's subtree for the outline text.)
- [ ] **C2** `aiActions.aiSummarizeNode(nodeId)`: build the subtree outline → `ai.complete` → `setNodeData(doc, nodeId, { note: summary.trim() })` + mark dirty; `aiBusy`/`aiError`.
- [ ] **C3** `NodeInspector`: a **Summarize** button next to Expand (same busy/error handling).
- [ ] **C4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): AI summarize subtree into a note`.

## Phase D — gate + QA + merge

- [ ] **D1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **D2** QA (live): set a provider + key (or Ollama) in Preferences → **Expand** a node adds sensible children; **Summarize** writes a note; busy spinner; a bad key surfaces an error; with nothing configured the buttons hint to set it up. Update `README.md` + `backlog.md` (§F AI assist — Expand/Summarize ✅). 
- [ ] **D3** On QA OK: merge `feat/mindmap-ai` → `feat/mindmap` (`--no-ff`). Push per the user's instruction.

## Risks & mitigations
- **Key safety** — key lives in `Settings` + main memory (like `driveClientSecret`); never sent in the `ai:complete` call; not logged.
- **Privacy** — cloud providers see the node/subtree text; documented; **Ollama** is fully local.
- **Output reliability** — LLM replies are parsed loosely + validated (cap/dedupe/trim); a parse miss yields zero children (no crash) + an error toast.
- **Network/latency/cost** — user's own key; a spinner; small `max_tokens`; failures surface in `aiError`.
- **CORS/CSP** — none (main-process `fetch`, not the renderer).

## Self-review
- **BYOK & additive:** mirrors the Drive-credentials pattern; AI is a flag-gated extra; the editor works fully without it. ✓
- **Reuses:** settings/store/`settingsSync`, `insertOutlineUnder`, `setNodeData`, `ancestorsOf`, `outlineToMarkdown`, the inspector. ✓
- **Deferred (M20+):** the natural-language **command bar** (structured edit-ops + preview/confirm), **streaming**, **mind-map → article**, multi-step agentic commands.

---

## Authentication research (verified via `claude-code-guide`, 2026-06) — why this parked

The user has a Claude.ai Pro/Max subscription (Claude Desktop + Claude Code) and does **not**
want to buy separate Anthropic **API** billing. We investigated reusing that subscription
inside Inkwell. Findings (authoritative, current docs):

1. **Anthropic API vs subscription are separate** — the API (`console.anthropic.com`,
   `sk-ant-…` keys, pay-per-token) is a different account/billing from the claude.ai
   consumer subscription. (User was correct.)
2. **The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) authenticates via
   `ANTHROPIC_API_KEY`, NOT the local Claude Code login.** It does **not** read
   `~/.claude/.credentials.json` / the OS keychain. The TS SDK bundles the Claude Code
   runtime (no separate CLI install needed). One-shot: `for await (const m of query({prompt})) { if ('result' in m) … }`.
3. **Subscription + SDK/`claude -p` exists (since 2026-06-15)** but draws from a **separate
   monthly "Agent SDK credit" pool** — and, decisively: **Anthropic forbids third-party
   developers from offering claude.ai login / subscription rate-limits in their products**
   ("…does not allow third party developers to offer claude.ai login or rate limits for their
   products, including agents built on the Agent SDK"). So **Inkwell cannot legitimately ride
   the user's subscription** — neither via the SDK nor via spawning `claude -p`. (The earlier
   "spawn the local CLI to reuse the sub" idea was **retracted** for this reason. Protocolist's
   `claude-sdk` provider is their own internal/dev usage, not a shipped third-party feature.)
4. **Non-API routing alts** (still not the consumer sub): `CLAUDE_CODE_USE_BEDROCK` (AWS),
   `CLAUDE_CODE_USE_VERTEX` (GCP), `CLAUDE_CODE_USE_FOUNDRY` (Azure) — all need cloud billing.
5. **The only free / sanctioned path for Inkwell = Ollama (local).** No key, no account, no
   billing, no ToS issue, text stays local. So if/when AI returns, **Ollama is the user's
   default**; the Anthropic-API / OpenAI-compatible BYOK paths are for users who already hold keys.
   Sources: code.claude.com/docs/en/agent-sdk, …/authentication, support.claude.com article 15036540.

**Bottom line for the future:** the BYOK design above (Anthropic-API / OpenAI-compatible /
Ollama) is sound and ready to build; **Ollama is the practical default** given the auth reality.
Do **not** re-propose riding the Claude subscription via CLI/SDK — it's against Anthropic's terms.
