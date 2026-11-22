# Changelog

## Unreleased (planned 1.1.0)

### Added

- Document tabs keep their own unsaved edits, selection, scroll position and undo history. Opening the same file again selects its existing tab. `Ctrl+Tab` switches tabs and `Ctrl+W` closes the active tab on Windows and Linux.
- The visual editor keeps Markdown syntax hidden while editing text. Table cells can be edited directly in the rendered table. Visual editing, Live Markdown and Source share the same document and undo history.
- Search now has separate entry points for the active document, its outline and the open folder. Folder search scans supported Markdown and text files on disk, including subfolders, and opens results at the matching line.
- Open files are refreshed when edited on disk. The editor maps the cursor, selection and scroll position to the updated document. If a file changes while it has unsaved edits, Inkwell pauses autosave and offers to save the edits elsewhere or discard them and reload.

### Changed

- Visual editing is the default for profiles without a selected mode. Inkwell remembers the selected mode and the previous formatted mode when toggling Source.
- Inkwell restores the last window size and maximized state on restart.
- Closing the window checks unsaved edits in every tab. Autosave continues for named documents in background tabs.

## [1.0.0] — 2026-11-22

First public release.

### Added

- Live Markdown and Source modes backed by one CodeMirror document. Rendered Markdown supports tables, task lists, images, syntax-highlighted code, KaTeX math, Mermaid diagrams and links to document anchors.
- Resizable sidebar with separate folder and outline views. Recent files and recent folders have independent limits and removal controls.
- English and Ukrainian interface, offline spelling dictionaries and a bundled welcome document that demonstrates the editor.
- Configurable palettes, typography, keyboard shortcuts, Markdown extensions and optional autosave. Focus and typewriter modes are available while writing.
- GitHub Actions CI and releases for Windows x64, Linux x64 and macOS. Downloads include a Windows installer and portable ZIP, Linux Debian and AppImage packages, and a universal macOS DMG.

### Changed

- Replaced Electron with Tauri 2. Inkwell uses the system WebView and integrates the Windows window controls and menus into the themed title bar.

## [0.1.0] — 2026-05-30 (development baseline)

- Initial Electron prototype with CodeMirror live preview, document open and save, a folder sidebar, a document outline and focus mode.

[1.0.0]: https://github.com/kainpl/inkwell/releases/tag/v1.0.0
[0.1.0]: https://github.com/kainpl/inkwell/tree/a8ed99ccb8586db79262c003e7e3b6941979a604
