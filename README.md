# Pier

A macOS menu-bar launcher for command-line tools.

Pier surfaces the small CLI tools you (or Claude Code) generate as drag-drop tiles. Tools are declared in a single JSON file Claude Code can edit directly — no UI work, no per-tool scripting.

## Status

v0.1 — personal-use alpha. Unsigned DMG.

## Install (macOS)

```bash
git clone https://github.com/<your-org>/pier
cd pier
npm install
npm run tauri build
```

The unsigned DMG lands in `src-tauri/target/release/bundle/dmg/`. Drag to Applications. First launch: right-click → Open → Open Anyway (Gatekeeper unsigned-app dance).

## Usage

On first launch, Pier creates `~/.pier/tools.json` with two starter tools. Click the menu-bar icon to open the window. Drag a file onto a tile, click Run.

## Adding a tool

Edit `~/.pier/tools.json` (or ask Claude Code to — see [`docs/skill.md`](docs/skill.md) for the bundled skill that adds, edits, and removes tools). Pier hot-reloads within a second.

Schema (abbreviated):

```json
{
  "id": "kebab-case-id",
  "name": "Display Name",
  "command": "/absolute/path/to/binary",
  "args": ["{input}"],
  "parameters": [
    { "id": "input", "type": "file", "accepts": [".mp4"] }
  ],
  "cwd": "/path/to/project",
  "envFile": ".env",
  "env": { "DEBUG": "1", "API_KEY": "${keychain:my-key}" },
  "description": "One line",
  "icon": "▸",
  "confirm": false,
  "category": "media"
}
```

Parameter types: `file`, `folder`, `text`, `url`, `select`, `boolean`, `number`. Args reference parameters with `{paramId}`.

Environment: `cwd` sets the working directory; `envFile` loads a `.env` (path relative to `cwd`); `env` provides inline overrides with `${keychain:NAME}` (macOS Keychain) and `${env:NAME}` (host env) interpolation. The audit log records *which* vars came from where, never their values (except for plain `envFile` entries).

See `examples/tools.json` for a full example.

## Architecture

Tauri 2 + React + TypeScript. Clean architecture on both sides:

- Frontend: `domain/` → `application/` → `infrastructure/` → `ui/` (atomic design) + `state/` (Context+reducer)
- Backend: `domain/` → `application/` → `infrastructure/` + thin `commands.rs`

## Audit log

Every run is logged to `~/.pier/audit.log` (append-only JSONL). Useful for forensics if a malicious tools.json gets pasted.

## License

MIT
