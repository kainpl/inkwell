<div align="center">
  <img src="src-tauri/icons/128x128.png" width="80" height="80" alt="">
  <h1>Inkwell</h1>
  <p>A desktop Markdown editor with live preview, source editing, and offline spell checking.</p>
  <a href="https://github.com/kainpl/inkwell/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/kainpl/inkwell?label=Download"></a>
  <a href="https://github.com/kainpl/inkwell/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/kainpl/inkwell/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
</div>

Write Markdown directly in the rendered document. Place your cursor on a line to see and edit its markup, or switch to **Source** to work with the raw text. The modes share your selection and undo history.

## Download

Choose a package from the [latest release](https://github.com/kainpl/inkwell/releases/latest).

| Platform | Packages |
| --- | --- |
| Windows x64 | NSIS installer or portable ZIP. Extract the entire ZIP to a writable folder and start `Inkwell.exe`. Its `data/` folder stores preferences and recent items. Both editions use Microsoft Edge WebView2. |
| Linux x64 | Debian package or AppImage. Give the AppImage executable permission before running it. Built on Ubuntu 22.04. |
| macOS 11+ | Universal DMG for Apple Silicon and Intel. Drag Inkwell to Applications. |

The release notes include signing information and download checksums. See the [changelog](CHANGELOG.md) for version history and upcoming changes.

## Features

- Live tables, checklists, images, syntax-highlighted code, KaTeX formulas and Mermaid diagrams.
- Resizable sidebar with a folder tree and a document outline.
- Separate recent files and folders with configurable limits and removal controls.
- Light and dark palettes, adjustable typography, focus and typewriter modes, and configurable shortcuts.
- Ukrainian and English interface and offline spell checking.
- Optional autosave and a prompt before discarding unsaved work.

The built-in **Welcome to Inkwell** document demonstrates the Markdown features.

## Українською

Inkwell — десктопний редактор Markdown із живим переглядом. Поставте курсор на рядок, щоб редагувати його розмітку. Кнопка **Вихідний код** відкриває весь текст Markdown.

У **Файл → Налаштування** можна змінити мову, палітру, шрифт, гарячі клавіші та ліміти історії відкриття. Український і англійський словники працюють офлайн. [Завантажити Inkwell](https://github.com/kainpl/inkwell/releases/latest)

## Development

Install Node.js 24, stable Rust and the [native Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run dev
```

See [Contributing](CONTRIBUTING.md) for checks and the release workflow, and [Architecture](docs/ARCHITECTURE.md) for the editor internals.

## License

Inkwell source code is available under the [MIT license](LICENSE). See [third-party resources](THIRD-PARTY.md) for bundled dictionaries and fonts.
