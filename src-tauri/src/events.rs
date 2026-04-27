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
    /// True for in-progress segments (CR-terminated, e.g. tqdm bar refreshes).
    /// The frontend replaces the prior transient row of the same stream instead of appending.
    pub transient: bool,
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
