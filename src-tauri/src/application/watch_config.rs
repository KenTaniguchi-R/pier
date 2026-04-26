use crate::infrastructure::fs_watcher::watch_path;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

pub fn start(app: AppHandle) -> anyhow::Result<()> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("no home"))?;
    let config_path: PathBuf = home.join(".pier").join("tools.json");

    // Ensure directory exists so the watcher's parent dir is valid
    if let Some(parent) = config_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let app_clone = app.clone();
    watch_path(&config_path, move || {
        let _ = app_clone.emit("pier://config-changed", ());
    })?;
    Ok(())
}
