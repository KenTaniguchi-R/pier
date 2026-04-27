# Pier — In-app updater

**Status:** Approved
**Date:** 2026-04-27

## Goals

- Pier checks for new releases on launch and every 24h after.
- When an update is available, Pier silently downloads it in the background and surfaces a non-modal toast: *"Pier 0.x.y is ready · View"*.
- Clicking the toast opens a Sparkle-style modal: title, current vs. new version, scrollable markdown changelog, three buttons:
  - **Install and Restart** (primary)
  - **Remind Me Later** — defers for 24h
  - **Skip This Version** — suppresses until a *newer* version appears
- A manual "Check for updates…" button lives in Settings, alongside an auto-check toggle, last-checked timestamp, and current version.

## Non-goals

- Apple notarization (separate track; Gatekeeper warning is acceptable for first install).
- Staged/percentage rollouts.
- Beta channels (single channel only).
- In-app rollback.
- Delta updates (not supported by Tauri natively).
- Critical/forced-update flag (out of scope; trivial to bolt on later via a `critical` field that hides Skip).

## Distribution & infra (one-time)

1. Generate updater keypair: `tauri signer generate -w ~/.tauri/pier.key`.
2. Embed the **public key** in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
3. Store **private key** + password in GitHub Actions secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
4. GitHub Actions workflow on tag `v*`:
   - Build DMG via `tauri build`.
   - Tauri produces signed `.app.tar.gz` + `.sig` artifacts automatically when the signing env vars are present.
   - Generate `latest.json` (schema below) and attach it + the artifacts to the GitHub Release.
5. Updater endpoint: `https://github.com/<owner>/pier/releases/latest/download/latest.json`.

`latest.json` schema (Tauri v2 standard):

```json
{
  "version": "0.2.0",
  "pub_date": "2026-04-27T12:00:00Z",
  "notes": "## What's new\n- Markdown release notes here",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<sig contents>",
      "url": "https://github.com/<owner>/pier/releases/download/v0.2.0/Pier_0.2.0_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<sig contents>",
      "url": "https://github.com/<owner>/pier/releases/download/v0.2.0/Pier_0.2.0_x64.app.tar.gz"
    }
  }
}
```

## Architecture

Pier already follows `domain → application → infrastructure → ui/state` on both sides. The updater plugs into the same layering — no new architectural concepts.

### Backend (`src-tauri/src/`)

- **Plugin**: add `tauri-plugin-updater = "2"` to `Cargo.toml`. Initialize in `lib.rs` alongside the other plugins.
- **`domain/update.rs`** — pure types:
  ```rust
  pub struct UpdateInfo {
      pub version: String,
      pub current_version: String,
      pub notes: Option<String>,
      pub pub_date: Option<String>,
  }
  pub struct UpdateProgress { pub downloaded: u64, pub total: Option<u64> }
  ```
- **`application/update.rs`** — orchestrates `tauri_plugin_updater::UpdaterExt`:
  - `check(app) -> Result<Option<UpdateInfo>>`
  - `download(app, on_progress) -> Result<()>` — emits `pier://update-progress` per chunk.
  - `install_and_relaunch(app) -> Result<()>`
  - Stores the in-flight `Update` handle on `AppState` so download/install share the same instance.
- **`state.rs`** — extend `AppState` with `pending_update: Mutex<Option<tauri_plugin_updater::Update>>`.
- **`commands.rs`** — three shims:
  - `check_update_cmd() -> Option<UpdateInfo>`
  - `download_update_cmd() -> ()` (progress streamed via events)
  - `install_update_cmd() -> ()`
- **`lib.rs`** — register commands in `invoke_handler!`.

### Frontend (`src/`)

#### `domain/`
- **`domain/update.ts`** — pure types + helpers:
  ```ts
  export interface UpdateInfo {
    version: string;
    currentVersion: string;
    notes: string | null;
    pubDate: string | null;
  }
  export interface UpdateProgress { downloaded: number; total: number | null }

  export type UpdateState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available"; info: UpdateInfo }
    | { kind: "downloading"; info: UpdateInfo; progress: UpdateProgress }
    | { kind: "ready"; info: UpdateInfo }
    | { kind: "error"; message: string };

  export function shouldSkip(info: UpdateInfo, prefs: UpdatePrefs, now: number): boolean;
  export function dueForCheck(prefs: UpdatePrefs, now: number): boolean;
  ```
  Helpers are pure; trivially unit-testable.

- **`domain/settings.ts`** — extend:
  ```ts
  export interface UpdatePrefs {
    autoCheck: boolean;
    skippedVersion: string | null;
    remindAfter: number | null;     // epoch ms
    lastCheckedAt: number | null;   // epoch ms
  }
  export interface Settings {
    launchAtLogin: boolean;
    update: UpdatePrefs;
  }
  ```
  `DEFAULT_SETTINGS.update = { autoCheck: true, skippedVersion: null, remindAfter: null, lastCheckedAt: null }`.
  Backwards compat: `tauriSettings.load()` merges loaded JSON onto `DEFAULT_SETTINGS` so older files without the `update` slice still parse.

#### `application/`
- **`application/ports.ts`** — new port (only this file changes existing types):
  ```ts
  export interface UpdateChecker {
    check(): Promise<UpdateInfo | null>;
    download(onProgress: (p: UpdateProgress) => void): Promise<void>;
    installAndRelaunch(): Promise<void>;
  }
  ```
- **`application/useUpdater.ts`** — hook owning the state machine:
  - Accepts `UpdateChecker` + `SettingsAdapter` from context.
  - On mount: if `prefs.autoCheck && dueForCheck(prefs, now)` → run check → if `info && !shouldSkip` → download → state=`ready`.
  - 24h interval timer for re-check while the app stays open.
  - Returns `UpdateController { state, manualCheck, install, remindLater, skip, dismissError }`.
  - Persists `lastCheckedAt`, `skippedVersion`, `remindAfter` via the settings adapter directly (no UI round-trip).

#### `infrastructure/`
- **`infrastructure/tauriUpdateChecker.ts`** — only file allowed to import `@tauri-apps/plugin-updater`. Implements `UpdateChecker` by calling the three Rust commands and listening to `pier://update-progress`.

#### `state/`
- **`state/UpdaterContext.tsx`** — mirrors `SettingsContext`/`RunnerContext`. Browser fallback throws "not in Tauri" on every method (consistent with existing pattern).

#### `ui/`
- **`ui/atoms/Markdown.tsx`** — minimal markdown renderer for changelog. Uses `marked` to parse and `DOMPurify.sanitize()` to scrub before rendering. The output is *only* rendered after sanitization; this is the standard sanitize-then-set pattern. Handles headings, lists, links, code, emphasis. Markdown source is from our own GitHub release notes — semi-trusted — but we sanitize regardless.
- **`ui/molecules/UpdateToast.tsx`** — fixed bottom-right pill, slide-up animation. Visible only when `state.kind === "ready"`. Click → opens dialog.
- **`ui/organisms/UpdateDialog.tsx`** — Sparkle-style modal:
  - Header: "A new version of Pier is available"
  - Subhead: "Pier {info.version} is available — you have {info.currentVersion}"
  - Scrollable `<Markdown>` body
  - Footer: `[Skip This Version]  [Remind Me Later]  [Install and Restart]` (primary right-most, matches existing `DangerConfirmDialog` button order)
- **`ui/pages/SettingsPage.tsx`** — new `SettingsSection kicker="03" label="Updates"`:
  - Row: "Automatic updates" → `Switch` bound to `prefs.autoCheck`
  - Row: "Current version" → static `0.x.y` from `tauri::package_info`
  - Row: "Last checked" → relative time, `Check for updates…` button
- **`App.tsx`** — wrap tree in `<UpdaterProvider>`; mount `<UpdateToast />` + `<UpdateDialog />` near root, driven by a single `useUpdater()` call hoisted via a small context (`UpdaterStateContext`) so toast and dialog share state without prop-drilling.

### Data flow

```
launch
  → UpdaterProvider mounts → useUpdater() runs effect
    if !autoCheck OR !dueForCheck(prefs): state=idle, stop
    else port.check()
      null               → state=idle, persist lastCheckedAt
      info && shouldSkip → state=idle, persist lastCheckedAt
      info               → state=available
                         → port.download(onProgress) → state=downloading…ready
                         → <UpdateToast> visible

user clicks toast
  → <UpdateDialog open>
    Install and Restart → port.installAndRelaunch()
    Remind Me Later     → prefs.remindAfter = now + 24h, state=idle
    Skip This Version   → prefs.skippedVersion = info.version, state=idle

Settings → "Check for updates…"
  → manualCheck(): bypasses dueForCheck + shouldSkip; same state machine downstream.
```

## Refactors bundled in

Small, justified, scoped to this change:

- `domain/settings.ts` gains a nested `update` slice. Kept in the same file — splitting is premature.
- `useSettings` is *not* extended with update mutators. The `autoCheck` toggle binds via a tiny new `setAutoCheck` method on `useSettings`. The non-user-facing fields (`skippedVersion`, `remindAfter`, `lastCheckedAt`) are written by `useUpdater` directly through the same `SettingsAdapter` — clean separation of concerns; same persistence path.
- `tauriSettings.load()` adds a defensive merge against `DEFAULT_SETTINGS` so existing `~/.pier/settings.json` files without `update` still load.

No changes to tool/run code, history, or sidebar.

## Testing

**Frontend**

- `domain/__tests__/update.test.ts` — table-driven tests for `shouldSkip` (skipped equal/older/newer, null skip) and `dueForCheck` (autoCheck off, never checked, within 24h, past 24h, remindAfter in future/past).
- `application/__tests__/useUpdater.test.tsx` — fake `UpdateChecker` + fake `SettingsAdapter`; assert:
  - auto-check on mount triggers download → ready
  - skipped version short-circuits to idle
  - remindAfter in future short-circuits to idle
  - manual check ignores both
  - Skip persists `skippedVersion` and resets state
  - Remind persists `remindAfter = now + 24h` and resets state
- `ui/molecules/__tests__/UpdateToast.test.tsx` — visible only when `state.kind==="ready"`.
- `ui/organisms/__tests__/UpdateDialog.test.tsx` — renders version line, calls correct controller method per button.
- `ui/atoms/__tests__/Markdown.test.tsx` — renders headings/lists, sanitizes a `<script>` payload.

**Backend**

- Skip — `application/update.rs` is a thin wrapper over the plugin. Manual smoke (build a tagged release, install old version, observe update flow) covers it. Adding a Rust unit test would require mocking the plugin's HTTP layer, which is more code than value.

## Acceptance

- Tagging `v0.2.0` and pushing produces a GitHub Release with signed artifacts + `latest.json`.
- A Pier 0.1.0 build, on launch, silently downloads 0.2.0 and shows the toast.
- Skip persists across restarts; remind-later silences for 24h; install relaunches into the new version.
- Manual "Check for updates…" works at any time.
- Settings round-trip the new `update` slice without losing existing fields.
