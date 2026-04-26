use crate::domain::RunStatus;
use serde::Serialize;

/// Emitted on `pier://output` for each line of stdout or stderr.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutputEvent {
    pub run_id: String,
    pub line: String,
    /// "stdout" or "stderr"
    pub stream: String,
}

/// Emitted on `pier://exit` when the process finishes, is killed, or times out.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExitEvent {
    pub run_id: String,
    pub status: RunStatus,
    pub exit_code: Option<i32>,
    pub ended_at: u64,
}
