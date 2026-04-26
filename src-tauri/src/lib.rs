pub mod application;
pub mod commands;
pub mod domain;
pub mod events;
pub mod infrastructure;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state::AppState::new())
        .setup(|app| {
            if let Err(e) = crate::application::watch_config::start(app.handle().clone()) {
                eprintln!("watch_config start: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_tools_config,
            commands::config_path,
            commands::run_tool_cmd,
            commands::kill_run_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
