use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Hard byte cap per run log. Once exceeded, further writes are dropped and a
/// `[output truncated]` marker line is appended exactly once. Matches CI viewer
/// ergonomics enough for v0.1; head+tail compaction can come later.
const MAX_BYTES: u64 = 2 * 1024 * 1024;

/// One persisted output line. Mirrors `infrastructure::subprocess::Segment`
/// but is its own type so the storage format is independent of the IPC shape.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogLine {
    /// "stdout" | "stderr"
    pub s: String,
    pub t: String,
    /// transient (CR-terminated, e.g. progress bar repaint)
    #[serde(default, skip_serializing_if = "is_false")]
    pub r: bool,
}

fn is_false(b: &bool) -> bool {
    !b
}

/// Append-only writer for a single run's output. Drop closes the file.
pub struct RunLog {
    path: PathBuf,
    file: Option<File>,
    bytes_written: u64,
    truncated: bool,
}

impl RunLog {
    /// Create (or truncate) the per-run log file at `dir/<run_id>.log`.
    pub fn create(dir: &Path, run_id: &str) -> Result<Self> {
        std::fs::create_dir_all(dir)?;
        let path = dir.join(format!("{run_id}.log"));
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)?;
        Ok(Self {
            path,
            file: Some(file),
            bytes_written: 0,
            truncated: false,
        })
    }

    /// Append a line. Silently drops once truncated; emits a marker exactly once.
    pub fn append(&mut self, line: &LogLine) {
        if self.file.is_none() {
            return;
        }
        if self.truncated {
            return;
        }

        let mut json = match serde_json::to_string(line) {
            Ok(s) => s,
            Err(_) => return,
        };
        json.push('\n');
        let next = self.bytes_written.saturating_add(json.len() as u64);

        if next > MAX_BYTES {
            self.truncated = true;
            let marker = serde_json::json!({"s":"stderr","t":"[output truncated]"}).to_string();
            let _ = self.file.as_mut().unwrap().write_all(marker.as_bytes());
            let _ = self.file.as_mut().unwrap().write_all(b"\n");
            self.bytes_written = self.bytes_written.saturating_add(marker.len() as u64 + 1);
            return;
        }

        if let Some(f) = self.file.as_mut() {
            if f.write_all(json.as_bytes()).is_ok() {
                self.bytes_written = next;
            }
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
    pub fn bytes(&self) -> u64 {
        self.bytes_written
    }
    pub fn truncated(&self) -> bool {
        self.truncated
    }
}

/// Default storage dir: `~/.pier/runs/`.
pub fn default_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("runs")
}

/// Read a run log back as a vector of lines.
pub fn read_log(path: &Path) -> Result<Vec<LogLine>> {
    let content = std::fs::read_to_string(path)?;
    let mut out = Vec::new();
    for line in content.lines() {
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<LogLine>(line) {
            Ok(l) => out.push(l),
            Err(_) => {
                // Tolerate corrupt/legacy lines — surface as stderr text.
                out.push(LogLine {
                    s: "stderr".into(),
                    t: line.into(),
                    r: false,
                });
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn line(s: &str, t: &str) -> LogLine {
        LogLine {
            s: s.into(),
            t: t.into(),
            r: false,
        }
    }

    #[test]
    fn writes_lines_as_jsonl() {
        let d = tempdir().unwrap();
        let mut log = RunLog::create(d.path(), "abc").unwrap();
        log.append(&line("stdout", "hello"));
        log.append(&line("stderr", "boom"));
        drop(log);
        let read = read_log(&d.path().join("abc.log")).unwrap();
        assert_eq!(read, vec![line("stdout", "hello"), line("stderr", "boom")]);
    }

    #[test]
    fn truncates_past_cap_and_emits_marker_once() {
        let d = tempdir().unwrap();
        let mut log = RunLog::create(d.path(), "big").unwrap();
        let big = "x".repeat(1024); // 1 KiB payload
        for _ in 0..(2200) {
            log.append(&line("stdout", &big));
        }
        assert!(log.truncated());
        drop(log);
        let read = read_log(&d.path().join("big.log")).unwrap();
        let markers: Vec<_> = read
            .iter()
            .filter(|l| l.t == "[output truncated]")
            .collect();
        assert_eq!(markers.len(), 1);
    }

    #[test]
    fn transient_flag_round_trips() {
        let d = tempdir().unwrap();
        let mut log = RunLog::create(d.path(), "t").unwrap();
        log.append(&LogLine {
            s: "stdout".into(),
            t: "50%".into(),
            r: true,
        });
        drop(log);
        let read = read_log(&d.path().join("t.log")).unwrap();
        assert_eq!(read[0].r, true);
    }

    #[test]
    fn read_log_tolerates_garbage_line() {
        let d = tempdir().unwrap();
        let p = d.path().join("g.log");
        std::fs::write(&p, "{\"s\":\"stdout\",\"t\":\"ok\"}\nnot-json\n").unwrap();
        let read = read_log(&p).unwrap();
        assert_eq!(read.len(), 2);
        assert_eq!(read[0].t, "ok");
        assert_eq!(read[1].t, "not-json");
    }
}
