# Phase 7 — Command Palette

## Goal

A searchable palette (`Ctrl/⌘+Shift+P`) listing every app command — file ops,
edit, format, view, export, navigation — with fuzzy search, keyboard nav, and
Enter to run. Surfaces everything the menus already do in one keystroke.

## Key idea: zero logic duplication

The palette does not re-implement any action. Each command re-fires the existing
menu IPC channel through a new renderer→main→renderer hop:

```
window.api.triggerMenu(channel, arg?)  →  ipcMain  →  sender.webContents.send(channel, arg)
```

The existing `onMenu` / `onFormat` / `onExportPandoc` listeners in App.tsx then
run exactly as if the native menu was clicked. So the registry is pure data and
the behaviour can never drift from the menus.

## Pieces

- `shared/ipc.ts`: `menuCommandPalette` (main→renderer, opens the palette) and
  `triggerMenu` (renderer→main, re-fires a channel).
- `main/menu.ts`: View ▸ **Command Palette…** (`CmdOrCtrl+Shift+P`). `P` alone is
  Quick Open, so the palette uses `Shift+P`.
- `main/index.ts`: `ipcMain.on(triggerMenu)` → forward to the sender's window.
- `preload`: expose `triggerMenu(channel, arg?)`; add `menuCommandPalette` to the
  allowed menu channels.
- `lib/commands.ts`: the registry — `Command = { id, title, category, channel, arg? }`
  covering File / Edit / Format / View / Export / Go. Format commands target
  `menuFormat` with the action id as `arg`; pandoc exports target
  `menuExportPandoc` with the format as `arg`.
- `components/CommandPalette.tsx`: a modal modelled on `QuickOpen` — input +
  `fuzzyFilter` over `"{category} {title}"`, ↑/↓ to move, Enter runs
  `triggerMenu(cmd.channel, cmd.arg)` and closes, Esc/backdrop closes.
- `App.tsx`: mount `<CommandPalette />`.

## Notes

- The fuzzy file switcher stays in Quick Open (`Ctrl/⌘+P`); the palette exposes a
  **Go ▸ Go to File…** command that opens it, satisfying the roadmap's "+ file
  switcher" without duplicating it.
- Theme toggle and other non-menu actions are reachable elsewhere (TitleBar /
  Preferences); the palette stays channel-pure for now.

## Verification

Unit tests for `lib/commands.ts` (unique ids; every command has title/category/
channel; fuzzy matches by category+title). Live: open the palette, run a couple
of commands (e.g. Toggle Sidebar, Format Bold) and confirm they take effect.
