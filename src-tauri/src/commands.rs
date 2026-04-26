use crate::application::load_config::{load_config_from_path, seed_default_if_missing};
use crate::domain::{Defaults, RunRequest, Tool, ToolsConfig};
use std::path::PathBuf;

#[tauri::command]
pub fn load_tools_config(path: String) -> Result<ToolsConfig, String> {
    let p = PathBuf::from(path);
    seed_default_if_missing(&p).map_err(|e| e.to_string())?;
    load_config_from_path(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_path() -> String {
    let home = dirs::home_dir().expect("home dir");
    home.join(".pier").join("tools.json").to_string_lossy().into()
}

#[tauri::command]
pub async fn run_tool_cmd(
    app: tauri::AppHandle,
    tool: Tool,
    defaults: Option<Defaults>,
    request: RunRequest,
) -> Result<String, String> {
    crate::application::run_tool::run_tool(app, tool, defaults, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_run_cmd(app: tauri::AppHandle, run_id: String) -> Result<(), String> {
    crate::application::run_tool::kill_run(app, run_id)
        .await
        .map_err(|e| e.to_string())
}
