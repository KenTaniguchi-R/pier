use crate::application::load_config::{load_config_from_path, seed_default_if_missing};
use crate::domain::{RunRequestPayload, ToolsConfig};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub fn load_tools_config(app: tauri::AppHandle, path: String) -> Result<ToolsConfig, String> {
    let p = PathBuf::from(path);
    seed_default_if_missing(&p).map_err(|e| e.to_string())?;
    let cfg = load_config_from_path(&p).map_err(|e| e.to_string())?;
    app.state::<AppState>().registry.replace(cfg.clone());
    Ok(cfg)
}

#[tauri::command]
pub fn config_path() -> String {
    let home = dirs::home_dir().expect("home dir");
    home.join(".pier").join("tools.json").to_string_lossy().into()
}

#[tauri::command]
pub async fn run_tool_cmd(
    app: tauri::AppHandle,
    payload: RunRequestPayload,
) -> Result<String, String> {
    crate::application::run_tool::run_tool(app, payload.tool_id, payload.values, payload.confirmed)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_run_cmd(app: tauri::AppHandle, run_id: String) -> Result<(), String> {
    crate::application::run_tool::kill_run(app, run_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tool_history(
    tool_id: String,
    limit: Option<usize>,
) -> Result<Vec<crate::application::history::RunSummary>, String> {
    crate::application::history::list_for_tool(&tool_id, limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_run_output(
    output_path: String,
) -> Result<Vec<crate::infrastructure::run_store::LogLine>, String> {
    crate::application::history::read_output(&output_path).map_err(|e| e.to_string())
}
