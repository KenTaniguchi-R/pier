use crate::application::{audit, path_resolver, tool_registry::ToolRegistry};
use crate::domain::*;
use crate::events::{ExitEvent, OutputEvent};
use crate::infrastructure::subprocess::{spawn, stream_lines};
use crate::state::{AppState, RunHandle};
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const DEFAULT_TIMEOUT_SECS: u64 = 300;

/// Resolve a tool by id and check that the confirm gate is satisfied.
/// Pure (no AppHandle); used directly by tests, and called by run_tool.
pub(crate) fn validate_run(
    registry: &ToolRegistry,
    tool_id: &str,
    confirmed: bool,
) -> Result<Tool> {
    let tool = registry
        .get(tool_id)
        .ok_or_else(|| anyhow!("unknown tool: {tool_id}"))?;
    if tool.confirm.unwrap_or(false) && !confirmed {
        return Err(anyhow!("confirmation required for tool: {tool_id}"));
    }
    Ok(tool)
}

/// Public entry — looks the tool up in the registry attached to AppState.
pub async fn run_tool(
    app: AppHandle,
    tool_id: String,
    values: HashMap<String, serde_json::Value>,
    confirmed: bool,
) -> Result<RunId> {
    let registry = app.state::<AppState>().registry.clone();
    let tool = validate_run(&registry, &tool_id, confirmed)?;
    let defaults = registry.defaults();
    let allow = registry.keychain_keys_for(&tool.id);
    spawn_and_stream(app, tool, defaults, allow, tool_id, values).await
}

async fn spawn_and_stream(
    app: AppHandle,
    tool: Tool,
    defaults: Option<Defaults>,
    allow: std::collections::HashSet<String>,
    _tool_id: String,
    values: HashMap<String, serde_json::Value>,
) -> Result<RunId> {
    let run_id = Uuid::new_v4().to_string();
    let bin = path_resolver::resolve(&tool.command)?;
    let args = crate::application::arg_template::build_args(&tool, &values);
    let cwd = tool.cwd.as_ref()
        .or_else(|| defaults.as_ref().and_then(|d| d.cwd.as_ref()))
        .map(PathBuf::from);
    let process_env: HashMap<String, String> = std::env::vars().collect();
    let resolved_env = crate::application::env_resolver::resolve_with_allowlist(
        &tool,
        defaults.as_ref(),
        cwd.as_deref(),
        &process_env,
        &crate::application::env_resolver::keychain_lookup,
        &allow,
    );
    let started = now();

    let redacted = audit::redact_args(&args, &tool.parameters, &values);
    audit::append(&audit::Entry::start_with_env(
        &run_id, &tool.id, &bin, &redacted, &resolved_env.keys, started,
    ))?;

    let timeout_secs = tool.timeout.unwrap_or(DEFAULT_TIMEOUT_SECS);
    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();

    {
        let state = app.state::<AppState>();
        state.running.lock().unwrap().insert(
            run_id.clone(),
            RunHandle { cancel: Some(cancel_tx) },
        );
    }

    let app_clone = app.clone();
    let id_clone = run_id.clone();
    let tool_id = tool.id.clone();

    tokio::spawn(async move {
        let proc = match spawn(&bin, &args, cwd.as_deref(), &resolved_env.vars) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[pier] spawn error for run {id_clone}: {e}");
                let _ = app_clone.emit(
                    "pier://exit",
                    ExitEvent { run_id: id_clone.clone(), status: RunStatus::Failed, exit_code: None, ended_at: now() },
                );
                if let Some(state) = app_clone.try_state::<AppState>() {
                    state.running.lock().unwrap().remove(&id_clone);
                }
                return;
            }
        };

        let id_for_lines = id_clone.clone();
        let app_for_lines = app_clone.clone();
        let stream_fut = stream_lines(proc, move |seg| {
            let _ = app_for_lines.emit("pier://output",
                OutputEvent { run_id: id_for_lines.clone(), line: seg.text, stream: seg.stream.to_string(), transient: seg.transient });
        });

        let result = tokio::select! {
            r = tokio::time::timeout(Duration::from_secs(timeout_secs), stream_fut) => match r {
                Ok(Ok(s)) => Some(s),
                Ok(Err(e)) => { eprintln!("[pier] stream error for run {id_clone}: {e}"); None },
                Err(_) => { eprintln!("[pier] timeout for run {id_clone} after {timeout_secs}s"); None },
            },
            _ = &mut cancel_rx => None,
        };

        let ended = now();
        let (status, code) = match result {
            Some(s) if s.success() => (RunStatus::Success, s.code()),
            Some(s) => (RunStatus::Failed, s.code()),
            None => (RunStatus::Killed, None),
        };

        let _ = app_clone.emit("pier://exit",
            ExitEvent { run_id: id_clone.clone(), status, exit_code: code, ended_at: ended });
        let _ = audit::append(&audit::Entry::end(&id_clone, &tool_id, code, ended));

        if let Some(state) = app_clone.try_state::<AppState>() {
            state.running.lock().unwrap().remove(&id_clone);
        }
    });

    Ok(run_id)
}

pub async fn kill_run(app: AppHandle, run_id: String) -> Result<()> {
    let state = app.state::<AppState>();
    let handle = state.running.lock().unwrap().remove(&run_id);
    if let Some(mut h) = handle {
        if let Some(tx) = h.cancel.take() {
            let _ = tx.send(());
        }
    }
    Ok(())
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::tool_registry::ToolRegistry;

    #[test]
    fn validate_run_rejects_unknown_tool_id() {
        let registry = ToolRegistry::new();
        let err = validate_run(&registry, "does-not-exist", false).unwrap_err();
        assert!(format!("{err:#}").contains("unknown tool"));
    }

    #[test]
    fn validate_run_rejects_confirm_required_but_not_confirmed() {
        let registry = ToolRegistry::new();
        let cfg: ToolsConfig = serde_json::from_str(
            r#"{"schemaVersion":"1.0","tools":[
                {"id":"x","name":"X","command":"/bin/echo","confirm":true}
            ]}"#,
        ).unwrap();
        registry.replace(cfg);
        let err = validate_run(&registry, "x", false).unwrap_err();
        assert!(format!("{err:#}").contains("confirmation required"));
    }

    #[test]
    fn validate_run_passes_when_confirmed() {
        let registry = ToolRegistry::new();
        let cfg: ToolsConfig = serde_json::from_str(
            r#"{"schemaVersion":"1.0","tools":[
                {"id":"x","name":"X","command":"/bin/echo","confirm":true}
            ]}"#,
        ).unwrap();
        registry.replace(cfg);
        let tool = validate_run(&registry, "x", true).unwrap();
        assert_eq!(tool.id, "x");
    }
}
