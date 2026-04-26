/// Stub audit module — Task 9 will implement the actual file write.
/// This file exists so Task 8 wiring compiles and callers can use the
/// same `audit::append(&audit::Entry::start(...))` call-site that Task 9 will fulfill.
use anyhow::Result;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
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

/// No-op for now. Task 9 replaces this with append-to-JSONL file logic.
pub fn append(_entry: &Entry) -> Result<()> {
    Ok(())
}
