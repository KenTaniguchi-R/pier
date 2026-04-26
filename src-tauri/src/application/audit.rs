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
        Entry::Start {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            bin: bin.to_string_lossy().into(),
            args: args.to_vec(),
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
}
