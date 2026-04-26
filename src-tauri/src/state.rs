use crate::domain::RunId;
use std::collections::HashMap;
use std::sync::Mutex;

/// Per-run handle stored in AppState while the subprocess is live.
pub struct RunHandle {
    /// Sending on this channel signals the streaming task to abort.
    /// On receipt, the streaming future is dropped which causes tokio to SIGKILL
    /// the child process (kill-on-drop semantics). See subprocess.rs for details.
    pub cancel: Option<tokio::sync::oneshot::Sender<()>>,
}

pub struct AppState {
    pub running: Mutex<HashMap<RunId, RunHandle>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
