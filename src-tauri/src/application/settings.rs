use crate::domain::Settings;
use anyhow::Result;
use std::path::{Path, PathBuf};
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
        let s = Settings { launch_at_login: true };
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
}
