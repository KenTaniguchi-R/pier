use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub launch_at_login: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self { launch_at_login: false }
    }
}
