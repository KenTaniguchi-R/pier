# Changelog

All notable changes to Pier are documented here.

## v0.1.2 — 2026-04-27

Releases are now signed with a Developer ID Application certificate (Benri LLC) and notarized by Apple. Fresh installs no longer trigger the Gatekeeper "unidentified developer" warning, and the auto-updater hands off properly notarized bundles. No user-facing feature changes.

## v0.1.1 — 2026-04-27

First working release. v0.1.0 was tagged but its `latest.json` had a wrong asset URL — the on-disk tarball name didn't match the uploaded asset name after `tauri-action`'s rename, so the auto-updater would 404 on every check. Fixed by resolving the actual asset URL from the GitHub Release at workflow time.

Everything else is identical to v0.1.0 below.

## v0.1.0 — 2026-04-27

First public release. macOS menu-bar launcher for personal CLI tools, with everything wired in for self-updating from this version forward.

### Core

- **Menu-bar app.** Tray icon left-click toggles a window of tool tiles. Right-click → Quit. Drag a file onto a tile, click Run. Stdout/stderr stream live.
- **Tools defined in JSON.** `~/.pier/tools.json` is hot-reloaded; Claude Code can edit it directly. Schema supports parameters (`file`, `folder`, `text`, `url`, `select`, `boolean`, `number`), per-tool `cwd`, `envFile`, inline `env` with `${keychain:NAME}` and `${env:NAME}` interpolation, and confirmation gates.
- **Run history.** Every run is appended to `~/.pier/audit.log` (JSONL). Per-tool history viewer with searchable output. Audit records *which* env vars came from where, never their values (except plain `envFile` entries).
- **Settings.** Launch at login, clear history, automatic updates toggle, manual update check.

### In-app updater

- Checks for new releases on launch and every 24 hours; downloads in the background.
- **Sparkle-style modal**: Install and Restart, Remind Me Later (24h), Skip This Version. Hand-rolled markdown renderer for release notes (no `dangerouslySetInnerHTML`, no deps).
- **Hidden-window UX** for menu-bar mode: system notification + tray-icon dot badge replace the in-app toast when the window isn't visible.
- **Translocation guard** refuses to self-update if launched from a quarantined path; prompts the user to move the app to /Applications.
- **Atomic settings writes** via `patch_settings_cmd` (serialized lock + tmp+rename) eliminate last-write-wins races between auto-check persistence and user toggles.

### Distribution

- Universal arm64+x86_64 binary, ad-hoc codesigned via Tauri's bundler so in-place updates don't re-trigger Gatekeeper after the first launch.
- Tagged-release pipeline (`.github/workflows/release.yml`) produces a `.dmg` for first install plus a signed `.app.tar.gz` + `.sig` + `latest.json` for the auto-updater.

### Known limitations

- Not Apple-notarized — first launch needs the one-time right-click → Open → Open Anyway dance. Subsequent in-app updates are seamless.
- macOS only. Single update channel (no beta/pre-release).
