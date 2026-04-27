use crate::domain::{Tool, ToolsConfig};
use std::collections::HashMap;
use std::sync::RwLock;

/// Single source of truth for the loaded tools.json. Paths are pre-resolved,
/// keychain allowlists are precomputed. The IPC layer never accepts a `Tool`
/// from the webview — it always reads through this registry.
pub struct ToolRegistry {
    inner: RwLock<Inner>,
}

struct Inner {
    tools: HashMap<String, Tool>,
    config: Option<ToolsConfig>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { inner: RwLock::new(Inner { tools: HashMap::new(), config: None }) }
    }

    pub fn replace(&self, config: ToolsConfig) {
        let mut tools = HashMap::new();
        for t in &config.tools {
            tools.insert(t.id.clone(), t.clone());
        }
        let mut g = self.inner.write().unwrap();
        g.tools = tools;
        g.config = Some(config);
    }

    pub fn get(&self, tool_id: &str) -> Option<Tool> {
        self.inner.read().unwrap().tools.get(tool_id).cloned()
    }

    pub fn defaults(&self) -> Option<crate::domain::Defaults> {
        self.inner.read().unwrap().config.as_ref().and_then(|c| c.defaults.clone())
    }
}

impl Default for ToolRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(json: &str) -> ToolsConfig {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn get_returns_loaded_tool() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[
            {"id":"a","name":"A","command":"/bin/echo"}
        ]}"#));
        assert_eq!(r.get("a").unwrap().name, "A");
    }

    #[test]
    fn get_returns_none_for_unknown() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[]}"#));
        assert!(r.get("nope").is_none());
    }

    #[test]
    fn replace_swaps_cleanly() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{"id":"a","name":"A","command":"/x"}]}"#));
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{"id":"b","name":"B","command":"/x"}]}"#));
        assert!(r.get("a").is_none());
        assert!(r.get("b").is_some());
    }
}
