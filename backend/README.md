# Typist Backend

Typist Rust backend crate, responsible for file I/O, search/replace, export, plugin runtime state, settings, recovery, and diagnostics.

## Stack

- Rust 2021
- serde / serde_json
- regex
- pulldown-cmark
- chrono
- uuid

## Run and Verify

In this directory:

```bash
cargo check
cargo test
```

From repository root:

```bash
cargo check --manifest-path backend/Cargo.toml
cargo test --manifest-path backend/Cargo.toml
```

## Module Layout

- `src/commands.rs`: backend facade and Tauri command entry points.
- `src/state.rs`: in-memory editor/session state.
- `src/models.rs`: request/response and domain models.
- `src/services/file_service.rs`: file read/write and snapshots.
- `src/services/search_service.rs`: in-document search and replace.
- `src/services/export_service.rs`: export pipeline (HTML + Pandoc formats).
- `src/services/plugin_service.rs`: plugin registration/runtime metadata.
- `src/services/recovery_service.rs`: recovery drafts save/list/restore/delete.
- `src/services/diagnostics_service.rs`: diagnostics and log output.

## Export Notes

- HTML export uses internal markdown-to-html rendering.
- PDF/DOCX/LaTeX/EPUB/Reveal.js export uses `pandoc`.
- Make sure `pandoc` is installed and available in PATH on runtime machines.

## Recovery Notes

- Recovery draft metadata and content are stored as JSON files in recovery directory.
- Recovery directory defaults to system temp path when not explicitly configured.
- Frontend restore flow should load content back into an editable tab and mark it dirty.

## Integration Boundary

This crate is integrated by `src-tauri` and exposed through Tauri invoke commands.
If you add or rename backend commands, sync the following:

1. Command function in `backend/src/commands.rs`
2. Command registration in `src-tauri/src/lib.rs`
3. Frontend API wrapper in `frontend/src/api/index.ts`
