use crate::application::load_config::load_config_from_path;
use crate::infrastructure::fs_watcher::watch_path;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

pub fn start(app: AppHandle) -> anyhow::Result<()> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("no home"))?;
    let config_path: PathBuf = home.join(".pier").join("tools.json");

    if let Some(parent) = config_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let app_clone = app.clone();
    let path_for_reload = config_path.clone();
    watch_path(&config_path, move || {
        // Refresh registry first so any subsequent run_tool_cmd sees fresh data,
        // then notify the frontend so it can re-render the tile list.
        if let Ok(cfg) = load_config_from_path(&path_for_reload) {
            app_clone.state::<AppState>().registry.replace(cfg);
        }
        let _ = app_clone.emit("pier://config-changed", ());
    })?;
    Ok(())
}
