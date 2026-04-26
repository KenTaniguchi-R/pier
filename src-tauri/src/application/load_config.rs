use crate::domain::ToolsConfig;
use std::path::Path;
use anyhow::{Context, Result};

pub fn load_config_from_path(path: &Path) -> Result<ToolsConfig> {
    let bytes = std::fs::read_to_string(path).with_context(|| format!("read {:?}", path))?;
    let cfg: ToolsConfig = serde_json::from_str(&bytes).with_context(|| "parse tools.json")?;
    Ok(cfg)
}

const DEFAULT_CONFIG: &str = r#"{
  "schemaVersion": "1.0",
  "tools": [
    {
      "id": "hello",
      "name": "Say hello",
      "command": "/bin/echo",
      "args": ["Welcome to Pier — drag a file onto a tool, or just click Run"],
      "description": "A quick test to make sure everything's working.",
      "icon": "👋",
      "category": "starter",
      "confirm": false
    },
    {
      "id": "file-info",
      "name": "What's this file?",
      "command": "/usr/bin/file",
      "args": ["{input}"],
      "parameters": [{ "id": "input", "type": "file" }],
      "description": "Drop any file to see what kind it is.",
      "icon": "📄",
      "category": "starter"
    }
  ]
}
"#;

pub fn seed_default_if_missing(path: &Path) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("mkdir {:?}", parent))?;
    }
    std::fs::write(path, DEFAULT_CONFIG).with_context(|| format!("write {:?}", path))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{NamedTempFile, tempdir};
    use std::io::Write;

    #[test]
    fn loads_valid_config() {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, r#"{{"schemaVersion":"1.0","tools":[{{"id":"x","name":"X","command":"/bin/echo","inputType":"none"}}]}}"#).unwrap();
        let cfg = load_config_from_path(f.path()).unwrap();
        assert_eq!(cfg.tools.len(), 1);
    }

    #[test]
    fn seeds_default_when_missing() {
        let d = tempdir().unwrap();
        let p = d.path().join("tools.json");
        assert!(!p.exists());
        seed_default_if_missing(&p).unwrap();
        assert!(p.exists());
        let cfg = load_config_from_path(&p).unwrap();
        assert!(cfg.tools.iter().any(|t| t.id == "hello"));
    }

    #[test]
    fn seed_does_nothing_when_present() {
        let d = tempdir().unwrap();
        let p = d.path().join("tools.json");
        std::fs::write(&p, r#"{"schemaVersion":"1.0","tools":[]}"#).unwrap();
        seed_default_if_missing(&p).unwrap();
        let content = std::fs::read_to_string(&p).unwrap();
        assert!(content.contains("\"tools\":[]"));
    }
}
