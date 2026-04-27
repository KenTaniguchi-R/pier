use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[derive(Default)]
pub struct Settings {
    #[serde(default)]
    pub launch_at_login: bool,
    #[serde(default)]
    pub update: UpdatePrefs,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePrefs {
    #[serde(default = "default_auto_check")]
    pub auto_check: bool,
    #[serde(default)]
    pub skipped_version: Option<String>,
    #[serde(default)]
    pub remind_after: Option<i64>,
    #[serde(default)]
    pub last_checked_at: Option<i64>,
}

fn default_auto_check() -> bool {
    true
}

impl Default for UpdatePrefs {
    fn default() -> Self {
        Self {
            auto_check: true,
            skipped_version: None,
            remind_after: None,
            last_checked_at: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_old_json_without_update_field() {
        let json = r#"{ "launchAtLogin": true }"#;
        let s: Settings = serde_json::from_str(json).unwrap();
        assert!(s.launch_at_login);
        assert!(s.update.auto_check);
        assert!(s.update.skipped_version.is_none());
        assert!(s.update.remind_after.is_none());
        assert!(s.update.last_checked_at.is_none());
    }

    #[test]
    fn round_trips_full_settings() {
        let s = Settings {
            launch_at_login: true,
            update: UpdatePrefs {
                auto_check: false,
                skipped_version: Some("0.2.0".into()),
                remind_after: Some(1_700_000_000_000),
                last_checked_at: Some(1_700_000_000_000),
            },
        };
        let json = serde_json::to_string(&s).unwrap();
        let back: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(s, back);
    }
}
