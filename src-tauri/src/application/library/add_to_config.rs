use crate::domain::{CatalogTool, Tool, ToolSource, ToolsConfig};
use anyhow::{bail, Context, Result};
use serde_json::Value;
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

/// Pure: remove the tool with the given id from a tools.json string.
/// Returns the new JSON string (with trailing newline), or an error if the id was
/// not present.
pub fn remove_tool_from_config_str(json: &str, id: &str) -> Result<String, String> {
    let mut v: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let tools = v
        .get_mut("tools")
        .and_then(|t| t.as_array_mut())
        .ok_or_else(|| "tools.json is missing the `tools` array".to_string())?;
    let before_len = tools.len();
    tools.retain(|t| t.get("id").and_then(|x| x.as_str()) != Some(id));
    if tools.len() == before_len {
        return Err(format!("tool `{id}` not found"));
    }
    let mut out = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    out.push('\n');
    Ok(out)
}

/// Use case: read tools.json, remove `tool_id`, write back atomically.
/// Mirrors the file I/O pattern used by [`commit`].
pub fn library_commit_remove(config_path: &Path, tool_id: &str) -> Result<()> {
    let original = std::fs::read_to_string(config_path).context("read tools.json")?;
    let next =
        remove_tool_from_config_str(&original, tool_id).map_err(|e| anyhow::anyhow!("{e}"))?;
    commit(config_path, &next)
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
    fn library_commit_remove_strips_matching_tool() {
        let before = r#"{"schemaVersion":"1.0","tools":[
          {"id":"a","name":"A","command":"/bin/true"},
          {"id":"b","name":"B","command":"/bin/true"}
        ]}"#;
        let after = remove_tool_from_config_str(before, "a").unwrap();
        assert!(!after.contains("\"id\": \"a\""), "still has a; got: {after}");
        assert!(after.contains("\"id\": \"b\""), "missing b; got: {after}");
    }

    #[test]
    fn library_commit_remove_errors_when_id_missing() {
        let before = r#"{"schemaVersion":"1.0","tools":[]}"#;
        let err = remove_tool_from_config_str(before, "missing").unwrap_err();
        assert!(
            err.to_lowercase().contains("not found"),
            "got: {err}"
        );
    }

    #[test]
    fn library_commit_remove_writes_file() {
        let mut f = NamedTempFile::new().unwrap();
        write!(
            f,
            r#"{{"schemaVersion":"1.0","tools":[{{"id":"a","name":"A","command":"/bin/true"}},{{"id":"b","name":"B","command":"/bin/true"}}]}}"#
        )
        .unwrap();
        library_commit_remove(f.path(), "a").unwrap();
        let after = std::fs::read_to_string(f.path()).unwrap();
        assert!(!after.contains("\"id\": \"a\""), "got: {after}");
        assert!(after.contains("\"id\": \"b\""), "got: {after}");
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
