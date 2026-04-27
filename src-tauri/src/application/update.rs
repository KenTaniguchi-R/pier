use crate::domain::{UpdateInfo, UpdateProgress};
use anyhow::{anyhow, Result};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

pub async fn check(app: &tauri::AppHandle) -> Result<Option<UpdateInfo>> {
    let updater = app.updater()?;
    let current = app.package_info().version.to_string();
    match updater.check().await? {
        Some(update) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            current_version: current,
            notes: update.body.clone(),
            pub_date: update.date.map(|d| d.to_string()),
        })),
        None => Ok(None),
    }
}

pub async fn install_and_relaunch(app: &tauri::AppHandle) -> Result<()> {
    if is_translocated()? {
        return Err(anyhow!(
            "Pier is running from a translocated path. Move it to /Applications and reopen to enable updates."
        ));
    }
    let updater = app.updater()?;
    let update = updater.check().await?
        .ok_or_else(|| anyhow!("No update available at install time"))?;

    let app_for_progress = app.clone();
    let mut total: Option<u64> = None;
    update
        .download_and_install(
            move |chunk_len, content_len| {
                if total.is_none() { total = content_len; }
                let p = UpdateProgress { downloaded: chunk_len as u64, total };
                let _ = app_for_progress.emit("pier://update-progress", p);
            },
            || {},
        )
        .await?;

    if let Some(_tray) = app.tray_by_id("main-tray") {
        let _ = app.remove_tray_by_id("main-tray");
    }
    app.restart();
}

pub fn is_translocated() -> Result<bool> {
    let exe = std::env::current_exe()?;
    Ok(exe.to_string_lossy().contains("AppTranslocation"))
}

use tauri_plugin_notification::NotificationExt;

pub fn notify_update_ready(app: &tauri::AppHandle, version: &str) -> Result<()> {
    let visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible { return Ok(()); }
    app.notification()
        .builder()
        .title("Pier update ready")
        .body(format!("Pier {version} is ready to install."))
        .show()?;
    Ok(())
}

pub fn set_tray_badge(app: &tauri::AppHandle, has_update: bool) -> Result<()> {
    let bytes: &[u8] = if has_update {
        include_bytes!("../../icons/tray-icon-update@2x.png")
    } else {
        include_bytes!("../../icons/tray-icon@2x.png")
    };
    if let Some(tray) = app.tray_by_id("main-tray") {
        let img = tauri::image::Image::from_bytes(bytes)?;
        tray.set_icon(Some(img))?;
    }
    Ok(())
}
