use crate::domain::{Tool, ToolsConfig};
use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

/// Single source of truth for the loaded tools.json. The IPC layer never
/// accepts a `Tool` from the webview — it always reads through this registry.
///
/// Tracks per-tool keychain key allowlists (Task 3) computed at config load.
/// Later tasks add: pre-resolved absolute command paths (Task 5).
pub struct ToolRegistry {
    // Inner critical sections are panic-free (HashMap ops + clones), so the lock
    // cannot be poisoned in practice — `.unwrap()` on guard acquisition is safe.
    inner: RwLock<Inner>,
}

struct Inner {
    tools: HashMap<String, Tool>,
    keychain_keys: HashMap<String, HashSet<String>>,
    config: Option<ToolsConfig>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(Inner {
                tools: HashMap::new(),
                keychain_keys: HashMap::new(),
                config: None,
            }),
        }
    }

    pub fn replace(&self, config: ToolsConfig) {
        let mut tools = HashMap::new();
        let mut keychain_keys: HashMap<String, HashSet<String>> = HashMap::new();

        // Defaults env keys are global — every tool implicitly uses them, so
        // they must appear in every tool's allowlist.
        let mut defaults_keys: HashSet<String> = HashSet::new();
        if let Some(d) = &config.defaults {
            for raw in d.env.values() {
                if let Some(k) = parse_keychain_ref(raw) {
                    defaults_keys.insert(k);
                }
            }
        }

        for t in &config.tools {
            tools.insert(t.id.clone(), t.clone());
            let mut set = defaults_keys.clone();
            for raw in t.env.values() {
                if let Some(k) = parse_keychain_ref(raw) {
                    set.insert(k);
                }
            }
            keychain_keys.insert(t.id.clone(), set);
        }

        let mut g = self.inner.write().unwrap();
        g.tools = tools;
        g.keychain_keys = keychain_keys;
        g.config = Some(config);
    }

    pub fn get(&self, tool_id: &str) -> Option<Tool> {
        self.inner.read().unwrap().tools.get(tool_id).cloned()
    }

    pub fn defaults(&self) -> Option<crate::domain::Defaults> {
        self.inner.read().unwrap().config.as_ref().and_then(|c| c.defaults.clone())
    }

    /// Returns the set of keychain keys the named tool is permitted to read.
    /// Empty set if the tool id is unknown.
    pub fn keychain_keys_for(&self, tool_id: &str) -> HashSet<String> {
        self.inner
            .read()
            .unwrap()
            .keychain_keys
            .get(tool_id)
            .cloned()
            .unwrap_or_default()
    }
}

fn parse_keychain_ref(raw: &str) -> Option<String> {
    raw.strip_prefix("${keychain:")
        .and_then(|s| s.strip_suffix('}'))
        .map(|s| s.to_string())
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

    #[test]
    fn keychain_allowlist_includes_only_referenced_keys() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{
          "id":"a","name":"A","command":"/x",
          "env":{"K1":"${keychain:openai}","K2":"plain","K3":"${keychain:github}"}
        }]}"#));
        let allow = r.keychain_keys_for("a");
        assert!(allow.contains("openai"));
        assert!(allow.contains("github"));
        assert_eq!(allow.len(), 2);
    }

    #[test]
    fn keychain_allowlist_empty_for_tool_with_no_env() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[
            {"id":"a","name":"A","command":"/x"}
        ]}"#));
        assert!(r.keychain_keys_for("a").is_empty());
    }
}
