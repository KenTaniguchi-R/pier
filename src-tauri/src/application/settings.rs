use crate::domain::Settings;
use anyhow::Result;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

pub fn settings_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("settings.json")
}

pub fn load() -> Result<Settings> {
    load_from(&settings_path())
}

pub fn load_from(path: &Path) -> Result<Settings> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let raw = std::fs::read_to_string(path)?;
    let s: Settings = serde_json::from_str(&raw).unwrap_or_default();
    Ok(s)
}

pub fn save(settings: &Settings) -> Result<()> {
    save_to(&settings_path(), settings)
}

pub fn save_to(path: &Path, settings: &Settings) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, json)?;
    Ok(())
}

/// Load persisted settings, then reconcile with OS truth where applicable.
/// `launch_at_login` is taken from the autostart plugin since the LaunchAgent
/// can be removed externally.
pub fn current(app: &tauri::AppHandle) -> Result<Settings> {
    let mut s = load()?;
    if let Ok(enabled) = app.autolaunch().is_enabled() {
        s.launch_at_login = enabled;
    }
    Ok(s)
}

/// Persist settings and apply the OS-side effects (autostart toggle).
pub fn apply(app: &tauri::AppHandle, settings: &Settings) -> Result<()> {
    save(settings)?;
    let autolaunch = app.autolaunch();
    if settings.launch_at_login {
        autolaunch.enable()?;
    } else {
        autolaunch.disable()?;
    }
    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn returns_default_when_missing() {
        let d = tempdir().unwrap();
        let p = d.path().join("settings.json");
        let s = load_from(&p).unwrap();
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn round_trips_through_disk() {
        let d = tempdir().unwrap();
        let p = d.path().join("settings.json");
        let s = Settings { launch_at_login: true, ..Default::default() };
        save_to(&p, &s).unwrap();
        let loaded = load_from(&p).unwrap();
        assert_eq!(loaded, s);
    }

    #[test]
    fn malformed_json_falls_back_to_default() {
        let d = tempdir().unwrap();
        let p = d.path().join("settings.json");
        std::fs::write(&p, "{ not valid").unwrap();
        let s = load_from(&p).unwrap();
        assert_eq!(s, Settings::default());
    }

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
}
