use crate::application::{audit, path_resolver};
use crate::domain::*;
use crate::events::{ExitEvent, OutputEvent};
use crate::infrastructure::subprocess::{spawn, stream_lines};
use crate::state::{AppState, RunHandle};
use anyhow::Result;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const DEFAULT_TIMEOUT_SECS: u64 = 300;

/// Spawn a tool subprocess and begin streaming its output to the frontend via Tauri events.
///
/// Returns the `run_id` immediately so the caller can correlate events.
/// The actual subprocess runs on a background tokio task.
///
/// # Event channel
/// - `pier://output` — `OutputEvent` for each line (stdout / stderr)
/// - `pier://exit`   — `ExitEvent` when the process ends for any reason
///
/// # Kill / cancel semantics (v0.1)
/// A oneshot channel is stored in `AppState`. `kill_run` sends on that channel,
/// which causes the `tokio::select!` in the background task to drop the streaming
/// future. Dropping the streaming future drops the `SpawnedProcess` which drops
/// the tokio `Child` handle — tokio sends SIGKILL on drop (macOS/Linux).
///
/// This is "SIGKILL on cancel" semantics, not SIGTERM+grace+SIGKILL. A graceful
/// SIGTERM flow is deferred to Phase 5 (would require extracting the child PID or
/// using `child.start_kill()` before handing the Child to `stream_lines`).
pub async fn run_tool(app: AppHandle, tool: Tool, req: RunRequest) -> Result<RunId> {
    let run_id = Uuid::new_v4().to_string();
    let bin = path_resolver::resolve(&tool.command)?;
    let args = crate::application::arg_template::build_args(&tool, &req.values);
    let cwd = tool.cwd.as_ref().map(PathBuf::from);
    let started = now();

    audit::append(&audit::Entry::start(&run_id, &tool.id, &bin, &args, started))?;

    let timeout_secs = tool.timeout.unwrap_or(DEFAULT_TIMEOUT_SECS);
    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();

    {
        let state = app.state::<AppState>();
        state.running.lock().unwrap().insert(
            run_id.clone(),
            RunHandle {
                cancel: Some(cancel_tx),
            },
        );
    }

    let app_clone = app.clone();
    let id_clone = run_id.clone();
    let tool_id = tool.id.clone();

    tokio::spawn(async move {
        let proc = match spawn(&bin, &args, cwd.as_deref()) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[pier] spawn error for run {id_clone}: {e}");
                let _ = app_clone.emit(
                    "pier://exit",
                    ExitEvent {
                        run_id: id_clone.clone(),
                        status: RunStatus::Failed,
                        exit_code: None,
                        ended_at: now(),
                    },
                );
                // Remove stale handle
                if let Some(state) = app_clone.try_state::<AppState>() {
                    state.running.lock().unwrap().remove(&id_clone);
                }
                return;
            }
        };

        let id_for_lines = id_clone.clone();
        let app_for_lines = app_clone.clone();

        let stream_fut = stream_lines(proc, move |line, stream| {
            let _ = app_for_lines.emit(
                "pier://output",
                OutputEvent {
                    run_id: id_for_lines.clone(),
                    line,
                    stream: stream.to_string(),
                },
            );
        });

        // Race: stream completes naturally  vs.  cancel signal  vs.  timeout
        let result = tokio::select! {
            r = tokio::time::timeout(Duration::from_secs(timeout_secs), stream_fut) => match r {
                Ok(Ok(status)) => Some(status),
                Ok(Err(e)) => {
                    eprintln!("[pier] stream error for run {id_clone}: {e}");
                    None
                },
                Err(_) => {
                    // Timeout expired — child is killed when stream_fut is dropped.
                    eprintln!("[pier] timeout for run {id_clone} after {timeout_secs}s");
                    None
                },
            },
            _ = &mut cancel_rx => {
                // Kill requested — dropping stream_fut kills the child (SIGKILL on drop).
                None
            },
        };

        let ended = now();
        let (status, code) = match result {
            Some(s) if s.success() => (RunStatus::Success, s.code()),
            Some(s) => (RunStatus::Failed, s.code()),
            None => (RunStatus::Killed, None),
        };

        let _ = app_clone.emit(
            "pier://exit",
            ExitEvent {
                run_id: id_clone.clone(),
                status,
                exit_code: code,
                ended_at: ended,
            },
        );
        let _ = audit::append(&audit::Entry::end(&id_clone, &tool_id, code, ended));

        // Clean up — handle may already be gone if kill_run removed it.
        if let Some(state) = app_clone.try_state::<AppState>() {
            state.running.lock().unwrap().remove(&id_clone);
        }
    });

    Ok(run_id)
}

/// Signal a running subprocess to stop.
/// Sends on the cancel oneshot; the background task handles SIGKILL via drop.
pub async fn kill_run(app: AppHandle, run_id: String) -> Result<()> {
    let state = app.state::<AppState>();
    let handle = state.running.lock().unwrap().remove(&run_id);
    if let Some(mut h) = handle {
        if let Some(tx) = h.cancel.take() {
            // Ignore SendError — means the task already finished.
            let _ = tx.send(());
        }
    }
    Ok(())
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
