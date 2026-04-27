//! Launch-at-login control via Apple's `SMAppService` (macOS 13+).
//!
//! Using `SMAppService::mainAppService()` instead of a LaunchAgent plist makes
//! macOS show the app's `CFBundleName` ("Pier") in System Settings → Login Items
//! instead of the signing team name ("Benri LLC"). It also moves the registration
//! to be bundle-relative, so uninstalling the app cleanly removes the entry.

#[cfg(target_os = "macos")]
mod imp {
    use anyhow::{anyhow, Result};
    use objc2_service_management::{SMAppService, SMAppServiceStatus};

    pub fn is_enabled() -> Result<bool> {
        let status = unsafe { SMAppService::mainAppService().status() };
        // `Enabled` = registered and active. `RequiresApproval` = registered but
        // user must flip the toggle in System Settings; we treat that as "on
        // from our side" so the UI reflects what we asked for.
        Ok(matches!(
            status,
            SMAppServiceStatus::Enabled | SMAppServiceStatus::RequiresApproval
        ))
    }

    pub fn enable() -> Result<()> {
        unsafe { SMAppService::mainAppService().registerAndReturnError() }
            .map_err(|e| anyhow!("SMAppService register failed: {}", e))
    }

    pub fn disable() -> Result<()> {
        // If we were never registered, treat unregister as a no-op rather than surfacing the error.
        if !is_enabled().unwrap_or(false) {
            return Ok(());
        }
        unsafe { SMAppService::mainAppService().unregisterAndReturnError() }
            .map_err(|e| anyhow!("SMAppService unregister failed: {}", e))
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use anyhow::Result;
    pub fn is_enabled() -> Result<bool> {
        Ok(false)
    }
    pub fn enable() -> Result<()> {
        Ok(())
    }
    pub fn disable() -> Result<()> {
        Ok(())
    }
}

pub use imp::{disable, enable, is_enabled};
