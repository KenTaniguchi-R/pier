use crate::application::load_config::load_config_from_path;
use crate::domain::ToolsConfig;
use std::path::PathBuf;

#[tauri::command]
pub fn load_tools_config(path: String) -> Result<ToolsConfig, String> {
    load_config_from_path(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_path() -> String {
    let home = dirs::home_dir().expect("home dir");
    home.join(".pier").join("tools.json").to_string_lossy().into()
}
