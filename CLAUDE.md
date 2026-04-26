# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run tauri dev` — run the desktop app (Vite on :1420 + Rust shell). Use this, not `npm run dev` alone, since the frontend assumes Tauri commands exist.
- `npm run dev` — frontend only (browser at :1420). Tauri `invoke` calls will fail; useful only for pure UI work.
- `npm run build` — `tsc && vite build` (typechecks then builds the web bundle to `dist/`).
- `npm run tauri build` — produce the unsigned DMG at `src-tauri/target/release/bundle/dmg/`.
- `npm test` — Vitest watch mode. `npm run test:run` for one-shot. Single test: `npx vitest run path/to/file.test.ts -t "name"`.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml`.

Vite port 1420 is `strictPort: true` — if it's taken, `tauri dev` fails rather than picking another port.

## Architecture

Tauri 2 + React 19 + TypeScript. Both sides follow the same clean-architecture layering: `domain → application → infrastructure`, with UI/commands as the outer adapter.

### Runtime model

1. On startup `lib.rs` builds a tray icon (left-click toggles the main window, right-click shows the menu) and starts a `notify`-based file watcher on `~/.pier/tools.json` (`application/watch_config.rs`). Changes are emitted to the frontend, which reloads the config — this is the "hot reload" referenced in the README.
2. The frontend calls `load_tools_config` (which seeds a default file if missing) and renders tools as tiles.
3. Running a tool: frontend → `run_tool_cmd` (Rust) → `application/run_tool.rs` spawns a subprocess via `infrastructure/subprocess.rs`. Stdout/stderr stream back as `pier://output` events; completion fires `pier://exit` (see `events.rs`). `kill_run_cmd` cancels by `run_id`. Every run is appended to `~/.pier/audit.log` (JSONL) by `application/audit.rs`.

### Frontend layers (`src/`)

- `domain/` — pure types + validation (`tool.ts`, `runRequest.ts`, `validation.ts`). No React, no Tauri.
- `application/ports.ts` — interfaces (`ConfigLoader`, `CommandRunner`, `AuditLogger`). The app depends on these, **not** on Tauri directly. Tests substitute fakes.
- `infrastructure/` — concrete adapters: `tauriConfigLoader.ts`, `tauriCommandRunner.ts`. These are the only files that import from `@tauri-apps/api`.
- `state/` — `AppContext` (config + tool list, Context+`useReducer`) and `RunnerContext` (injects the `CommandRunner` port). Components consume runners via `useRunner()` so tests can inject fakes.
- `ui/` — atomic design (`atoms/molecules/organisms/templates/pages`). Styling lives in `src/styles/` (`tokens.css` + `global.css`).

### Backend layers (`src-tauri/src/`)

- `domain/` — `Tool`, `ToolsConfig`, `RunRequest`, `RunStatus`. Serde-derived; shapes mirror the frontend domain types.
- `application/` — use cases: `load_config`, `watch_config`, `run_tool`, `audit`, `path_resolver`. Orchestrate domain + infrastructure.
- `infrastructure/` — `subprocess.rs` (tokio process spawning + line streaming), `fs_watcher.rs` (notify wrapper).
- `commands.rs` — thin `#[tauri::command]` shims; never put logic here.
- `state.rs` — shared `AppState` (active runs map, etc.) registered via `.manage()`.

### Adding a tool runtime feature

The flow to extend (e.g. new field on `Tool`, new run option) typically touches: `src/domain/tool.ts` + validator → `src-tauri/src/domain/tool.rs` (keep serde names aligned) → use case in `application/` on whichever side does the work → adapter in `infrastructure/` if a new syscall is needed → optionally a new `#[tauri::command]` exposed via `commands.rs` and added to `invoke_handler!` in `lib.rs`. Keep the port interface in `application/ports.ts` updated so tests can fake the new capability.

### Config + data files

- `~/.pier/tools.json` — user's tool definitions; seeded with defaults on first load. Hot-reloaded.
- `~/.pier/audit.log` — append-only JSONL of every run.
- `examples/tools.json` — reference schema.

## Conventions

- Frontend tests live in `__tests__/` siblings (Vitest + jsdom; setup in `src/setupTests.ts`).
- Don't import `@tauri-apps/api` outside `src/infrastructure/`. UI/state code goes through `application/ports.ts`.
- The macOS tray uses `icon_as_template(true)`; tray icons must be monochrome PNGs.
- `ActivationPolicy::Accessory` (true menu-bar mode) is currently disabled in `lib.rs` — the window shows like a regular app during early dev. Re-enable once tray UX is verified.

## Project docs (Obsidian)

Design docs and planning notes live in the user's Obsidian vault at `~/Obsidian/projects/pier/` (symlink to the iCloud vault). Read these for product context, decisions, and scope — keep them in sync when scope or architecture shifts:

- `README.md` — overview, problem/solution, audience strategy
- `v0.1-scope.md` — current scope
- `tools-schema.md` — `tools.json` schema reference
- `architecture-decisions.md` — ADRs
- `design-system.md` — UI/design notes
- `implementation-plan.md` — build plan

The vault has its own `CLAUDE.md` with required conventions (frontmatter, wikilinks, MOC updates) — follow them when editing vault notes. Prefer the `obsidian` skill for vault operations.
