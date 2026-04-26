use crate::domain::ToolsConfig;
use std::path::Path;
use anyhow::{Context, Result};

pub fn load_config_from_path(path: &Path) -> Result<ToolsConfig> {
    let bytes = std::fs::read_to_string(path).with_context(|| format!("read {:?}", path))?;
    let cfg: ToolsConfig = serde_json::from_str(&bytes).with_context(|| "parse tools.json")?;
    Ok(cfg)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn loads_valid_config() {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, r#"{{"schemaVersion":"1.0","tools":[{{"id":"x","name":"X","command":"/bin/echo","inputType":"none"}}]}}"#).unwrap();
        let cfg = load_config_from_path(f.path()).unwrap();
        assert_eq!(cfg.tools.len(), 1);
    }
}
