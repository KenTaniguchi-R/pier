//! Inspect and clear run history.
//!
//! "Run history" is sourced from the JSONL audit log + per-run output files
//! under `~/.pier/runs/`. Clearing wipes both so what the user sees in
//! per-tool history disappears in one move.

use anyhow::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStats {
    pub run_count: u64,
    pub bytes: u64,
}

fn audit_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("audit.log")
}

fn runs_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("runs")
}

pub fn stats() -> Result<HistoryStats> {
    stats_in(&audit_path(), &runs_dir())
}

pub fn stats_in(audit: &Path, runs: &Path) -> Result<HistoryStats> {
    let mut bytes: u64 = 0;
    let mut run_count: u64 = 0;

    if audit.exists() {
        let meta = std::fs::metadata(audit)?;
        bytes = bytes.saturating_add(meta.len());
        let content = std::fs::read_to_string(audit)?;
        for line in content.lines() {
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                if v.get("kind").and_then(|k| k.as_str()) == Some("start") {
                    run_count += 1;
                }
            }
        }
    }

    if runs.exists() {
        for entry in std::fs::read_dir(runs)? {
            let entry = entry?;
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    bytes = bytes.saturating_add(meta.len());
                }
            }
        }
    }

    Ok(HistoryStats { run_count, bytes })
}

pub fn clear() -> Result<()> {
    clear_in(&audit_path(), &runs_dir())
}

pub fn clear_in(audit: &Path, runs: &Path) -> Result<()> {
    if audit.exists() {
        std::fs::write(audit, "")?;
    }
    if runs.exists() {
        for entry in std::fs::read_dir(runs)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn stats_zero_when_nothing_present() {
        let d = tempdir().unwrap();
        let s = stats_in(&d.path().join("a.log"), &d.path().join("runs")).unwrap();
        assert_eq!(
            s,
            HistoryStats {
                run_count: 0,
                bytes: 0
            }
        );
    }

    #[test]
    fn stats_count_starts_and_sum_bytes() {
        let d = tempdir().unwrap();
        let audit = d.path().join("audit.log");
        let runs = d.path().join("runs");
        std::fs::create_dir_all(&runs).unwrap();
        std::fs::write(
            &audit,
            "{\"kind\":\"start\",\"run_id\":\"r1\"}\n{\"kind\":\"end\",\"run_id\":\"r1\"}\n{\"kind\":\"start\",\"run_id\":\"r2\"}\n",
        ).unwrap();
        std::fs::write(runs.join("r1.log"), "abc").unwrap();
        std::fs::write(runs.join("r2.log"), "defgh").unwrap();

        let s = stats_in(&audit, &runs).unwrap();
        assert_eq!(s.run_count, 2);
        // audit + r1 + r2 byte counts
        let audit_len = std::fs::metadata(&audit).unwrap().len();
        assert_eq!(s.bytes, audit_len + 3 + 5);
    }

    #[test]
    fn clear_truncates_audit_and_removes_run_files() {
        let d = tempdir().unwrap();
        let audit = d.path().join("audit.log");
        let runs = d.path().join("runs");
        std::fs::create_dir_all(&runs).unwrap();
        std::fs::write(&audit, "{\"kind\":\"start\"}\n").unwrap();
        std::fs::write(runs.join("r1.log"), "abc").unwrap();

        clear_in(&audit, &runs).unwrap();
        assert_eq!(std::fs::read_to_string(&audit).unwrap(), "");
        assert!(!runs.join("r1.log").exists());
        // Runs dir itself preserved.
        assert!(runs.exists());
    }
}
