//! Reads run history by joining Start+End records from the JSONL audit log.
//!
//! v0.1 strategy: scan the file. Audit log is the canonical record; a SQLite
//! index can be added later as a derived view if scan cost matters. For now,
//! this stays simple and correct.

use crate::infrastructure::run_store::{self, LogLine};
use anyhow::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub run_id: String,
    pub tool_id: String,
    pub started_at: u64,
    pub ended_at: Option<u64>,
    /// "success" | "failed" | "killed" | "running"
    pub status: String,
    pub exit_code: Option<i32>,
    pub output_path: Option<String>,
    pub output_bytes: Option<u64>,
    pub output_truncated: Option<bool>,
}

fn audit_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("audit.log")
}

/// Read summaries filtered by tool_id, newest first, capped at `limit`.
pub fn list_for_tool(tool_id: &str, limit: usize) -> Result<Vec<RunSummary>> {
    let path = audit_path();
    if !path.exists() { return Ok(Vec::new()); }
    list_for_tool_in(&path, tool_id, limit)
}

pub fn list_for_tool_in(audit: &Path, tool_id: &str, limit: usize) -> Result<Vec<RunSummary>> {
    let content = std::fs::read_to_string(audit)?;
    let mut summaries: std::collections::HashMap<String, RunSummary> = std::collections::HashMap::new();
    let mut order: Vec<String> = Vec::new();

    for line in content.lines() {
        if line.is_empty() { continue; }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let kind = v.get("kind").and_then(|k| k.as_str()).unwrap_or("");
        let tid = v.get("tool_id").and_then(|t| t.as_str()).unwrap_or("");
        if tid != tool_id { continue; }
        let rid = match v.get("run_id").and_then(|r| r.as_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let ts = v.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        match kind {
            "start" => {
                if !summaries.contains_key(&rid) {
                    order.push(rid.clone());
                }
                summaries.insert(rid.clone(), RunSummary {
                    run_id: rid,
                    tool_id: tid.to_string(),
                    started_at: ts,
                    ended_at: None,
                    status: "running".into(),
                    exit_code: None,
                    output_path: None,
                    output_bytes: None,
                    output_truncated: None,
                });
            }
            "end" => {
                let entry = summaries.entry(rid.clone()).or_insert_with(|| {
                    order.push(rid.clone());
                    RunSummary {
                        run_id: rid.clone(),
                        tool_id: tid.to_string(),
                        started_at: ts,
                        ended_at: None,
                        status: "running".into(),
                        exit_code: None,
                        output_path: None,
                        output_bytes: None,
                        output_truncated: None,
                    }
                });
                entry.ended_at = Some(ts);
                entry.exit_code = v.get("exit_code").and_then(|c| c.as_i64()).map(|c| c as i32);
                entry.status = v.get("status").and_then(|s| s.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| match entry.exit_code {
                        Some(0) => "success".into(),
                        Some(_) => "failed".into(),
                        None => "killed".into(),
                    });
                entry.output_path = v.get("output_path").and_then(|s| s.as_str()).map(String::from);
                entry.output_bytes = v.get("output_bytes").and_then(|n| n.as_u64());
                entry.output_truncated = v.get("output_truncated").and_then(|b| b.as_bool());
            }
            _ => {}
        }
    }

    let mut out: Vec<RunSummary> = order.into_iter()
        .filter_map(|id| summaries.remove(&id))
        .collect();
    out.reverse(); // newest first
    out.truncate(limit);
    Ok(out)
}

/// Read a stored run log. Path is taken from the audit record; we restrict
/// reads to the runs/ directory to prevent traversal via crafted audit lines.
pub fn read_output(path: &str) -> Result<Vec<LogLine>> {
    let canonical_dir = run_store::default_dir();
    let p = PathBuf::from(path);
    let resolved = std::fs::canonicalize(&p).unwrap_or(p.clone());
    let allowed = std::fs::canonicalize(&canonical_dir).unwrap_or(canonical_dir.clone());
    if !resolved.starts_with(&allowed) {
        anyhow::bail!("output path outside runs dir");
    }
    run_store::read_log(&resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::audit::{self, Entry};
    use tempfile::tempdir;

    #[test]
    fn joins_start_and_end_for_one_tool() {
        let d = tempdir().unwrap();
        let audit_log = d.path().join("audit.log");
        audit::append_to(&audit_log, &Entry::start_with_env(
            "r1", "toolA", Path::new("/bin/echo"), &["hi".into()],
            &std::collections::HashMap::new(), 100,
        )).unwrap();
        audit::append_to(&audit_log, &Entry::end_full(
            "r1", "toolA", Some(0), 110, "success",
            Some("/tmp/r1.log".into()), Some(42), Some(false),
        )).unwrap();
        // Different tool, must be filtered out.
        audit::append_to(&audit_log, &Entry::start_with_env(
            "r2", "toolB", Path::new("/bin/echo"), &[],
            &std::collections::HashMap::new(), 120,
        )).unwrap();

        let out = list_for_tool_in(&audit_log, "toolA", 50).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].run_id, "r1");
        assert_eq!(out[0].status, "success");
        assert_eq!(out[0].exit_code, Some(0));
        assert_eq!(out[0].output_bytes, Some(42));
    }

    #[test]
    fn newest_first_and_respects_limit() {
        let d = tempdir().unwrap();
        let audit_log = d.path().join("audit.log");
        for i in 0..5u64 {
            audit::append_to(&audit_log, &Entry::start_with_env(
                &format!("r{i}"), "t", Path::new("/bin/echo"), &[],
                &std::collections::HashMap::new(), i * 10,
            )).unwrap();
            audit::append_to(&audit_log, &Entry::end(
                &format!("r{i}"), "t", Some(0), i * 10 + 1,
            )).unwrap();
        }
        let out = list_for_tool_in(&audit_log, "t", 3).unwrap();
        assert_eq!(out.len(), 3);
        assert_eq!(out[0].run_id, "r4");
        assert_eq!(out[2].run_id, "r2");
    }

    #[test]
    fn pending_run_with_no_end_shown_as_running() {
        let d = tempdir().unwrap();
        let audit_log = d.path().join("audit.log");
        audit::append_to(&audit_log, &Entry::start_with_env(
            "r1", "t", Path::new("/bin/echo"), &[],
            &std::collections::HashMap::new(), 1,
        )).unwrap();
        let out = list_for_tool_in(&audit_log, "t", 50).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].status, "running");
        assert!(out[0].ended_at.is_none());
    }

    #[test]
    fn read_output_rejects_path_outside_runs_dir() {
        // Pick a path outside ~/.pier/runs/. read_output should reject.
        let res = read_output("/etc/passwd");
        assert!(res.is_err());
    }
}
