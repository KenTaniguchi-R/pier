use crate::domain::{CatalogTool, Tool, ToolSource, ToolsConfig};
use anyhow::{bail, Context, Result};
use std::path::Path;

#[derive(Debug)]
pub struct AddPreview {
    pub before: String,
    pub after: String,
    pub new_tool: Tool,
}

pub fn build_tool_entry(catalog: &str, src: &CatalogTool, command: String, sha256: String) -> Tool {
    Tool {
        id: src.id.clone(),
        name: src.name.clone(),
        command,
        args: Vec::new(),
        parameters: Vec::new(),
        description: Some(src.description.clone()),
        icon: None,
        timeout: None,
        confirm: None,
        shell: None,
        cwd: None,
        category: Some(src.category.clone()),
        env_file: None,
        env: std::collections::HashMap::new(),
        source: Some(ToolSource {
            catalog: catalog.into(),
            version: src.version.clone(),
            sha256,
        }),
    }
}

pub fn preview(config_path: &Path, new_tool: Tool) -> Result<AddPreview> {
    let before = std::fs::read_to_string(config_path).context("read tools.json")?;
    let mut cfg: ToolsConfig = serde_json::from_str(&before).context("parse tools.json")?;
    if cfg.tools.iter().any(|t| t.id == new_tool.id) {
        bail!("tool id '{}' already exists in tools.json", new_tool.id);
    }
    cfg.tools.push(new_tool.clone());
    let after = serde_json::to_string_pretty(&cfg)? + "\n";
    Ok(AddPreview {
        before,
        after,
        new_tool,
    })
}

pub fn commit(config_path: &Path, after: &str) -> Result<()> {
    // Atomic write — same pattern as cache.rs / install.rs (unique tmp suffix).
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = config_path.with_extension(format!("tmp.{}.{}", std::process::id(), nanos));
    std::fs::write(&tmp, after)?;
    std::fs::rename(&tmp, config_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Permissions;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn cat_tool() -> CatalogTool {
        CatalogTool {
            id: "x".into(),
            name: "X".into(),
            version: "1.0.0".into(),
            description: "d".into(),
            category: "dev".into(),
            params: vec![],
            permissions: Permissions {
                network: false,
                fs_read: vec![],
                fs_write: vec![],
            },
            platforms: Default::default(),
            script: None,
            min_pier_version: None,
            deprecated: false,
        }
    }

    #[test]
    fn preview_then_commit_appends_tool() {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, r#"{{"schemaVersion":"1.0","tools":[]}}"#).unwrap();
        let t = build_tool_entry("pier-tools", &cat_tool(), "/bin/x".into(), "abc".into());
        let p = preview(f.path(), t).unwrap();
        commit(f.path(), &p.after).unwrap();
        let after = std::fs::read_to_string(f.path()).unwrap();
        assert!(
            after.contains("\"id\": \"x\""),
            "missing tool id; got: {after}"
        );
        assert!(
            after.contains("\"sha256\": \"abc\""),
            "missing sha256 in source; got: {after}"
        );
    }

    #[test]
    fn rejects_duplicate_id() {
        let mut f = NamedTempFile::new().unwrap();
        write!(
            f,
            r#"{{"schemaVersion":"1.0","tools":[{{"id":"x","name":"X","command":"/bin/x"}}]}}"#
        )
        .unwrap();
        let t = build_tool_entry("pier-tools", &cat_tool(), "/bin/x".into(), "abc".into());
        let err = preview(f.path(), t).unwrap_err();
        assert!(err.to_string().contains("already exists"), "got: {err}");
    }
}
