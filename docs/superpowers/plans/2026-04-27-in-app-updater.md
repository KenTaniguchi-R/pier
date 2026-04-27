# In-app updater — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Tauri-v2-based in-app auto-update with Sparkle-style UX (changelog modal, Install / Remind / Skip), system notifications + tray badge for the menu-bar hidden-window case, ad-hoc-codesigned GitHub Actions release pipeline, and a settings pane.

**Architecture:** Mirrors existing clean-architecture layering. New backend module `application/update.rs` wraps `tauri-plugin-updater`; new frontend port `UpdateChecker` + hook `useUpdater` own a state machine; concurrent settings writes go through a new `patch_settings_cmd` to eliminate last-write-wins races; UI uses a generic `Toast` molecule and a `UpdateDialog` molecule with hand-rolled `Markdown` atom.

**Tech Stack:** Tauri 2 (`tauri-plugin-updater`, `tauri-plugin-notification`), React 19, TypeScript, Tailwind v4, Vitest, Cargo (`serde`, `tokio`, `anyhow`), GitHub Actions (`tauri-apps/tauri-action@v0`), Ed25519 signing.

Reference spec: `docs/superpowers/specs/2026-04-27-in-app-updater-design.md`.

---

## File map

**Backend (`src-tauri/`)**
- Modify: `Cargo.toml` — add `tauri-plugin-updater = "2"`, `tauri-plugin-notification = "2"`.
- Modify: `src/lib.rs` — register plugins, register new commands, drop tray handle before restart.
- Modify: `src/state.rs` — add `settings_lock: tokio::sync::Mutex<()>` for serializing patch writes.
- Modify: `src/commands.rs` — register `check_update_cmd`, `install_update_cmd`, `is_translocated_cmd`, `patch_settings_cmd`, `set_tray_badge_cmd`, `notify_update_ready_cmd`.
- Modify: `src/domain/settings.rs` — add `update: UpdatePrefs` with `#[serde(default)]`.
- Create: `src/domain/update.rs` — `UpdateInfo`, `UpdateProgress` types. Register in `src/domain/mod.rs`.
- Create: `src/application/update.rs` — orchestrates `UpdaterExt`. Register in `src/application/mod.rs`.
- Modify: `src/application/settings.rs` — add `patch(app, partial)` + atomic-rename write.
- Modify: `tauri.conf.json` — add `plugins.updater` block.
- Create or modify: `capabilities/default.json` — add `updater:default`, `notification:default`.
- Create: `icons/tray-icon-update@2x.png` — tray dot variant.

**Frontend (`src/`)**
- Modify: `domain/settings.ts` — `UpdatePrefs`, `Settings`, `DEFAULT_SETTINGS`, `DeepPartial`.
- Create: `domain/update.ts` — types + `shouldSkip` + `dueForCheck` + `AUTO_CHECK_INTERVAL_MS`.
- Create: `domain/__tests__/update.test.ts`.
- Modify: `application/ports.ts` — add `UpdateChecker`; extend `SettingsAdapter` with `patch`.
- Modify: `application/useSettings.ts` — route mutators through `patch`; add `setAutoCheck`.
- Create: `application/useUpdater.ts` — state machine + persistence + focus listener.
- Create: `application/__tests__/useUpdater.test.tsx`.
- Modify: `infrastructure/tauriSettings.ts` — implement `patch`; merge against defaults; update `browserSettings`.
- Create: `infrastructure/tauriUpdateChecker.ts` — adapter + progress event listener.
- Create: `state/UpdaterContext.tsx`.
- Create: `state/UpdaterStateContext.tsx`.
- Create: `state/UpdaterControllerHost.tsx`.
- Create: `ui/atoms/Markdown.tsx` + tests.
- Create: `ui/molecules/useDialogA11y.ts`.
- Modify: `ui/molecules/SettingsRow.tsx` — make `control` optional.
- Modify: `ui/molecules/ConfirmDialog.tsx` + `DangerConfirmDialog.tsx` — focus trap + ESC + ARIA.
- Create: `ui/molecules/Toast.tsx` + tests.
- Create: `ui/molecules/UpdateToast.tsx`.
- Create: `ui/molecules/UpdateDialog.tsx` + tests.
- Modify: `ui/pages/SettingsPage.tsx` — add Updates section + inline error.
- Modify: `App.tsx` — mount providers + `<UpdateToast />`.
- Modify: `styles/tailwind.css` — `--animate-toast-in` token + `@keyframes toast-in`.
- Modify: `package.json` — add JS plugin deps.

**CI**
- Create: `.github/workflows/release.yml`.

---

## Build order

Tasks 1–6: backend foundation (cargo, plugin init, settings + patch, update module).
Tasks 7–12: frontend domain + application + infrastructure + state + useSettings.
Task 13: Tailwind tokens.
Tasks 14–19: UI atoms/molecules + Settings page + App wiring.
Tasks 20–22: tray badge + system notification + visibility-aware toast.
Task 23: GitHub Actions release pipeline.

Each task ends with a commit. Run `npm run build` (or `cargo check --manifest-path src-tauri/Cargo.toml` for backend-only tasks) before each commit; fix any errors before committing.

---

## Task 1 — Add Cargo + npm dependencies

**Files:** `src-tauri/Cargo.toml`, `package.json`

- [ ] **Step 1: Add Rust deps.** Append to `[dependencies]` in `src-tauri/Cargo.toml`:
  ```toml
  tauri-plugin-updater = "2"
  tauri-plugin-notification = "2"
  ```
- [ ] **Step 2: Add JS deps.** Run: `npm install @tauri-apps/plugin-updater @tauri-apps/plugin-notification`
- [ ] **Step 3: Verify.** Run: `cargo check --manifest-path src-tauri/Cargo.toml` — expect success.
- [ ] **Step 4: Commit.**
  ```bash
  git add src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json
  git commit -m "deps(updater): add tauri-plugin-updater + tauri-plugin-notification"
  ```

---

## Task 2 — Wire plugins, capabilities, endpoint config

**Files:** `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

- [ ] **Step 1: Generate updater keypair (one-time, manual).** Run locally: `npx @tauri-apps/cli signer generate -w ~/.tauri/pier.key`. Copy the PUBLIC key block from the output. The private key + password go into GitHub secrets in Task 23.
- [ ] **Step 2: Add updater config to `tauri.conf.json`.** Add this top-level block (sibling of `app`, `bundle`, `build`):
  ```json
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/REPLACE_OWNER/pier/releases/latest/download/latest.json"
      ],
      "pubkey": "PASTE_PUBLIC_KEY_HERE"
    }
  }
  ```
  Replace `REPLACE_OWNER` and the public key.
- [ ] **Step 3: Capability file.** If `src-tauri/capabilities/default.json` already exists, append `"updater:default"` and `"notification:default"` to its `permissions` array. If it does not exist, create:
  ```json
  {
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "Default permission set for Pier",
    "windows": ["main"],
    "permissions": [
      "core:default",
      "opener:default",
      "dialog:default",
      "updater:default",
      "notification:default"
    ]
  }
  ```
- [ ] **Step 4: Initialize plugins in `lib.rs`.** Inside the `Builder::default()` chain alongside the other `.plugin(...)` calls, add:
  ```rust
  .plugin(tauri_plugin_updater::Builder::new().build())
  .plugin(tauri_plugin_notification::init())
  ```
- [ ] **Step 5: Verify.** `cargo check --manifest-path src-tauri/Cargo.toml` — expect success.
- [ ] **Step 6: Commit.**
  ```bash
  git add src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json
  git commit -m "feat(updater): register updater + notification plugins, declare endpoints"
  ```

---

## Task 3 — Extend Rust `Settings` with `update` slice (TDD)

**Files:** `src-tauri/src/domain/settings.rs`

- [ ] **Step 1: Write failing test.** Append to the existing `#[cfg(test)] mod tests` block:
  ```rust
      #[test]
      fn loads_old_json_without_update_field() {
          let json = r#"{ "launchAtLogin": true }"#;
          let s: Settings = serde_json::from_str(json).unwrap();
          assert!(s.launch_at_login);
          assert!(s.update.auto_check);
          assert!(s.update.skipped_version.is_none());
          assert!(s.update.remind_after.is_none());
          assert!(s.update.last_checked_at.is_none());
      }
  ```
- [ ] **Step 2: Run.** `cargo test --manifest-path src-tauri/Cargo.toml --lib loads_old_json_without_update_field` — expect compile error (`update` missing).
- [ ] **Step 3: Replace `src-tauri/src/domain/settings.rs` with:**
  ```rust
  use serde::{Deserialize, Serialize};

  #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
  #[serde(rename_all = "camelCase")]
  pub struct Settings {
      #[serde(default)]
      pub launch_at_login: bool,
      #[serde(default)]
      pub update: UpdatePrefs,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
  #[serde(rename_all = "camelCase")]
  pub struct UpdatePrefs {
      #[serde(default = "default_auto_check")]
      pub auto_check: bool,
      #[serde(default)]
      pub skipped_version: Option<String>,
      #[serde(default)]
      pub remind_after: Option<i64>,
      #[serde(default)]
      pub last_checked_at: Option<i64>,
  }

  fn default_auto_check() -> bool { true }

  impl Default for UpdatePrefs {
      fn default() -> Self {
          Self {
              auto_check: true,
              skipped_version: None,
              remind_after: None,
              last_checked_at: None,
          }
      }
  }

  impl Default for Settings {
      fn default() -> Self {
          Self { launch_at_login: false, update: UpdatePrefs::default() }
      }
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn loads_old_json_without_update_field() {
          let json = r#"{ "launchAtLogin": true }"#;
          let s: Settings = serde_json::from_str(json).unwrap();
          assert!(s.launch_at_login);
          assert!(s.update.auto_check);
          assert!(s.update.skipped_version.is_none());
          assert!(s.update.remind_after.is_none());
          assert!(s.update.last_checked_at.is_none());
      }

      #[test]
      fn round_trips_full_settings() {
          let s = Settings {
              launch_at_login: true,
              update: UpdatePrefs {
                  auto_check: false,
                  skipped_version: Some("0.2.0".into()),
                  remind_after: Some(1_700_000_000_000),
                  last_checked_at: Some(1_700_000_000_000),
              },
          };
          let json = serde_json::to_string(&s).unwrap();
          let back: Settings = serde_json::from_str(&json).unwrap();
          assert_eq!(s, back);
      }
  }
  ```
- [ ] **Step 4: Run all settings tests.** `cargo test --manifest-path src-tauri/Cargo.toml --lib settings` — expect pass.
- [ ] **Step 5: Commit.**
  ```bash
  git add src-tauri/src/domain/settings.rs
  git commit -m "feat(settings): add update prefs slice with serde defaults"
  ```

---

## Task 4 — Backend `patch_settings_cmd` (atomic write + serialized lock)

**Files:** `src-tauri/src/state.rs`, `src-tauri/src/application/settings.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Add a tokio mutex to `AppState`.** Replace `src-tauri/src/state.rs`:
  ```rust
  use crate::application::tool_registry::ToolRegistry;
  use crate::domain::RunId;
  use std::collections::HashMap;
  use std::sync::{Arc, Mutex};

  pub struct RunHandle {
      pub cancel: Option<tokio::sync::oneshot::Sender<()>>,
  }

  pub struct AppState {
      pub running: Mutex<HashMap<RunId, RunHandle>>,
      pub registry: Arc<ToolRegistry>,
      pub settings_lock: tokio::sync::Mutex<()>,
  }

  impl AppState {
      pub fn new() -> Self {
          Self {
              running: Mutex::new(HashMap::new()),
              registry: Arc::new(ToolRegistry::new()),
              settings_lock: tokio::sync::Mutex::new(()),
          }
      }
  }

  impl Default for AppState {
      fn default() -> Self { Self::new() }
  }
  ```
- [ ] **Step 2: Add patch helpers.** Append to `src-tauri/src/application/settings.rs` (above the `#[cfg(test)] mod tests` block; ensure `use tauri::Manager;` is present):
  ```rust
  use serde_json::Value;

  /// Merge a partial JSON patch into the on-disk Settings; atomic via tmp+rename.
  /// Caller holds the AppState settings_lock to serialize concurrent patches.
  pub fn patch_with(path: &Path, patch: Value) -> Result<Settings> {
      let current = if path.exists() {
          let raw = std::fs::read_to_string(path)?;
          serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| Value::Object(Default::default()))
      } else {
          Value::Object(Default::default())
      };
      let merged = deep_merge(current, patch);
      let merged_settings: Settings = serde_json::from_value(merged)?;
      if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
      let tmp = path.with_extension("json.tmp");
      let json = serde_json::to_string_pretty(&merged_settings)?;
      std::fs::write(&tmp, json)?;
      std::fs::rename(&tmp, path)?;
      Ok(merged_settings)
  }

  fn deep_merge(mut base: Value, patch: Value) -> Value {
      match (&mut base, patch) {
          (Value::Object(b), Value::Object(p)) => {
              for (k, v) in p {
                  let next = b.remove(&k).unwrap_or(Value::Null);
                  b.insert(k, deep_merge(next, v));
              }
              base
          }
          (_, p) => p,
      }
  }

  pub async fn patch(app: &tauri::AppHandle, patch: Value) -> Result<Settings> {
      let state = app.state::<crate::state::AppState>();
      let _guard = state.settings_lock.lock().await;
      let merged = patch_with(&settings_path(), patch)?;
      let autolaunch = app.autolaunch();
      if merged.launch_at_login {
          let _ = autolaunch.enable();
      } else {
          let _ = autolaunch.disable();
      }
      Ok(merged)
  }
  ```
- [ ] **Step 3: Test merge correctness.** Append to the existing `#[cfg(test)] mod tests` block in the same file:
  ```rust
      #[test]
      fn patch_preserves_unrelated_fields() {
          let d = tempdir().unwrap();
          let p = d.path().join("settings.json");
          let s = Settings {
              launch_at_login: true,
              update: crate::domain::UpdatePrefs {
                  auto_check: true,
                  skipped_version: Some("0.1.0".into()),
                  remind_after: None,
                  last_checked_at: Some(100),
              },
          };
          save_to(&p, &s).unwrap();
          let patch = serde_json::json!({ "update": { "lastCheckedAt": 200 } });
          let merged = patch_with(&p, patch).unwrap();
          assert!(merged.launch_at_login);
          assert_eq!(merged.update.skipped_version.as_deref(), Some("0.1.0"));
          assert_eq!(merged.update.last_checked_at, Some(200));
      }
  ```
  Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib patch_preserves_unrelated_fields` — expect pass.
- [ ] **Step 4: Add the command.** Append to `src-tauri/src/commands.rs`:
  ```rust
  #[tauri::command]
  pub async fn patch_settings_cmd(
      app: tauri::AppHandle,
      patch: serde_json::Value,
  ) -> Result<Settings, String> {
      settings_app::patch(&app, patch).await.map_err(|e| e.to_string())
  }
  ```
- [ ] **Step 5: Register the command.** In `src-tauri/src/lib.rs` `invoke_handler![...]` add `commands::patch_settings_cmd,`.
- [ ] **Step 6: Verify.** `cargo check --manifest-path src-tauri/Cargo.toml` — success.
- [ ] **Step 7: Commit.**
  ```bash
  git add src-tauri/src/state.rs src-tauri/src/application/settings.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
  git commit -m "feat(settings): atomic patch_settings_cmd with serialized lock"
  ```

---

## Task 5 — Backend `domain/update.rs`

**Files:** `src-tauri/src/domain/update.rs`, `src-tauri/src/domain/mod.rs`

- [ ] **Step 1: Create the module.** `src-tauri/src/domain/update.rs`:
  ```rust
  use serde::{Deserialize, Serialize};

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct UpdateInfo {
      pub version: String,
      pub current_version: String,
      pub notes: Option<String>,
      pub pub_date: Option<String>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct UpdateProgress {
      pub downloaded: u64,
      pub total: Option<u64>,
  }
  ```
- [ ] **Step 2: Register in mod.** Append to `src-tauri/src/domain/mod.rs`:
  ```rust
  pub mod update;
  pub use update::*;
  ```
- [ ] **Step 3: Verify.** `cargo check --manifest-path src-tauri/Cargo.toml` — success.
- [ ] **Step 4: Commit.**
  ```bash
  git add src-tauri/src/domain/update.rs src-tauri/src/domain/mod.rs
  git commit -m "feat(updater): domain types UpdateInfo + UpdateProgress"
  ```

---

## Task 6 — Backend `application/update.rs` + commands

**Files:** `src-tauri/src/application/update.rs`, `src-tauri/src/application/mod.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Create the module.** `src-tauri/src/application/update.rs`:
  ```rust
  use crate::domain::{UpdateInfo, UpdateProgress};
  use anyhow::{anyhow, Result};
  use tauri::{Emitter, Manager};
  use tauri_plugin_updater::UpdaterExt;

  pub async fn check(app: &tauri::AppHandle) -> Result<Option<UpdateInfo>> {
      let updater = app.updater()?;
      let current = app.package_info().version.to_string();
      match updater.check().await? {
          Some(update) => Ok(Some(UpdateInfo {
              version: update.version.clone(),
              current_version: current,
              notes: update.body.clone(),
              pub_date: update.date.map(|d| d.to_string()),
          })),
          None => Ok(None),
      }
  }

  pub async fn install_and_relaunch(app: &tauri::AppHandle) -> Result<()> {
      if is_translocated()? {
          return Err(anyhow!(
              "Pier is running from a translocated path. Move it to /Applications and reopen to enable updates."
          ));
      }
      let updater = app.updater()?;
      let update = updater.check().await?
          .ok_or_else(|| anyhow!("No update available at install time"))?;

      let app_for_progress = app.clone();
      let mut total: Option<u64> = None;
      update
          .download_and_install(
              move |chunk_len, content_len| {
                  if total.is_none() { total = content_len; }
                  let p = UpdateProgress { downloaded: chunk_len as u64, total };
                  let _ = app_for_progress.emit("pier://update-progress", p);
              },
              || {},
          )
          .await?;

      if let Some(_tray) = app.tray_by_id("main-tray") {
          let _ = app.remove_tray_by_id("main-tray");
      }
      app.restart();
  }

  pub fn is_translocated() -> Result<bool> {
      let exe = std::env::current_exe()?;
      Ok(exe.to_string_lossy().contains("AppTranslocation"))
  }
  ```
- [ ] **Step 2: Register module.** Append to `src-tauri/src/application/mod.rs`: `pub mod update;`
- [ ] **Step 3: Add commands.** Append to `src-tauri/src/commands.rs`:
  ```rust
  use crate::application::update as update_app;
  use crate::domain::UpdateInfo;

  #[tauri::command]
  pub async fn check_update_cmd(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
      update_app::check(&app).await.map_err(|e| e.to_string())
  }

  #[tauri::command]
  pub async fn install_update_cmd(app: tauri::AppHandle) -> Result<(), String> {
      update_app::install_and_relaunch(&app).await.map_err(|e| e.to_string())
  }

  #[tauri::command]
  pub fn is_translocated_cmd() -> Result<bool, String> {
      update_app::is_translocated().map_err(|e| e.to_string())
  }
  ```
- [ ] **Step 4: Register commands.** In `src-tauri/src/lib.rs` `invoke_handler![...]` append:
  ```rust
              commands::check_update_cmd,
              commands::install_update_cmd,
              commands::is_translocated_cmd,
  ```
- [ ] **Step 5: Verify.** `cargo check --manifest-path src-tauri/Cargo.toml` — success. If a tray-API name differs, the compiler will tell you the correct method.
- [ ] **Step 6: Commit.**
  ```bash
  git add src-tauri/src/application/update.rs src-tauri/src/application/mod.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
  git commit -m "feat(updater): application module + check/install/translocation commands"
  ```

---

## Task 7 — Frontend domain types + helpers (TDD)

**Files:** `src/domain/settings.ts`, `src/domain/update.ts`, `src/domain/__tests__/update.test.ts`

- [ ] **Step 1: Replace `src/domain/settings.ts` with:**
  ```ts
  export interface UpdatePrefs {
    autoCheck: boolean;
    skippedVersion: string | null;
    remindAfter: number | null;
    lastCheckedAt: number | null;
  }

  export interface Settings {
    launchAtLogin: boolean;
    update: UpdatePrefs;
  }

  export const DEFAULT_UPDATE_PREFS: UpdatePrefs = {
    autoCheck: true,
    skippedVersion: null,
    remindAfter: null,
    lastCheckedAt: null,
  };

  export const DEFAULT_SETTINGS: Settings = {
    launchAtLogin: false,
    update: DEFAULT_UPDATE_PREFS,
  };

  export interface HistoryStats {
    runCount: number;
    bytes: number;
  }

  export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object | null
      ? T[K] extends null
        ? T[K] | null
        : DeepPartial<NonNullable<T[K]>> | null
      : T[K];
  };
  ```
- [ ] **Step 2: Failing tests.** Create `src/domain/__tests__/update.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { shouldSkip, dueForCheck, AUTO_CHECK_INTERVAL_MS } from "../update";
  import { DEFAULT_UPDATE_PREFS, type UpdatePrefs } from "../settings";

  const NOW = 1_700_000_000_000;
  const info = (v: string) => ({ version: v, currentVersion: "0.1.0", notes: null, pubDate: null });

  describe("shouldSkip", () => {
    it("skips when version matches skippedVersion", () => {
      const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, skippedVersion: "0.2.0" };
      expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(true);
    });
    it("does not skip when versions differ", () => {
      const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, skippedVersion: "0.1.5" };
      expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(false);
    });
    it("skips while remindAfter is in the future", () => {
      const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, remindAfter: NOW + 1000 };
      expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(true);
    });
    it("does not skip after remindAfter has passed", () => {
      const prefs: UpdatePrefs = { ...DEFAULT_UPDATE_PREFS, remindAfter: NOW - 1000 };
      expect(shouldSkip(info("0.2.0"), prefs, NOW)).toBe(false);
    });
    it("does not skip with default prefs", () => {
      expect(shouldSkip(info("0.2.0"), DEFAULT_UPDATE_PREFS, NOW)).toBe(false);
    });
  });

  describe("dueForCheck", () => {
    it("false when autoCheck off", () => {
      expect(dueForCheck({ ...DEFAULT_UPDATE_PREFS, autoCheck: false }, NOW)).toBe(false);
    });
    it("true when never checked", () => {
      expect(dueForCheck(DEFAULT_UPDATE_PREFS, NOW)).toBe(true);
    });
    it("false when within interval", () => {
      expect(dueForCheck({ ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - 1000 }, NOW)).toBe(false);
    });
    it("true when past interval", () => {
      expect(
        dueForCheck({ ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - AUTO_CHECK_INTERVAL_MS - 1000 }, NOW),
      ).toBe(true);
    });
    it("false when remindAfter is in the future", () => {
      expect(
        dueForCheck(
          { ...DEFAULT_UPDATE_PREFS, lastCheckedAt: NOW - AUTO_CHECK_INTERVAL_MS - 1000, remindAfter: NOW + 1000 },
          NOW,
        ),
      ).toBe(false);
    });
  });
  ```
  Run: `npx vitest run src/domain/__tests__/update.test.ts` — expect FAIL.
- [ ] **Step 3: Implement `src/domain/update.ts`:**
  ```ts
  import type { UpdatePrefs } from "./settings";

  export interface UpdateInfo {
    version: string;
    currentVersion: string;
    notes: string | null;
    pubDate: string | null;
  }

  export interface UpdateProgress {
    downloaded: number;
    total: number | null;
  }

  export type UpdateState =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available"; info: UpdateInfo }
    | { kind: "downloading"; info: UpdateInfo; progress: UpdateProgress }
    | { kind: "ready"; info: UpdateInfo }
    | { kind: "error"; message: string; lastInfo: UpdateInfo | null };

  export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

  export function shouldSkip(info: UpdateInfo, prefs: UpdatePrefs, now: number): boolean {
    if (prefs.skippedVersion && prefs.skippedVersion === info.version) return true;
    if (prefs.remindAfter !== null && prefs.remindAfter > now) return true;
    return false;
  }

  export function dueForCheck(prefs: UpdatePrefs, now: number): boolean {
    if (!prefs.autoCheck) return false;
    if (prefs.remindAfter !== null && prefs.remindAfter > now) return false;
    if (prefs.lastCheckedAt === null) return true;
    return now - prefs.lastCheckedAt >= AUTO_CHECK_INTERVAL_MS;
  }
  ```
- [ ] **Step 4: Run tests.** `npx vitest run src/domain/__tests__/update.test.ts` — expect 10 passing.
- [ ] **Step 5: Commit.**
  ```bash
  git add src/domain/settings.ts src/domain/update.ts src/domain/__tests__/update.test.ts
  git commit -m "feat(updater): domain types + shouldSkip/dueForCheck helpers"
  ```

---

## Task 8 — `SettingsAdapter.patch` + adapter rewrite

**Files:** `src/application/ports.ts`, `src/infrastructure/tauriSettings.ts`

- [ ] **Step 1: Extend the port.** In `src/application/ports.ts`, replace the `SettingsAdapter` interface with:
  ```ts
  export interface SettingsAdapter {
    load(): Promise<import("../domain/settings").Settings>;
    save(settings: import("../domain/settings").Settings): Promise<void>;
    patch(
      partial: import("../domain/settings").DeepPartial<import("../domain/settings").Settings>,
    ): Promise<import("../domain/settings").Settings>;
    historyStats(): Promise<import("../domain/settings").HistoryStats>;
    clearHistory(): Promise<void>;
  }
  ```
- [ ] **Step 2: Replace `src/infrastructure/tauriSettings.ts`:**
  ```ts
  import { invoke } from "@tauri-apps/api/core";
  import type { SettingsAdapter } from "../application/ports";
  import {
    DEFAULT_SETTINGS,
    DEFAULT_UPDATE_PREFS,
    type DeepPartial,
    type HistoryStats,
    type Settings,
  } from "../domain/settings";

  function withDefaults(s: Partial<Settings> | null | undefined): Settings {
    return {
      launchAtLogin: s?.launchAtLogin ?? DEFAULT_SETTINGS.launchAtLogin,
      update: { ...DEFAULT_UPDATE_PREFS, ...(s?.update ?? {}) },
    };
  }

  export const tauriSettings: SettingsAdapter = {
    async load() { return withDefaults(await invoke<Settings>("load_settings")); },
    async save(settings) { await invoke("save_settings", { settings }); },
    async patch(partial) { return withDefaults(await invoke<Settings>("patch_settings_cmd", { patch: partial })); },
    async historyStats() { return invoke<HistoryStats>("history_stats_cmd"); },
    async clearHistory() { await invoke("clear_history_cmd"); },
  };

  let memoryStore: Settings = { ...DEFAULT_SETTINGS };
  const memoryStats: HistoryStats = { runCount: 0, bytes: 0 };

  function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
    if (patch === null || typeof patch !== "object") return patch as unknown as T;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(patch as Record<string, unknown>)) {
      const v = (patch as Record<string, unknown>)[k];
      const b = out[k];
      if (v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object") {
        out[k] = deepMerge(b as object, v as DeepPartial<object>);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }

  export const browserSettings: SettingsAdapter = {
    async load() { return withDefaults(memoryStore); },
    async save(s) { memoryStore = withDefaults(s); },
    async patch(partial) {
      memoryStore = deepMerge(memoryStore, partial as DeepPartial<Settings>);
      return withDefaults(memoryStore);
    },
    async historyStats() { return { ...memoryStats }; },
    async clearHistory() { memoryStats.runCount = 0; memoryStats.bytes = 0; },
  };

  export const defaultSettingsAdapter: SettingsAdapter =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
      ? tauriSettings
      : browserSettings;
  ```
- [ ] **Step 3: Verify.** `npm run build` and `npx vitest run` — both green.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/application/ports.ts src/infrastructure/tauriSettings.ts
  git commit -m "feat(settings): patch port + adapter; defensive merge against defaults"
  ```

---

## Task 9 — `UpdateChecker` port + Tauri adapter

**Files:** `src/application/ports.ts`, `src/infrastructure/tauriUpdateChecker.ts`

- [ ] **Step 1: Add port.** Append to `src/application/ports.ts`:
  ```ts
  import type { UpdateInfo, UpdateProgress } from "../domain/update";

  export interface UpdateChecker {
    check(): Promise<UpdateInfo | null>;
    installAndRelaunch(onProgress: (p: UpdateProgress) => void): Promise<void>;
    isTranslocated(): Promise<boolean>;
  }
  ```
- [ ] **Step 2: Implement adapter.** Create `src/infrastructure/tauriUpdateChecker.ts`:
  ```ts
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import type { UpdateChecker } from "../application/ports";
  import type { UpdateInfo, UpdateProgress } from "../domain/update";

  export const tauriUpdateChecker: UpdateChecker = {
    async check() { return invoke<UpdateInfo | null>("check_update_cmd"); },
    async installAndRelaunch(onProgress) {
      let unlisten: UnlistenFn | null = null;
      try {
        unlisten = await listen<UpdateProgress>("pier://update-progress", (e) => onProgress(e.payload));
        await invoke("install_update_cmd");
      } finally {
        if (unlisten) unlisten();
      }
    },
    async isTranslocated() { return invoke<boolean>("is_translocated_cmd"); },
  };

  export const browserUpdateChecker: UpdateChecker = {
    async check() { return null; },
    async installAndRelaunch() { throw new Error("Updater unavailable in browser preview"); },
    async isTranslocated() { return false; },
  };

  export const defaultUpdateChecker: UpdateChecker =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
      ? tauriUpdateChecker
      : browserUpdateChecker;
  ```
- [ ] **Step 3: Verify.** `npm run build` — success.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/application/ports.ts src/infrastructure/tauriUpdateChecker.ts
  git commit -m "feat(updater): UpdateChecker port + Tauri adapter"
  ```

---

## Task 10 — Updater contexts

**Files:** `src/state/UpdaterContext.tsx`, `src/state/UpdaterStateContext.tsx`

- [ ] **Step 1: Adapter context.** Create `src/state/UpdaterContext.tsx`:
  ```tsx
  import { createContext, useContext } from "react";
  import type { ReactNode } from "react";
  import type { UpdateChecker } from "../application/ports";

  const Ctx = createContext<UpdateChecker | null>(null);

  export function UpdaterProvider({ checker, children }: { checker: UpdateChecker; children: ReactNode }) {
    return <Ctx.Provider value={checker}>{children}</Ctx.Provider>;
  }

  export function useUpdateChecker(): UpdateChecker {
    const c = useContext(Ctx);
    if (!c) throw new Error("UpdaterProvider missing");
    return c;
  }
  ```
- [ ] **Step 2: State-sharing context.** Create `src/state/UpdaterStateContext.tsx`:
  ```tsx
  import { createContext, useContext } from "react";
  import type { ReactNode } from "react";
  import type { UpdateController } from "../application/useUpdater";

  const Ctx = createContext<UpdateController | null>(null);

  export function UpdaterStateProvider({ controller, children }: { controller: UpdateController; children: ReactNode }) {
    return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
  }

  export function useUpdaterState(): UpdateController {
    const c = useContext(Ctx);
    if (!c) throw new Error("UpdaterStateProvider missing");
    return c;
  }
  ```
- [ ] **Step 3: Note.** The TS compiler will complain about the missing `UpdateController` import until Task 11 lands; commit anyway, Task 11 is the very next commit.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/state/UpdaterContext.tsx src/state/UpdaterStateContext.tsx
  git commit -m "feat(updater): contexts for checker port + shared controller state"
  ```

---

## Task 11 — `useUpdater` hook (TDD)

**Files:** `src/application/useUpdater.ts`, `src/application/__tests__/useUpdater.test.tsx`

- [ ] **Step 1: Failing tests.** Create `src/application/__tests__/useUpdater.test.tsx`:
  ```tsx
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { renderHook, act, waitFor } from "@testing-library/react";
  import type { ReactNode } from "react";
  import { UpdaterProvider } from "../../state/UpdaterContext";
  import { SettingsProvider } from "../../state/SettingsContext";
  import { browserSettings } from "../../infrastructure/tauriSettings";
  import { useUpdater } from "../useUpdater";
  import type { UpdateChecker } from "../ports";
  import { DEFAULT_SETTINGS } from "../../domain/settings";

  function makeChecker(overrides: Partial<UpdateChecker> = {}): UpdateChecker {
    return {
      check: vi.fn().mockResolvedValue(null),
      installAndRelaunch: vi.fn().mockResolvedValue(undefined),
      isTranslocated: vi.fn().mockResolvedValue(false),
      ...overrides,
    };
  }

  function wrap(checker: UpdateChecker) {
    return ({ children }: { children: ReactNode }) => (
      <SettingsProvider adapter={browserSettings}>
        <UpdaterProvider checker={checker}>{children}</UpdaterProvider>
      </SettingsProvider>
    );
  }

  beforeEach(async () => { await browserSettings.save({ ...DEFAULT_SETTINGS }); });

  describe("useUpdater", () => {
    it("idle on mount when no update", async () => {
      const checker = makeChecker();
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(checker.check).toHaveBeenCalled());
      expect(result.current.state.kind).toBe("idle");
    });

    it("auto-downloads to ready when update available", async () => {
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({
        check: vi.fn().mockResolvedValue(info),
        installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 100, total: 100 }); }),
      });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    });

    it("skipped version short-circuits to idle", async () => {
      await browserSettings.save({
        ...DEFAULT_SETTINGS,
        update: { ...DEFAULT_SETTINGS.update, skippedVersion: "0.2.0" },
      });
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({ check: vi.fn().mockResolvedValue(info) });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(checker.check).toHaveBeenCalled());
      expect(result.current.state.kind).toBe("idle");
      expect(checker.installAndRelaunch).not.toHaveBeenCalled();
    });

    it("download failure surfaces error with lastInfo", async () => {
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({
        check: vi.fn().mockResolvedValue(info),
        installAndRelaunch: vi.fn().mockRejectedValue(new Error("network down")),
      });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("error"));
      if (result.current.state.kind === "error") {
        expect(result.current.state.lastInfo?.version).toBe("0.2.0");
      }
      act(() => result.current.dismissError());
      expect(result.current.state.kind).toBe("idle");
    });

    it("Skip persists skippedVersion", async () => {
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({
        check: vi.fn().mockResolvedValue(info),
        installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 1, total: 1 }); }),
      });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("ready"));
      await act(async () => { await result.current.skip(); });
      const s = await browserSettings.load();
      expect(s.update.skippedVersion).toBe("0.2.0");
      expect(result.current.state.kind).toBe("idle");
    });

    it("Remind persists remindAfter ~24h ahead", async () => {
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({
        check: vi.fn().mockResolvedValue(info),
        installAndRelaunch: vi.fn(async (cb) => { cb({ downloaded: 1, total: 1 }); }),
      });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("ready"));
      const before = Date.now();
      await act(async () => { await result.current.remindLater(); });
      const s = await browserSettings.load();
      expect(s.update.remindAfter).not.toBeNull();
      expect(s.update.remindAfter! - before).toBeGreaterThan(23 * 60 * 60 * 1000);
    });

    it("manualCheck during download is a no-op", async () => {
      let resolveInstall: () => void = () => {};
      const info = { version: "0.2.0", currentVersion: "0.1.0", notes: null, pubDate: null };
      const checker = makeChecker({
        check: vi.fn().mockResolvedValue(info),
        installAndRelaunch: vi.fn(() => new Promise<void>((res) => { resolveInstall = res; })),
      });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("downloading"));
      const before = (checker.check as any).mock.calls.length;
      await act(async () => { await result.current.manualCheck(); });
      expect((checker.check as any).mock.calls.length).toBe(before);
      resolveInstall();
    });

    it("translocated bundle puts state into error on launch", async () => {
      const checker = makeChecker({ isTranslocated: vi.fn().mockResolvedValue(true) });
      const { result } = renderHook(() => useUpdater(), { wrapper: wrap(checker) });
      await waitFor(() => expect(result.current.state.kind).toBe("error"));
      expect(checker.check).not.toHaveBeenCalled();
    });
  });
  ```
  Run: `npx vitest run src/application/__tests__/useUpdater.test.tsx` — expect FAIL (module missing).
- [ ] **Step 2: Implement.** Create `src/application/useUpdater.ts`:
  ```ts
  import { useCallback, useEffect, useReducer, useRef } from "react";
  import type { UpdateInfo, UpdateProgress, UpdateState } from "../domain/update";
  import { AUTO_CHECK_INTERVAL_MS, dueForCheck, shouldSkip } from "../domain/update";
  import { DEFAULT_UPDATE_PREFS, type UpdatePrefs } from "../domain/settings";
  import { useUpdateChecker } from "../state/UpdaterContext";
  import { useSettingsAdapter } from "../state/SettingsContext";

  const POLL_MS = 15 * 60 * 1000;

  export interface UpdateController {
    state: UpdateState;
    manualCheck: () => Promise<void>;
    install: () => Promise<void>;
    remindLater: () => Promise<void>;
    skip: () => Promise<void>;
    dismissError: () => void;
  }

  type Action =
    | { type: "set"; state: UpdateState }
    | { type: "progress"; progress: UpdateProgress };

  function reducer(prev: UpdateState, a: Action): UpdateState {
    if (a.type === "set") return a.state;
    if (a.type === "progress" && prev.kind === "downloading") return { ...prev, progress: a.progress };
    return prev;
  }

  export function useUpdater(): UpdateController {
    const checker = useUpdateChecker();
    const settings = useSettingsAdapter();
    const [state, dispatch] = useReducer(reducer, { kind: "idle" } as UpdateState);
    const stateRef = useRef<UpdateState>(state);
    stateRef.current = state;
    const prefsRef = useRef<UpdatePrefs>(DEFAULT_UPDATE_PREFS);

    const isBusy = useCallback(
      () => stateRef.current.kind === "checking" || stateRef.current.kind === "downloading",
      [],
    );

    const runFlow = useCallback(
      async (opts: { manual: boolean }) => {
        if (isBusy()) return;
        dispatch({ type: "set", state: { kind: "checking" } });
        try {
          const info = await checker.check();
          const merged = await settings.patch({ update: { lastCheckedAt: Date.now() } });
          prefsRef.current = merged.update;
          if (!info) { dispatch({ type: "set", state: { kind: "idle" } }); return; }
          if (!opts.manual && shouldSkip(info, merged.update, Date.now())) {
            dispatch({ type: "set", state: { kind: "idle" } }); return;
          }
          if (!merged.update.autoCheck && !opts.manual) {
            dispatch({ type: "set", state: { kind: "available", info } }); return;
          }
          dispatch({ type: "set", state: { kind: "downloading", info, progress: { downloaded: 0, total: null } } });
          try {
            await checker.installAndRelaunch((p) => dispatch({ type: "progress", progress: p }));
            dispatch({ type: "set", state: { kind: "ready", info } });
          } catch (err) {
            dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: info } });
          }
        } catch (err) {
          dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: null } });
        }
      },
      [checker, settings, isBusy],
    );

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const translocated = await checker.isTranslocated();
          if (cancelled) return;
          if (translocated) {
            dispatch({ type: "set", state: {
              kind: "error",
              message: "Move Pier to /Applications and reopen to enable updates.",
              lastInfo: null,
            }});
            return;
          }
          const s = await settings.load();
          if (cancelled) return;
          prefsRef.current = s.update;
          if (dueForCheck(s.update, Date.now())) await runFlow({ manual: false });
        } catch {/* swallow boot errors */}
      })();
      return () => { cancelled = true; };
    }, [checker, settings, runFlow]);

    useEffect(() => {
      const tick = async () => {
        if (isBusy()) return;
        const s = await settings.load();
        prefsRef.current = s.update;
        if (dueForCheck(s.update, Date.now())) await runFlow({ manual: false });
      };
      const onFocus = () => { void tick(); };
      const interval = setInterval(() => { void tick(); }, POLL_MS);
      if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
      return () => {
        clearInterval(interval);
        if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
      };
    }, [settings, runFlow, isBusy]);

    const manualCheck = useCallback(async () => { await runFlow({ manual: true }); }, [runFlow]);

    const install = useCallback(async () => {
      const cur = stateRef.current;
      if (cur.kind !== "ready" && cur.kind !== "available") return;
      const info = (cur as { info: UpdateInfo }).info;
      dispatch({ type: "set", state: { kind: "downloading", info, progress: { downloaded: 0, total: null } } });
      try {
        await checker.installAndRelaunch((p) => dispatch({ type: "progress", progress: p }));
        dispatch({ type: "set", state: { kind: "ready", info } });
      } catch (err) {
        dispatch({ type: "set", state: { kind: "error", message: String(err), lastInfo: info } });
      }
    }, [checker]);

    const skip = useCallback(async () => {
      const cur = stateRef.current;
      const info = "info" in cur ? (cur as { info?: UpdateInfo }).info ?? null : null;
      if (!info) { dispatch({ type: "set", state: { kind: "idle" } }); return; }
      await settings.patch({ update: { skippedVersion: info.version } });
      dispatch({ type: "set", state: { kind: "idle" } });
    }, [settings]);

    const remindLater = useCallback(async () => {
      await settings.patch({ update: { remindAfter: Date.now() + AUTO_CHECK_INTERVAL_MS } });
      dispatch({ type: "set", state: { kind: "idle" } });
    }, [settings]);

    const dismissError = useCallback(() => {
      dispatch({ type: "set", state: { kind: "idle" } });
    }, []);

    return { state, manualCheck, install, remindLater, skip, dismissError };
  }
  ```
- [ ] **Step 3: Run tests.** `npx vitest run src/application/__tests__/useUpdater.test.tsx` — expect 8 passing. (If a test that depends on a transition flakes due to JSDOM scheduling, increase the `waitFor` timeout to 2000ms; do not change behavior.)
- [ ] **Step 4: Commit.**
  ```bash
  git add src/application/useUpdater.ts src/application/__tests__/useUpdater.test.tsx
  git commit -m "feat(updater): useUpdater hook with state machine + persistence"
  ```

---

## Task 12 — `useSettings`: route through `patch`, add `setAutoCheck`

**Files:** `src/application/useSettings.ts`

- [ ] **Step 1: Replace `src/application/useSettings.ts`:**
  ```ts
  import { useCallback, useEffect, useState } from "react";
  import { DEFAULT_SETTINGS, type HistoryStats, type Settings } from "../domain/settings";
  import { useSettingsAdapter } from "../state/SettingsContext";

  export interface SettingsController {
    settings: Settings;
    stats: HistoryStats | null;
    setLaunchAtLogin: (next: boolean) => Promise<void>;
    savingLogin: boolean;
    setAutoCheck: (next: boolean) => Promise<void>;
    clearHistory: () => Promise<void>;
    clearing: boolean;
    justCleared: boolean;
  }

  export function useSettings(): SettingsController {
    const adapter = useSettingsAdapter();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [stats, setStats] = useState<HistoryStats | null>(null);
    const [savingLogin, setSavingLogin] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [justCleared, setJustCleared] = useState(false);

    const refreshStats = useCallback(() => {
      adapter.historyStats().then(setStats).catch(() => setStats({ runCount: 0, bytes: 0 }));
    }, [adapter]);

    useEffect(() => {
      adapter.load().then(setSettings).catch(() => {});
      refreshStats();
    }, [adapter, refreshStats]);

    const setLaunchAtLogin = async (next: boolean) => {
      const prev = settings;
      setSettings({ ...prev, launchAtLogin: next });
      setSavingLogin(true);
      try {
        const merged = await adapter.patch({ launchAtLogin: next });
        setSettings(merged);
      } catch { setSettings(prev); }
      finally { setSavingLogin(false); }
    };

    const setAutoCheck = async (next: boolean) => {
      const prev = settings;
      setSettings({ ...prev, update: { ...prev.update, autoCheck: next } });
      try {
        const merged = await adapter.patch({ update: { autoCheck: next } });
        setSettings(merged);
      } catch { setSettings(prev); }
    };

    const clearHistory = async () => {
      setClearing(true);
      try {
        await adapter.clearHistory();
        setJustCleared(true);
        setTimeout(() => setJustCleared(false), 1800);
        refreshStats();
      } finally { setClearing(false); }
    };

    return { settings, stats, setLaunchAtLogin, savingLogin, setAutoCheck, clearHistory, clearing, justCleared };
  }
  ```
- [ ] **Step 2: Verify.** `npx vitest run` — green.
- [ ] **Step 3: Commit.**
  ```bash
  git add src/application/useSettings.ts
  git commit -m "feat(settings): route mutators through patch; add setAutoCheck"
  ```

---

## Task 13 — Tailwind toast token

**Files:** `src/styles/tailwind.css`

- [ ] **Step 1: Add the animate token.** Inside the existing `@theme { ... }` block in `src/styles/tailwind.css`, alongside the other `--animate-*` tokens, add:
  ```css
    --animate-toast-in: toast-in 220ms var(--ease-smooth-out);
  ```
- [ ] **Step 2: Add the keyframes.** In the same `@theme` block alongside other `@keyframes`:
  ```css
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  ```
- [ ] **Step 3: Verify.** `npm run build` — success.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/styles/tailwind.css
  git commit -m "style(tokens): toast-in animation"
  ```

---

## Task 14 — `Markdown` atom (TDD)

**Files:** `src/ui/atoms/Markdown.tsx`, `src/ui/atoms/__tests__/Markdown.test.tsx`

- [ ] **Step 1: Failing tests.** Create `src/ui/atoms/__tests__/Markdown.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import { Markdown } from "../Markdown";
  import { OpenerProvider } from "../../../state/OpenerContext";

  const opener = { open: async () => {} };
  function R(src: string) {
    return render(
      <OpenerProvider opener={opener}>
        <Markdown source={src} />
      </OpenerProvider>,
    );
  }

  describe("Markdown", () => {
    it("renders an h2 heading", () => { R("## Hello"); expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hello"); });
    it("renders an unordered list", () => { R("- one\n- two"); expect(screen.getAllByRole("listitem")).toHaveLength(2); });
    it("does not inject <script>", () => { R("<script>window.PWNED=1</script>"); expect(document.querySelector("script")).toBeNull(); });
    it("renders a link via SafeLink", () => { R("Visit [Pier](https://example.com)."); expect(screen.getByRole("link", { name: "Pier" })).toBeInTheDocument(); });
    it("renders inline code", () => { const { container } = R("Use `npm test`."); expect(container.querySelector("code")?.textContent).toBe("npm test"); });
  });
  ```
  Run: `npx vitest run src/ui/atoms/__tests__/Markdown.test.tsx` — FAIL.
- [ ] **Step 2: Implement.** Create `src/ui/atoms/Markdown.tsx`:
  ```tsx
  import type { ReactNode } from "react";
  import { SafeLink } from "./SafeLink";

  interface Props { source: string }

  export function Markdown({ source }: Props) {
    return <div className="font-body text-[13px] leading-[1.6] text-ink-2">{renderBlocks(source)}</div>;
  }

  function renderBlocks(src: string): ReactNode[] {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    const nodes: ReactNode[] = [];
    let i = 0;
    let key = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") { i++; continue; }
      if (/^```/.test(line)) {
        const buf: string[] = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        nodes.push(
          <pre key={key++} className="my-3 px-3 py-2 bg-bg-2 border border-line rounded-[10px] font-mono text-[12px] leading-[1.5] text-ink-2 whitespace-pre-wrap break-all">{buf.join("\n")}</pre>,
        );
        continue;
      }
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1].length;
        const Tag = (`h${level}` as "h1" | "h2" | "h3");
        const cls = level === 1
          ? "font-display text-[20px] font-semibold text-ink mt-4 mb-2"
          : level === 2
          ? "font-display text-[16px] font-semibold text-ink mt-4 mb-2"
          : "font-display text-[14px] font-semibold text-ink mt-3 mb-1";
        nodes.push(<Tag key={key++} className={cls}>{renderInline(h[2], () => key++)}</Tag>);
        i++;
        continue;
      }
      if (/^(\s*[-*]\s+|\s*\d+\.\s+)/.test(line)) {
        const ordered = /^\s*\d+\.\s+/.test(line);
        const items: string[] = [];
        while (i < lines.length && /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
          items.push(lines[i].replace(/^(\s*[-*]\s+|\s*\d+\.\s+)/, ""));
          i++;
        }
        const ListTag = ordered ? "ol" : "ul";
        const cls = ordered ? "list-decimal pl-5 my-2 space-y-1" : "list-disc pl-5 my-2 space-y-1";
        nodes.push(
          <ListTag key={key++} className={cls}>
            {items.map((it, idx) => <li key={idx}>{renderInline(it, () => key++)}</li>)}
          </ListTag>,
        );
        continue;
      }
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(```|#|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
        paraLines.push(lines[i]); i++;
      }
      if (paraLines.length > 0) {
        nodes.push(<p key={key++} className="my-2">{renderInline(paraLines.join(" "), () => key++)}</p>);
      }
    }
    return nodes;
  }

  function renderInline(src: string, nextKey: () => number): ReactNode[] {
    const out: ReactNode[] = [];
    const re = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (m.index > last) out.push(src.slice(last, m.index));
      if (m[1]) {
        out.push(<SafeLink key={nextKey()} url={m[3]}>{m[2]}</SafeLink>);
      } else if (m[4]) {
        out.push(<code key={nextKey()} className="font-mono text-[12px] bg-bg-2 border border-line rounded-[6px] px-1 py-px">{m[5]}</code>);
      } else if (m[6]) {
        out.push(<strong key={nextKey()} className="font-semibold text-ink">{m[7]}</strong>);
      } else if (m[8]) {
        out.push(<em key={nextKey()} className="italic">{m[9]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < src.length) out.push(src.slice(last));
    return out;
  }
  ```
- [ ] **Step 3: Run tests.** `npx vitest run src/ui/atoms/__tests__/Markdown.test.tsx` — 5 passing.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/ui/atoms/Markdown.tsx src/ui/atoms/__tests__/Markdown.test.tsx
  git commit -m "feat(ui): hand-rolled Markdown atom (no deps, no innerHTML)"
  ```

---

## Task 15 — A11y refactor: focus trap, ESC, ARIA on existing dialogs

**Files:** `src/ui/molecules/useDialogA11y.ts`, `src/ui/molecules/ConfirmDialog.tsx`, `src/ui/molecules/DangerConfirmDialog.tsx`

- [ ] **Step 1: Create the hook.** `src/ui/molecules/useDialogA11y.ts`:
  ```ts
  import { useEffect, useRef } from "react";

  interface Opts { open: boolean; onEscape: () => void }

  export function useDialogA11y({ open, onEscape }: Opts) {
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);

    useEffect(() => {
      if (!open) return;
      triggerRef.current = document.activeElement;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = () =>
        Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
          ),
        );
      const first = focusables()[0];
      if (first) first.focus();

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") { e.preventDefault(); onEscape(); return; }
        if (e.key === "Tab") {
          const items = focusables();
          if (items.length === 0) return;
          const f0 = items[0];
          const fn = items[items.length - 1];
          if (e.shiftKey && document.activeElement === f0) { e.preventDefault(); fn.focus(); }
          else if (!e.shiftKey && document.activeElement === fn) { e.preventDefault(); f0.focus(); }
        }
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("keydown", onKey);
        const trigger = triggerRef.current as HTMLElement | null;
        if (trigger && typeof trigger.focus === "function") trigger.focus();
      };
    }, [open, onEscape]);

    return panelRef;
  }
  ```
- [ ] **Step 2: Update `ConfirmDialog.tsx`.** Replace contents with the version that adds `useDialogA11y({ open, onEscape: onCancel })` to the inner panel ref and adds `aria-labelledby="cd-title"` on the dialog wrapper plus `id="cd-title"` on the h2. Use the existing JSX structure verbatim except for those three changes.
- [ ] **Step 3: Update `DangerConfirmDialog.tsx`.** Same change pattern: `useDialogA11y({ open, onEscape: onCancel })` ref on the panel, `aria-labelledby="dcd-title"` + `aria-describedby="dcd-msg"` on the wrapper, `id="dcd-title"` on the h2, `id="dcd-msg"` on the message `<p>`.
- [ ] **Step 4: Run tests.** `npx vitest run` — green (existing tests don't assert focus behavior).
- [ ] **Step 5: Commit.**
  ```bash
  git add src/ui/molecules/useDialogA11y.ts src/ui/molecules/ConfirmDialog.tsx src/ui/molecules/DangerConfirmDialog.tsx
  git commit -m "feat(ui): focus-trap + ESC + ARIA on existing dialogs"
  ```

---

## Task 16 — Generic `Toast` molecule (TDD)

**Files:** `src/ui/molecules/Toast.tsx`, `src/ui/molecules/__tests__/Toast.test.tsx`

- [ ] **Step 1: Failing tests.** Create `src/ui/molecules/__tests__/Toast.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { Toast } from "../Toast";

  describe("Toast", () => {
    it("renders only when open", () => {
      const { rerender, queryByRole } = render(<Toast open={false}>hi</Toast>);
      expect(queryByRole("status")).toBeNull();
      rerender(<Toast open={true}>hi</Toast>);
      expect(queryByRole("status")).not.toBeNull();
    });
    it("ESC fires onDismiss", () => {
      const onDismiss = vi.fn();
      render(<Toast open onDismiss={onDismiss}>hi</Toast>);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onDismiss).toHaveBeenCalled();
    });
    it("clicking the action fires its handler", () => {
      const onClick = vi.fn();
      render(<Toast open action={{ label: "Go", onClick }}>hi</Toast>);
      fireEvent.click(screen.getByRole("button", { name: "Go" }));
      expect(onClick).toHaveBeenCalled();
    });
  });
  ```
  Run: `npx vitest run src/ui/molecules/__tests__/Toast.test.tsx` — FAIL.
- [ ] **Step 2: Implement.** Create `src/ui/molecules/Toast.tsx`:
  ```tsx
  import { useEffect, type ReactNode } from "react";

  interface Action { label: string; onClick: () => void }

  interface Props {
    open: boolean;
    children: ReactNode;
    action?: Action;
    onDismiss?: () => void;
    variant?: "info" | "error";
  }

  export function Toast({ open, children, action, onDismiss, variant = "info" }: Props) {
    useEffect(() => {
      if (!open || !onDismiss) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, onDismiss]);

    if (!open) return null;

    const bg = variant === "error"
      ? "bg-danger-soft border-danger text-danger"
      : "bg-surface border-line text-ink";

    return (
      <div role="status" aria-live="polite"
           className={`fixed bottom-5 right-5 z-40 flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-[12px] border shadow-pop animate-toast-in ${bg}`}>
        <div className="font-body text-[13px] leading-[1.4]">{children}</div>
        {action && (
          <button onClick={action.onClick} className="font-body font-semibold text-[12px] text-accent hover:underline px-2 py-1">
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-3 hover:text-ink px-2 py-1">×</button>
        )}
      </div>
    );
  }
  ```
- [ ] **Step 3: Run tests.** Pass.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/ui/molecules/Toast.tsx src/ui/molecules/__tests__/Toast.test.tsx
  git commit -m "feat(ui): generic Toast molecule"
  ```

---

## Task 17 — `UpdateToast` + `UpdateDialog`

**Files:** `src/ui/molecules/UpdateToast.tsx`, `src/ui/molecules/UpdateDialog.tsx`, `src/ui/molecules/__tests__/UpdateDialog.test.tsx`, `src/ui/molecules/SettingsRow.tsx`

- [ ] **Step 1: Make `SettingsRow.control` optional.** In `src/ui/molecules/SettingsRow.tsx` change `control: ReactNode` to `control?: ReactNode`, and replace `<div className="flex-none">{control}</div>` with `{control !== undefined && <div className="flex-none">{control}</div>}`.
- [ ] **Step 2: Build `UpdateToast.tsx` (initial — refined in Task 22):**
  ```tsx
  import { useState } from "react";
  import { Toast } from "./Toast";
  import { useUpdaterState } from "../../state/UpdaterStateContext";
  import { UpdateDialog } from "./UpdateDialog";

  export function UpdateToast() {
    const ctrl = useUpdaterState();
    const [open, setOpen] = useState(false);

    if (ctrl.state.kind === "ready") {
      const info = ctrl.state.info;
      return (
        <>
          <Toast open={!open} action={{ label: "View", onClick: () => setOpen(true) }}>
            Pier {info.version} is ready
          </Toast>
          <UpdateDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    if (ctrl.state.kind === "error" && ctrl.state.lastInfo) {
      return (
        <Toast open variant="error" action={{ label: "Retry", onClick: () => ctrl.install() }} onDismiss={ctrl.dismissError}>
          Update failed: {ctrl.state.message}
        </Toast>
      );
    }
    return null;
  }
  ```
- [ ] **Step 3: Build `UpdateDialog.tsx`:**
  ```tsx
  import { Button } from "../atoms/Button";
  import { Markdown } from "../atoms/Markdown";
  import { useDialogA11y } from "./useDialogA11y";
  import { useUpdaterState } from "../../state/UpdaterStateContext";

  interface Props { open: boolean; onClose: () => void }

  export function UpdateDialog({ open, onClose }: Props) {
    const ctrl = useUpdaterState();
    const info =
      ctrl.state.kind === "ready" || ctrl.state.kind === "available" ? ctrl.state.info : null;

    const handleRemind = async () => { await ctrl.remindLater(); onClose(); };
    const panelRef = useDialogA11y({ open: open && !!info, onEscape: handleRemind });

    if (!open || !info) return null;

    const handleSkip = async () => { await ctrl.skip(); onClose(); };
    const handleInstall = async () => { await ctrl.install(); };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,26,22,0.32)] backdrop-blur-[4px] animate-overlay-in"
           role="dialog" aria-modal aria-labelledby="upd-title" aria-describedby="upd-sub">
        <div ref={panelRef} className="bg-surface border border-line rounded-[14px] w-[min(560px,calc(100%-32px))] max-h-[min(80vh,640px)] shadow-pop overflow-hidden animate-panel-in flex flex-col">
          <header className="px-6 pt-6 pb-3">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1">Update available</span>
            <h2 id="upd-title" className="font-display text-[22px] font-semibold text-ink tracking-[-0.005em]">
              A new version of Pier is available
            </h2>
            <p id="upd-sub" className="font-body text-[13px] text-ink-3 mt-1">
              Pier {info.version} is available — you have {info.currentVersion}.
            </p>
          </header>
          <div className="px-6 pb-4 flex-1 overflow-y-auto">
            {info.notes
              ? <Markdown source={info.notes} />
              : <p className="font-body text-[13px] text-ink-3 italic">No release notes provided.</p>}
          </div>
          <footer className="flex justify-end gap-2 px-6 py-3 border-t border-line bg-bg">
            <Button variant="ghost" onClick={handleSkip}>Skip This Version</Button>
            <Button variant="ghost" onClick={handleRemind}>Remind Me Later</Button>
            <Button variant="primary" onClick={handleInstall}>Install and Restart</Button>
          </footer>
        </div>
      </div>
    );
  }
  ```
- [ ] **Step 4: Tests for the dialog.** Create `src/ui/molecules/__tests__/UpdateDialog.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { UpdateDialog } from "../UpdateDialog";
  import { UpdaterStateProvider } from "../../../state/UpdaterStateContext";
  import { OpenerProvider } from "../../../state/OpenerContext";
  import type { UpdateController } from "../../../application/useUpdater";

  const opener = { open: async () => {} };

  function ctrl(overrides: Partial<UpdateController> = {}): UpdateController {
    return {
      state: { kind: "ready", info: { version: "0.2.0", currentVersion: "0.1.0", notes: "## Hi", pubDate: null } },
      manualCheck: vi.fn(), install: vi.fn(),
      remindLater: vi.fn().mockResolvedValue(undefined),
      skip: vi.fn().mockResolvedValue(undefined),
      dismissError: vi.fn(),
      ...overrides,
    };
  }

  function R(c: UpdateController, onClose = vi.fn()) {
    return render(
      <OpenerProvider opener={opener}>
        <UpdaterStateProvider controller={c}>
          <UpdateDialog open onClose={onClose} />
        </UpdaterStateProvider>
      </OpenerProvider>,
    );
  }

  describe("UpdateDialog", () => {
    it("renders version line and notes", () => {
      R(ctrl());
      expect(screen.getByText(/0\.2\.0/)).toBeInTheDocument();
      expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: /A new version/i })).toBeInTheDocument();
    });
    it("Install button calls install()", () => {
      const c = ctrl();
      R(c);
      fireEvent.click(screen.getByRole("button", { name: "Install and Restart" }));
      expect(c.install).toHaveBeenCalled();
    });
    it("Skip button calls skip()", async () => {
      const c = ctrl();
      R(c);
      fireEvent.click(screen.getByRole("button", { name: "Skip This Version" }));
      await Promise.resolve(); await Promise.resolve();
      expect(c.skip).toHaveBeenCalled();
    });
    it("Remind button calls remindLater()", async () => {
      const c = ctrl();
      R(c);
      fireEvent.click(screen.getByRole("button", { name: "Remind Me Later" }));
      await Promise.resolve(); await Promise.resolve();
      expect(c.remindLater).toHaveBeenCalled();
    });
  });
  ```
- [ ] **Step 5: Run tests.** `npx vitest run` — green.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/ui/molecules/UpdateToast.tsx src/ui/molecules/UpdateDialog.tsx src/ui/molecules/__tests__/UpdateDialog.test.tsx src/ui/molecules/SettingsRow.tsx
  git commit -m "feat(ui): UpdateToast + UpdateDialog molecules; SettingsRow.control optional"
  ```

---

## Task 18 — Settings page: Updates section

**Files:** `src/ui/pages/SettingsPage.tsx`

- [ ] **Step 1: Replace the page.** Use the file content from the plan (full replacement). Adds a third `SettingsSection kicker="03" label="Updates"` with three rows: Automatic updates (Switch bound to `setAutoCheck`), Current version (subtitle from `getVersion()`), Last checked (relative time + "Check for updates…" button bound to `updater.manualCheck`). Renders inline danger-soft message when `updater.state.kind === "error"`. Imports: add `Download`, `GitBranch` from `lucide-react`, `useUpdaterState` from `../../state/UpdaterStateContext`, `getVersion` from `@tauri-apps/api/app`, and a local `relativeTime(ts)` helper.

  The full replacement file matches the existing layout exactly and only adds the new section + helper + version state. (See implementer note: copy the existing file verbatim, then add the section between the `<SettingsSection kicker="02" ...>` block and the `<DangerConfirmDialog>`. Add `setAutoCheck` to the destructure from `useSettings()`. Add `const updater = useUpdaterState();` and `const [version, setVersion] = useState<string>("…"); useMemo(() => { getVersion().then(setVersion).catch(() => setVersion("?")); }, []);` to the function body. Add the `relativeTime` helper near `historyStatus`.)

- [ ] **Step 2: Verify.** `npx vitest run && npm run build` — green.
- [ ] **Step 3: Commit.**
  ```bash
  git add src/ui/pages/SettingsPage.tsx
  git commit -m "feat(settings): Updates section with auto-check, version, manual check"
  ```

---

## Task 19 — Wire providers + toast/dialog into App.tsx

**Files:** `src/App.tsx`, `src/state/UpdaterControllerHost.tsx`

- [ ] **Step 1: Host component.** Create `src/state/UpdaterControllerHost.tsx`:
  ```tsx
  import type { ReactNode } from "react";
  import { useUpdater } from "../application/useUpdater";
  import { UpdaterStateProvider } from "./UpdaterStateContext";

  export function UpdaterControllerHost({ children }: { children: ReactNode }) {
    const ctrl = useUpdater();
    return <UpdaterStateProvider controller={ctrl}>{children}</UpdaterStateProvider>;
  }
  ```
- [ ] **Step 2: Update `App.tsx`:**
  ```tsx
  import { AppProvider } from "./state/AppContext";
  import { RunnerProvider } from "./state/RunnerContext";
  import { FilePickerProvider } from "./state/FilePickerContext";
  import { OpenerProvider } from "./state/OpenerContext";
  import { HistoryProvider } from "./state/HistoryContext";
  import { SettingsProvider } from "./state/SettingsContext";
  import { UpdaterProvider } from "./state/UpdaterContext";
  import { UpdaterControllerHost } from "./state/UpdaterControllerHost";
  import { HomePage } from "./ui/pages/HomePage";
  import { UpdateToast } from "./ui/molecules/UpdateToast";
  import { tauriCommandRunner } from "./infrastructure/tauriCommandRunner";
  import { tauriFilePicker } from "./infrastructure/tauriFilePicker";
  import { defaultUrlOpener } from "./infrastructure/tauriUrlOpener";
  import { tauriHistoryReader } from "./infrastructure/tauriHistoryReader";
  import { defaultSettingsAdapter } from "./infrastructure/tauriSettings";
  import { defaultUpdateChecker } from "./infrastructure/tauriUpdateChecker";

  export default function App() {
    return (
      <AppProvider>
        <RunnerProvider runner={tauriCommandRunner}>
          <HistoryProvider history={tauriHistoryReader}>
            <FilePickerProvider picker={tauriFilePicker}>
              <OpenerProvider opener={defaultUrlOpener}>
                <SettingsProvider adapter={defaultSettingsAdapter}>
                  <UpdaterProvider checker={defaultUpdateChecker}>
                    <UpdaterControllerHost>
                      <HomePage />
                      <UpdateToast />
                    </UpdaterControllerHost>
                  </UpdaterProvider>
                </SettingsProvider>
              </OpenerProvider>
            </FilePickerProvider>
          </HistoryProvider>
        </RunnerProvider>
      </AppProvider>
    );
  }
  ```
- [ ] **Step 3: Verify.** `npx vitest run && npm run build` — success.
- [ ] **Step 4: Smoke-test.** `npm run tauri:dev`, open Settings → Updates appears with Switch, version, "Last checked: Never", and "Check for updates…" button. Click it — expect a network error displayed inline (no release exists yet). Quit dev shell.
- [ ] **Step 5: Commit.**
  ```bash
  git add src/App.tsx src/state/UpdaterControllerHost.tsx
  git commit -m "feat(app): mount updater providers + toast at root"
  ```

---

## Task 20 — Tray-icon dot variant + swap helper

**Files:** `src-tauri/icons/tray-icon-update@2x.png`, `src-tauri/src/application/update.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/application/useUpdater.ts`

- [ ] **Step 1: Generate the dot variant.** Open `src-tauri/icons/tray-icon@2x.png`, add an 8×8 (1×) / 16×16 (2×) filled circle in the upper-right corner, save as `src-tauri/icons/tray-icon-update@2x.png`. Without an editor handy, run `cp src-tauri/icons/tray-icon@2x.png src-tauri/icons/tray-icon-update@2x.png` (visual difference can come later).
- [ ] **Step 2: Add swap helper.** Append to `src-tauri/src/application/update.rs`:
  ```rust
  pub fn set_tray_badge(app: &tauri::AppHandle, has_update: bool) -> Result<()> {
      let bytes: &[u8] = if has_update {
          include_bytes!("../../icons/tray-icon-update@2x.png")
      } else {
          include_bytes!("../../icons/tray-icon@2x.png")
      };
      if let Some(tray) = app.tray_by_id("main-tray") {
          let img = tauri::image::Image::from_bytes(bytes)?;
          tray.set_icon(Some(img))?;
      }
      Ok(())
  }
  ```
- [ ] **Step 3: Add command.** Append to `src-tauri/src/commands.rs`:
  ```rust
  #[tauri::command]
  pub fn set_tray_badge_cmd(app: tauri::AppHandle, has_update: bool) -> Result<(), String> {
      update_app::set_tray_badge(&app, has_update).map_err(|e| e.to_string())
  }
  ```
  Register in `lib.rs` `invoke_handler![...]`: `commands::set_tray_badge_cmd,`.
- [ ] **Step 4: Wire from `useUpdater`.** At the top of `src/application/useUpdater.ts`, add:
  ```ts
  import { invoke } from "@tauri-apps/api/core";
  function setTrayBadge(has: boolean) {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      void invoke("set_tray_badge_cmd", { hasUpdate: has });
    }
  }
  ```
  Then: every `dispatch({ type: "set", state: { kind: "ready", info } });` is followed by `setTrayBadge(true);`. Every `dispatch({ type: "set", state: { kind: "idle" } });` (in `runFlow`, `skip`, `remindLater`, `dismissError`) is followed by `setTrayBadge(false);`.
- [ ] **Step 5: Verify.** `npx vitest run && cargo check --manifest-path src-tauri/Cargo.toml` — green.
- [ ] **Step 6: Commit.**
  ```bash
  git add src-tauri/icons/tray-icon-update@2x.png src-tauri/src/lib.rs src-tauri/src/application/update.rs src-tauri/src/commands.rs src/application/useUpdater.ts
  git commit -m "feat(updater): tray-icon dot badge when an update is ready"
  ```

---

## Task 21 — System notification when window is hidden

**Files:** `src-tauri/src/application/update.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/application/useUpdater.ts`

- [ ] **Step 1: Backend helper.** Append to `src-tauri/src/application/update.rs`:
  ```rust
  use tauri_plugin_notification::NotificationExt;

  pub fn notify_update_ready(app: &tauri::AppHandle, version: &str) -> Result<()> {
      let visible = app
          .get_webview_window("main")
          .and_then(|w| w.is_visible().ok())
          .unwrap_or(false);
      if visible { return Ok(()); }
      app.notification()
          .builder()
          .title("Pier update ready")
          .body(format!("Pier {version} is ready to install."))
          .show()?;
      Ok(())
  }
  ```
- [ ] **Step 2: Command.** Append to `src-tauri/src/commands.rs`:
  ```rust
  #[tauri::command]
  pub fn notify_update_ready_cmd(app: tauri::AppHandle, version: String) -> Result<(), String> {
      update_app::notify_update_ready(&app, &version).map_err(|e| e.to_string())
  }
  ```
  Register in `lib.rs` `invoke_handler![...]`: `commands::notify_update_ready_cmd,`.
- [ ] **Step 3: Wire from `useUpdater`.** When transitioning to `ready`, also call `void invoke("notify_update_ready_cmd", { version: info.version });` (gated on the same `__TAURI_INTERNALS__` check).
- [ ] **Step 4: Verify.** `cargo check --manifest-path src-tauri/Cargo.toml && npx vitest run` — green.
- [ ] **Step 5: Commit.**
  ```bash
  git add src-tauri/src/application/update.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/application/useUpdater.ts
  git commit -m "feat(updater): system notification on ready when window is hidden"
  ```

---

## Task 22 — Suppress in-app toast while window hidden

**Files:** `src/ui/molecules/UpdateToast.tsx`

- [ ] **Step 1: Track visibility.** Replace `src/ui/molecules/UpdateToast.tsx`:
  ```tsx
  import { useEffect, useState } from "react";
  import { Toast } from "./Toast";
  import { useUpdaterState } from "../../state/UpdaterStateContext";
  import { UpdateDialog } from "./UpdateDialog";

  function useDocumentVisible(): boolean {
    const [v, setV] = useState<boolean>(typeof document === "undefined" ? true : !document.hidden);
    useEffect(() => {
      const onVis = () => setV(!document.hidden);
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }, []);
    return v;
  }

  export function UpdateToast() {
    const ctrl = useUpdaterState();
    const [open, setOpen] = useState(false);
    const visible = useDocumentVisible();

    if (ctrl.state.kind === "ready" && visible) {
      const info = ctrl.state.info;
      return (
        <>
          <Toast open={!open} action={{ label: "View", onClick: () => setOpen(true) }}>
            Pier {info.version} is ready
          </Toast>
          <UpdateDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    if (ctrl.state.kind === "error" && ctrl.state.lastInfo && visible) {
      return (
        <Toast open variant="error" action={{ label: "Retry", onClick: () => ctrl.install() }} onDismiss={ctrl.dismissError}>
          Update failed: {ctrl.state.message}
        </Toast>
      );
    }
    if (ctrl.state.kind === "ready") {
      return <UpdateDialog open={open} onClose={() => setOpen(false)} />;
    }
    return null;
  }
  ```
- [ ] **Step 2: Verify.** `npx vitest run` — green.
- [ ] **Step 3: Commit.**
  ```bash
  git add src/ui/molecules/UpdateToast.tsx
  git commit -m "feat(ui): suppress in-app toast while window hidden"
  ```

---

## Task 23 — GitHub Actions release pipeline

**Files:** `.github/workflows/release.yml`

- [ ] **Step 1: Add workflow.** Create `.github/workflows/release.yml`:
  ```yaml
  name: Release

  on:
    push:
      tags:
        - "v*"

  jobs:
    release:
      runs-on: macos-14
      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm

        - uses: dtolnay/rust-toolchain@stable

        - name: Install Rust universal targets
          run: rustup target add aarch64-apple-darwin x86_64-apple-darwin

        - name: Install npm deps
          run: npm ci

        - name: Build with tauri-action
          id: tauri
          uses: tauri-apps/tauri-action@v0
          env:
            TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
            TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          with:
            tagName: ${{ github.ref_name }}
            releaseName: Pier ${{ github.ref_name }}
            releaseBody: "See CHANGELOG.md."
            releaseDraft: false
            prerelease: false
            args: --target universal-apple-darwin

        - name: Ad-hoc codesign the app bundle
          run: |
            APP_PATH=$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -maxdepth 2 -name "*.app" | head -n1)
            echo "Codesigning: $APP_PATH"
            codesign --force --deep --sign - "$APP_PATH"
            codesign --verify --deep --strict "$APP_PATH"

        - name: Re-tarball codesigned bundle
          run: |
            APP_PATH=$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -maxdepth 2 -name "*.app" | head -n1)
            DIR=$(dirname "$APP_PATH")
            NAME=$(basename "$APP_PATH" .app)
            (cd "$DIR" && tar czf "${NAME}_universal.app.tar.gz" "$(basename "$APP_PATH")")

        - name: Generate latest.json
          run: |
            VERSION="${GITHUB_REF_NAME#v}"
            PUB_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
            APP_PATH=$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -maxdepth 2 -name "*.app" | head -n1)
            DIR=$(dirname "$APP_PATH")
            NAME=$(basename "$APP_PATH" .app)
            TARBALL="${DIR}/${NAME}_universal.app.tar.gz"
            SIG_FILE="${TARBALL}.sig"
            if [ ! -f "$SIG_FILE" ]; then echo "Missing $SIG_FILE"; exit 1; fi
            SIG=$(cat "$SIG_FILE")
            NOTES=$(awk '/^## /{if(p)exit; p=1} p' CHANGELOG.md 2>/dev/null || echo "Release ${VERSION}")
            URL="https://github.com/${GITHUB_REPOSITORY}/releases/download/${GITHUB_REF_NAME}/${NAME}_universal.app.tar.gz"
            jq -n --arg version "$VERSION" --arg pubDate "$PUB_DATE" --arg notes "$NOTES" --arg sig "$SIG" --arg url "$URL" \
              '{ version:$version, pub_date:$pubDate, notes:$notes,
                 platforms: { "darwin-aarch64": {signature:$sig, url:$url},
                              "darwin-x86_64":  {signature:$sig, url:$url} } }' \
              > latest.json

        - name: Upload artifacts to release
          uses: softprops/action-gh-release@v2
          with:
            tag_name: ${{ github.ref_name }}
            files: |
              latest.json
              src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz
              src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz.sig
  ```
- [ ] **Step 2: GitHub secrets (manual, one-time).** In GitHub Settings → Secrets and variables → Actions, add `TAURI_SIGNING_PRIVATE_KEY` (full contents of `~/.tauri/pier.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (the password from Task 2 Step 1).
- [ ] **Step 3: Commit.**
  ```bash
  git add .github/workflows/release.yml
  git commit -m "ci(release): tagged release with universal binary + ad-hoc codesign + latest.json"
  ```

---

## Self-review

- **Spec coverage**: every requirement (auto-check, toast, dialog, settings, error surface, translocation, system notification, tray badge, ad-hoc codesign, universal binary CI, atomic patch, a11y) maps to at least one task.
- **Type consistency**: `UpdateController` defined in Task 11, consumed in 17 / 18 / 19 / 22; `UpdateChecker` defined in 9, consumed in 11; `Settings.update.UpdatePrefs` shape consistent across 3, 7, 8, 11, 12, 18.
- **TDD**: domain helpers (7), useUpdater (11), Markdown (14), Toast (16), UpdateDialog (17), Rust settings (3), Rust patch merge (4) all start with failing tests.
- **Frequent commits**: 23 commits, each end-of-task.
- **Sibling refactor**: a11y in Task 15 is the only out-of-spec scope creep, justified in the spec.

---

## Acceptance verification (after Task 23)

1. `npm run tauri:dev` — Settings → Updates section renders cleanly. Manual "Check for updates…" surfaces a network error inline (no real release yet).
2. `git tag v0.2.0 && git push origin v0.2.0` — wait for CI.
3. Verify the GitHub Release contains `Pier_<ver>_universal.app.tar.gz`, its `.sig`, and `latest.json`.
4. Install the previous (0.1.0) DMG. Launch. Within seconds it should download the update; toast/notification appears; click Install → app relaunches as 0.2.0.
5. Re-tag 0.3.0 to verify Skip persists across the 0.2 → 0.3 jump (skipped 0.2 should not block 0.3).
