pub mod application;
pub mod commands;
pub mod domain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_tools_config,
            commands::config_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
