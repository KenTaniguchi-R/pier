use anyhow::Result;
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

pub struct SpawnedProcess {
    pub child: Child,
}

/// Spawn a process. Returns immediately; use `stream_lines` or drive `child` directly.
pub fn spawn(bin: &Path, args: &[String], cwd: Option<&Path>) -> Result<SpawnedProcess> {
    let mut cmd = Command::new(bin);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    let child = cmd.spawn()?;
    Ok(SpawnedProcess { child })
}

/// Drain stdout and stderr line-by-line, calling `on_line` for each.
///
/// # Cancel / kill semantics (v0.1)
/// The caller drives cancellation via a `tokio::select!` on an external cancel signal
/// (see `run_tool.rs`). When the select fires the cancel arm, this future is simply
/// dropped. Tokio drops the `Child` handle which sends SIGKILL on macOS/Linux via the
/// tokio subprocess drop impl. This is "kill on drop" semantics — the child gets
/// SIGKILL, not a graceful SIGTERM first.
///
/// A SIGTERM-then-wait-then-SIGKILL grace period is a Phase-5 polish item: it would
/// require extracting the PID before handing the Child to this function, then signalling
/// via `nix::sys::signal` or by keeping a `child.start_kill()` handle. Not implemented
/// here to avoid unbounded scope.
pub async fn stream_lines<F>(mut p: SpawnedProcess, mut on_line: F) -> Result<std::process::ExitStatus>
where
    F: FnMut(String, &'static str),
{
    let stdout = p.child.stdout.take().expect("stdout piped");
    let stderr = p.child.stderr.take().expect("stderr piped");
    let mut so = BufReader::new(stdout).lines();
    let mut se = BufReader::new(stderr).lines();

    // Interleave stdout and stderr. We break out of the loop when stdout closes
    // (which is the natural EOF signal for most tools), then drain remaining stderr.
    loop {
        tokio::select! {
            line = so.next_line() => match line? {
                Some(s) => on_line(s, "stdout"),
                None => break,  // stdout EOF — tool is done writing
            },
            line = se.next_line() => {
                if let Some(s) = line? { on_line(s, "stderr"); }
            },
        }
    }

    // Drain any remaining stderr lines after stdout has closed.
    while let Some(s) = se.next_line().await? {
        on_line(s, "stderr");
    }

    Ok(p.child.wait().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn spawn_echo_has_positive_pid() {
        let p = spawn(
            std::path::Path::new("/bin/echo"),
            &["hello".to_string()],
            None,
        )
        .unwrap();
        // id() returns None only after the child has already been waited on.
        // Right after spawn it must be Some(pid > 0).
        let pid = p.child.id().expect("child pid present right after spawn");
        assert!(pid > 0);
    }

    #[tokio::test]
    async fn stream_lines_captures_stdout() {
        let p = spawn(
            std::path::Path::new("/bin/echo"),
            &["hello world".to_string()],
            None,
        )
        .unwrap();

        let mut lines: Vec<(String, &'static str)> = Vec::new();
        let status = stream_lines(p, |line, stream| lines.push((line, stream)))
            .await
            .unwrap();

        assert!(status.success());
        assert_eq!(lines, vec![("hello world".to_string(), "stdout")]);
    }
}
