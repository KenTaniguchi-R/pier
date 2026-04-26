use anyhow::Result;
use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Entry {
    Start {
        run_id: String,
        tool_id: String,
        bin: String,
        args: Vec<String>,
        #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
        env_keys: std::collections::HashMap<String, crate::application::env_resolver::EnvSource>,
        ts: u64,
    },
    End {
        run_id: String,
        tool_id: String,
        exit_code: Option<i32>,
        ts: u64,
    },
}

impl Entry {
    pub fn start(run_id: &str, tool_id: &str, bin: &Path, args: &[String], ts: u64) -> Self {
        Self::start_with_env(run_id, tool_id, bin, args, &std::collections::HashMap::new(), ts)
    }

    pub fn start_with_env(
        run_id: &str,
        tool_id: &str,
        bin: &Path,
        args: &[String],
        env_keys: &std::collections::HashMap<String, crate::application::env_resolver::EnvSource>,
        ts: u64,
    ) -> Self {
        Entry::Start {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            bin: bin.to_string_lossy().into(),
            args: args.to_vec(),
            env_keys: env_keys.clone(),
            ts,
        }
    }

    pub fn end(run_id: &str, tool_id: &str, exit_code: Option<i32>, ts: u64) -> Self {
        Entry::End {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            exit_code,
            ts,
        }
    }
}

/// Append an entry to the default audit log at ~/.pier/audit.log
pub fn append(entry: &Entry) -> Result<()> {
    let path = audit_path();
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    append_to(&path, entry)
}

/// Append an entry to a specific audit log file
pub fn append_to(path: &Path, entry: &Entry) -> Result<()> {
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    writeln!(f, "{}", serde_json::to_string(entry)?)?;
    Ok(())
}

fn audit_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("audit.log")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn appends_jsonl_lines() {
        let d = tempdir().unwrap();
        let path = d.path().join("audit.log");
        append_to(
            &path,
            &Entry::start("rid", "tid", std::path::Path::new("/bin/echo"), &["a".into()], 1),
        )
        .unwrap();
        append_to(&path, &Entry::end("rid", "tid", Some(0), 2)).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), 2);
    }

    #[test]
    fn start_entry_serializes_env_keys() {
        use std::collections::HashMap;
        use crate::application::env_resolver::EnvSource;
        let mut keys = HashMap::new();
        keys.insert("PATH".to_string(), EnvSource::Process);
        keys.insert("OPENAI_API_KEY".to_string(), EnvSource::Keychain);
        keys.insert("FROM_FILE".to_string(), EnvSource::EnvFile);
        let entry = Entry::start_with_env(
            "rid", "tid",
            std::path::Path::new("/bin/echo"), &["a".into()], &keys, 1,
        );
        let json = serde_json::to_string(&entry).unwrap();
        // Keys are present; no values are present.
        assert!(json.contains("\"PATH\""));
        assert!(json.contains("\"OPENAI_API_KEY\""));
        assert!(json.contains("\"FROM_FILE\""));
        assert!(json.contains("\"keychain\""));
        assert!(json.contains("\"envfile\""));
        assert!(json.contains("\"process\""));
        // Definitely no secret-looking content.
        assert!(!json.contains("sk-"));
    }
}
