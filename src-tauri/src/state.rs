use crate::application::tool_registry::ToolRegistry;
use crate::domain::RunId;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct RunHandle {
    pub cancel: Option<tokio::sync::oneshot::Sender<()>>,
}

pub struct AppState {
    pub running: Mutex<HashMap<RunId, RunHandle>>,
    pub registry: Arc<ToolRegistry>,
    pub settings_lock: tokio::sync::Mutex<()>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(HashMap::new()),
            registry: Arc::new(ToolRegistry::new()),
            settings_lock: tokio::sync::Mutex::new(()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self { Self::new() }
}
