pub mod application;
pub mod commands;
pub mod domain;
pub mod events;
pub mod infrastructure;
pub mod state;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state::AppState::new())
        .setup(|app| {
            // Hide from Dock on macOS — behave like Raycast/Rectangle
            #[cfg(target_os = "macos")]
            app.set_activation_policy(ActivationPolicy::Accessory);

            // Start config file watcher
            if let Err(e) = crate::application::watch_config::start(app.handle().clone()) {
                eprintln!("watch_config start: {e}");
            }

            // Build tray menu
            let quit_item = MenuItem::with_id(app, "quit", "Quit Pier", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true) // macOS: monochrome, adapts to dark/light menu bar
                .menu(&menu)
                .show_menu_on_left_click(false) // left-click toggles window; right-click shows menu
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

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
