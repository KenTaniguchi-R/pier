use crate::application::load_config::{load_config_from_path, seed_default_if_missing};
use crate::application::{history_admin, settings as settings_app};
use crate::domain::{RunRequestPayload, Settings, ToolsConfig};
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
    home.join(".pier")
        .join("tools.json")
        .to_string_lossy()
        .into()
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
pub fn list_recent_tools_cmd(
    limit: Option<usize>,
) -> Result<Vec<crate::application::history::RecentToolRun>, String> {
    crate::application::history::list_recent_tools(limit.unwrap_or(6)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_run_output(
    output_path: String,
) -> Result<Vec<crate::infrastructure::run_store::LogLine>, String> {
    crate::application::history::read_output(&output_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    settings_app::current(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    settings_app::apply(&app, &settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_stats_cmd() -> Result<history_admin::HistoryStats, String> {
    history_admin::stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history_cmd() -> Result<(), String> {
    history_admin::clear().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn patch_settings_cmd(
    app: tauri::AppHandle,
    patch: serde_json::Value,
) -> Result<Settings, String> {
    settings_app::patch(&app, patch)
        .await
        .map_err(|e| e.to_string())
}

use crate::application::update as update_app;
use crate::domain::UpdateInfo;

#[tauri::command]
pub async fn check_update_cmd(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    update_app::check(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_update_cmd(app: tauri::AppHandle) -> Result<(), String> {
    update_app::install_and_relaunch(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_translocated_cmd() -> Result<bool, String> {
    update_app::is_translocated().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_tray_badge_cmd(app: tauri::AppHandle, has_update: bool) -> Result<(), String> {
    update_app::set_tray_badge(&app, has_update).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notify_update_ready_cmd(app: tauri::AppHandle, version: String) -> Result<(), String> {
    update_app::notify_update_ready(&app, &version).map_err(|e| e.to_string())
}

use crate::application::library::{add_to_config, fetch as lib_fetch, install as lib_install};
use crate::domain::{Catalog, CatalogTool};

const CATALOG_URL: &str = "https://library.pier.app/catalog.json";
const CATALOG_SIG_URL: &str = "https://library.pier.app/catalog.json.minisig";
const CATALOG_PUBKEY: &str = env!("PIER_LIBRARY_PUBKEY");

#[tauri::command]
pub async fn library_fetch_catalog() -> Result<Catalog, String> {
    let cache = crate::application::library::cache::cache_path();
    lib_fetch::fetch(lib_fetch::FetchOpts {
        url: CATALOG_URL,
        minisign_pubkey: CATALOG_PUBKEY,
        signature_url: CATALOG_SIG_URL,
        cache_path: &cache,
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct LibraryAddPreview {
    pub before: String,
    pub after: String,
    pub new_tool: crate::domain::Tool,
}

#[tauri::command]
pub async fn library_install_and_preview(
    tool: CatalogTool,
) -> Result<LibraryAddPreview, String> {
    let installed = lib_install::install(&tool, &lib_install::install_root())
        .await
        .map_err(|e| e.to_string())?;
    let entry = add_to_config::build_tool_entry(
        "pier-tools",
        &tool,
        installed.command,
        installed.sha256,
    );
    let cfg_path = std::path::PathBuf::from(config_path());
    let p = add_to_config::preview(&cfg_path, entry).map_err(|e| e.to_string())?;
    Ok(LibraryAddPreview { before: p.before, after: p.after, new_tool: p.new_tool })
}

#[tauri::command]
pub fn library_commit_add(after: String) -> Result<(), String> {
    let cfg_path = std::path::PathBuf::from(config_path());
    add_to_config::commit(&cfg_path, &after).map_err(|e| e.to_string())
}
