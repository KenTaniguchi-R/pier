use anyhow::Result;
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::{Child, Command};

pub struct SpawnedProcess {
    pub child: Child,
}

/// One emitted segment of subprocess output.
///
/// `transient` is true for `\r`-terminated segments — used by tqdm/pip/curl/etc to
/// repaint a progress bar in place. The frontend replaces the previous transient
/// segment of the same stream rather than appending, so a hundred refreshes of a
/// progress bar collapse into one mutating row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Segment {
    pub text: String,
    pub stream: &'static str, // "stdout" | "stderr"
    pub transient: bool,
}

/// Spawn a process. Returns immediately; use `stream_lines` or drive `child` directly.
pub fn spawn(
    bin: &Path,
    args: &[String],
    cwd: Option<&Path>,
    env: &std::collections::HashMap<String, String>,
) -> Result<SpawnedProcess> {
    let mut cmd = Command::new(bin);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .env_clear()
        .envs(env);
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    let child = cmd.spawn()?;
    Ok(SpawnedProcess { child })
}

/// Drain stdout and stderr, calling `on_segment` for each `Segment`.
///
/// Output is split on `\n` (final segment) or lone `\r` (transient — see [`Segment`]).
/// `\r\n` is treated as a single newline. ANSI escape sequences (colors, cursor moves)
/// are stripped before emit.
///
/// # Cancel / kill semantics (v0.1)
/// The caller drives cancellation via a `tokio::select!` on an external cancel signal
/// (see `run_tool.rs`). When the cancel arm fires, this future is dropped, which drops
/// the `Child` — tokio sends SIGKILL on drop (macOS/Linux).
pub async fn stream_lines<F>(
    mut p: SpawnedProcess,
    mut on_segment: F,
) -> Result<std::process::ExitStatus>
where
    F: FnMut(Segment),
{
    let stdout = p.child.stdout.take().expect("stdout piped");
    let stderr = p.child.stderr.take().expect("stderr piped");

    let mut so = StreamSplitter::new(stdout, "stdout");
    let mut se = StreamSplitter::new(stderr, "stderr");

    // Phase 1: interleave both streams until stdout closes (the natural EOF signal).
    let mut stdout_open = true;
    while stdout_open {
        let batch = tokio::select! {
            r = so.next() => { let (more, b) = r?; stdout_open = more; b },
            r = se.next() => r?.1,
        };
        for seg in batch {
            on_segment(seg);
        }
    }

    // Phase 2: drain remaining stderr.
    loop {
        let (more, batch) = se.next().await?;
        for seg in batch {
            on_segment(seg);
        }
        if !more {
            break;
        }
    }

    Ok(p.child.wait().await?)
}

/// Reads bytes from an async reader, accumulates into a line buffer, and emits a
/// `Segment` whenever it sees `\n` or `\r`. Defers commit on `\r` to disambiguate
/// CRLF from a lone CR.
struct StreamSplitter<R> {
    reader: R,
    stream: &'static str,
    buf: Vec<u8>,
    chunk: [u8; 8192],
    eof: bool,
    pending_cr: bool,
}

impl<R: AsyncRead + Unpin> StreamSplitter<R> {
    fn new(reader: R, stream: &'static str) -> Self {
        Self {
            reader,
            stream,
            buf: Vec::with_capacity(256),
            chunk: [0; 8192],
            eof: false,
            pending_cr: false,
        }
    }

    /// Drain the current line buffer into a `Segment`.
    fn commit(&mut self, transient: bool) -> Segment {
        let raw = std::mem::take(&mut self.buf);
        Segment {
            text: decode(&raw),
            stream: self.stream,
            transient,
        }
    }

    /// Read one chunk and return the segments found in it, plus a "more data may
    /// follow" flag (`false` on EOF, after flushing the remainder).
    async fn next(&mut self) -> Result<(bool, Vec<Segment>)> {
        let mut out = Vec::new();
        if self.eof {
            return Ok((false, out));
        }

        let n = self.reader.read(&mut self.chunk).await?;
        if n == 0 {
            self.eof = true;
            // A deferred CR at EOF was a real lone CR; then flush any partial buffer.
            if self.pending_cr {
                self.pending_cr = false;
                out.push(self.commit(true));
            }
            if !self.buf.is_empty() {
                out.push(self.commit(false));
            }
            return Ok((false, out));
        }

        for i in 0..n {
            let b = self.chunk[i];
            // Resolve a deferred CR before processing the next byte.
            // \r\n: CR was part of CRLF — consume both, emit one final segment.
            // \r<other>: CR was a lone CR — emit transient, then handle <other>.
            if self.pending_cr {
                self.pending_cr = false;
                if b == b'\n' {
                    out.push(self.commit(false));
                    continue;
                }
                out.push(self.commit(true));
            }
            match b {
                b'\n' => out.push(self.commit(false)),
                b'\r' => self.pending_cr = true,
                _ => self.buf.push(b),
            }
        }
        Ok((true, out))
    }
}

/// Strip ANSI escape sequences (colors, cursor movement, erase-line, etc.) and decode
/// as UTF-8 (lossy — partial multi-byte sequences become replacement chars).
fn decode(raw: &[u8]) -> String {
    let cleaned = strip_ansi_escapes::strip(raw);
    String::from_utf8_lossy(&cleaned).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sh(script: &str) -> SpawnedProcess {
        spawn(
            std::path::Path::new("/bin/sh"),
            &["-c".into(), script.into()],
            None,
            &std::collections::HashMap::new(),
        )
        .unwrap()
    }

    async fn collect(p: SpawnedProcess) -> Vec<Segment> {
        let mut segs = Vec::new();
        let _ = stream_lines(p, |s| segs.push(s)).await.unwrap();
        segs
    }

    fn seg(text: &str, stream: &'static str, transient: bool) -> Segment {
        Segment {
            text: text.into(),
            stream,
            transient,
        }
    }

    #[tokio::test]
    async fn spawn_echo_has_positive_pid() {
        let p = spawn(
            std::path::Path::new("/bin/echo"),
            &["hello".to_string()],
            None,
            &std::collections::HashMap::new(),
        )
        .unwrap();
        let pid = p.child.id().expect("child pid present right after spawn");
        assert!(pid > 0);
    }

    #[tokio::test]
    async fn stream_lines_captures_stdout() {
        let segs = collect(sh("printf 'hello world\\n'")).await;
        assert_eq!(segs, vec![seg("hello world", "stdout", false)]);
    }

    #[tokio::test]
    async fn spawn_sees_provided_env() {
        use std::collections::HashMap;
        let mut env = HashMap::new();
        env.insert("PIER_TEST_VAR".into(), "hello-pier".into());
        let p = spawn(std::path::Path::new("/usr/bin/env"), &[], None, &env).unwrap();
        let segs = collect(p).await;
        assert!(
            segs.iter().any(|s| s.text == "PIER_TEST_VAR=hello-pier"),
            "expected env var in /usr/bin/env output, got: {segs:?}"
        );
    }

    #[tokio::test]
    async fn carriage_return_emits_transient_segments() {
        // Simulate a tqdm-style progress bar: \r-separated updates ending in \n.
        let segs = collect(sh("printf '10%%\\r50%%\\r100%%\\ndone\\n'")).await;
        assert_eq!(
            segs,
            vec![
                seg("10%", "stdout", true),
                seg("50%", "stdout", true),
                seg("100%", "stdout", false),
                seg("done", "stdout", false),
            ]
        );
    }

    #[tokio::test]
    async fn ansi_escapes_are_stripped() {
        let segs = collect(sh("printf '\\033[31mred\\033[0m\\n'")).await;
        assert_eq!(segs, vec![seg("red", "stdout", false)]);
    }

    #[tokio::test]
    async fn crlf_is_treated_as_single_newline() {
        let segs = collect(sh("printf 'a\\r\\nb\\r\\n'")).await;
        assert_eq!(
            segs,
            vec![seg("a", "stdout", false), seg("b", "stdout", false),]
        );
    }
}
