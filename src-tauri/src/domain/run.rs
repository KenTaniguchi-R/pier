use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type RunId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus { Pending, Running, Success, Failed, Killed }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub tool_id: String,
    #[serde(default)]
    pub values: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOutcome {
    pub run_id: RunId,
    pub status: RunStatus,
    pub exit_code: Option<i32>,
    pub started_at: u64,
    pub ended_at: Option<u64>,
    pub output_files: Vec<String>,
}
