# Contributing to Inkwell

Open regular pull requests against `dev`. The `main` branch tracks releases. CI runs formatting-independent code checks and tests on Windows, Linux and macOS for both branches.

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), Node.js 24 and stable Rust. Then run `npm ci` and `npm run dev` from the repository root.

Before opening a pull request, run:

```sh
npm run lint
npm run typecheck
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

For release maintainers, update the version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. Add notes in `.github/release-notes/vX.Y.Z.md`. Merge the release into `main` and push an annotated `vX.Y.Z` tag on the release commit. The Release workflow publishes only after all tests and native builds pass.
