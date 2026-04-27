# Pier IPC Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the IPC trust boundary in Pier (server-side `tool_id` lookup, server-enforced confirm, keychain key allowlist), redact secret args from the audit log, pin command paths at config load, default to a clean spawn env, and split prod/dev CSP. No new layers; reinforce existing clean-architecture seams.

**Architecture:** Backend-heavy. New `tool_registry` module owns the in-memory `ToolsConfig` as the single source of truth. `run_tool_cmd` accepts only `{tool_id, values, confirmed}` from IPC. Audit gains a `redact_args` step keyed off `parameters[].secret`. Path resolver pins absolute paths at load. Env resolver baselines to a small allowlist plus opt-in `${env:X}`. Frontend swaps the `CommandRunner` signature; one new `SecretField` atom.

**Tech Stack:** Rust (Tauri 2, tokio, serde, anyhow, dirs, dotenvy), TypeScript (React 19, Vitest, jsdom), Tailwind v4.

**Reference spec:** `docs/superpowers/specs/2026-04-26-pier-ipc-hardening-design.md`

---

## File Structure

### Backend (`src-tauri/src/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `domain/tool.rs` | modify | Add `secret: Option<bool>` to `ParameterBase` |
| `domain/run.rs` | modify | Add `RunRequestPayload { tool_id, values, confirmed }` |
| `application/tool_registry.rs` | **create** | In-memory `ToolsConfig` w/ pinned paths + keychain allowlists |
| `application/run_tool.rs` | modify | Lookup by `tool_id`, enforce `confirm`, baseline env |
| `application/env_resolver.rs` | modify | `baseline_env()`; keychain allowlist enforcement |
| `application/audit.rs` | modify | `redact_args()`; redacted args in `Entry::Start` |
| `application/path_resolver.rs` | modify | Drop home-dir search; pinning helper |
| `application/load_config.rs` | modify | Return `ToolsConfig` only; registry takes ownership |
| `application/watch_config.rs` | modify | Reload registry on file change |
| `commands.rs` | modify | New `run_tool_cmd` signature; populate registry on `load_tools_config` |
| `state.rs` | modify | Hold `Arc<RwLock<ToolRegistry>>` |

### Frontend (`src/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `domain/tool.ts` | modify | Mirror `secret?: boolean` on parameter base |
| `application/ports.ts` | modify | `CommandRunner.run(toolId, values, confirmed)` |
| `infrastructure/tauriCommandRunner.ts` | modify | Pass new IPC payload |
| `state/RunnerContext.tsx` | modify (signature only) | Same shape, new types |
| `ui/atoms/SecretField.tsx` | **create** | Password input w/ reveal toggle |
| `ui/molecules/ParamField.tsx` | modify | Render `SecretField` when `secret: true` |
| `ui/organisms/ToolRunner.tsx` | modify | Pass `confirmed` to runner |

### Build

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/tauri.conf.json` | modify | Production CSP only (drop dev origins) |
| `src-tauri/tauri.conf.dev.json` | **create** | Dev CSP w/ `localhost:1420` |

---

## Test Commands (memorize)

- All Rust: `cargo test --manifest-path src-tauri/Cargo.toml`
- One Rust test: `cargo test --manifest-path src-tauri/Cargo.toml -- <name> --exact --nocapture`
- All frontend: `npm run test:run`
- One frontend test: `npx vitest run path/to/file.test.ts -t "name"`

---

## Task 1: ToolRegistry + reject unknown `tool_id` (Finding 1, critical)

**Files:**
- Create: `src-tauri/src/application/tool_registry.rs`
- Modify: `src-tauri/src/application/mod.rs` (add module)
- Modify: `src-tauri/src/state.rs` (hold registry)
- Modify: `src-tauri/src/domain/run.rs` (add payload type)
- Modify: `src-tauri/src/commands.rs` (new `run_tool_cmd` signature; populate registry)
- Modify: `src-tauri/src/application/run_tool.rs` (lookup by id; `unknown tool` error)
- Test: `src-tauri/src/application/tool_registry.rs` (`#[cfg(test)] mod tests`)

- [ ] **Step 1: Write failing test for registry get/replace**

Create `src-tauri/src/application/tool_registry.rs`:

```rust
use crate::domain::{Tool, ToolsConfig};
use std::collections::HashMap;
use std::sync::RwLock;

/// Single source of truth for the loaded tools.json. Paths are pre-resolved,
/// keychain allowlists are precomputed. The IPC layer never accepts a `Tool`
/// from the webview — it always reads through this registry.
pub struct ToolRegistry {
    inner: RwLock<Inner>,
}

struct Inner {
    tools: HashMap<String, Tool>,
    config: Option<ToolsConfig>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { inner: RwLock::new(Inner { tools: HashMap::new(), config: None }) }
    }

    pub fn replace(&self, config: ToolsConfig) {
        let mut tools = HashMap::new();
        for t in &config.tools {
            tools.insert(t.id.clone(), t.clone());
        }
        let mut g = self.inner.write().unwrap();
        g.tools = tools;
        g.config = Some(config);
    }

    pub fn get(&self, tool_id: &str) -> Option<Tool> {
        self.inner.read().unwrap().tools.get(tool_id).cloned()
    }

    pub fn defaults(&self) -> Option<crate::domain::Defaults> {
        self.inner.read().unwrap().config.as_ref().and_then(|c| c.defaults.clone())
    }
}

impl Default for ToolRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(json: &str) -> ToolsConfig {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn get_returns_loaded_tool() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[
            {"id":"a","name":"A","command":"/bin/echo"}
        ]}"#));
        assert_eq!(r.get("a").unwrap().name, "A");
    }

    #[test]
    fn get_returns_none_for_unknown() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[]}"#));
        assert!(r.get("nope").is_none());
    }

    #[test]
    fn replace_swaps_cleanly() {
        let r = ToolRegistry::new();
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{"id":"a","name":"A","command":"/x"}]}"#));
        r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{"id":"b","name":"B","command":"/x"}]}"#));
        assert!(r.get("a").is_none());
        assert!(r.get("b").is_some());
    }
}
```

Add module to `src-tauri/src/application/mod.rs`:

```rust
pub mod tool_registry;
```

- [ ] **Step 2: Run registry tests, verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml tool_registry`
Expected: 3 passed.

- [ ] **Step 3: Wire registry into `AppState`**

Replace `src-tauri/src/state.rs`:

```rust
use crate::application::tool_registry::ToolRegistry;
use crate::domain::RunId;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct RunHandle {
    pub cancel: Option<tokio::sync::oneshot::Sender<()>>,
}

pub struct AppState {
    pub running: Mutex<HashMap<RunId, RunHandle>>,
    pub registry: Arc<ToolRegistry>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(HashMap::new()),
            registry: Arc::new(ToolRegistry::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self { Self::new() }
}
```

- [ ] **Step 4: Add `RunRequestPayload` to domain**

Add to `src-tauri/src/domain/run.rs` (append; do not remove existing types):

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// IPC payload for `run_tool_cmd`. The Tool itself is NEVER sent from the
/// webview; the backend looks it up by id from the ToolRegistry.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequestPayload {
    pub tool_id: String,
    #[serde(default)]
    pub values: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub confirmed: bool,
}
```

If `domain/run.rs` already has its own `use serde` lines, merge — do not duplicate imports.

- [ ] **Step 5: Write failing test for `unknown tool` rejection**

Add to `src-tauri/src/application/run_tool.rs` (inside the `#[cfg(test)] mod tests` block; create the block if it doesn't exist):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::tool_registry::ToolRegistry;
    use std::sync::Arc;

    #[tokio::test]
    async fn rejects_unknown_tool_id() {
        let registry = Arc::new(ToolRegistry::new());
        let res = run_tool_with_registry(
            None,
            registry,
            "does-not-exist".to_string(),
            std::collections::HashMap::new(),
            false,
        ).await;
        assert!(res.is_err());
        let msg = format!("{:#}", res.unwrap_err());
        assert!(msg.contains("unknown tool"), "got: {msg}");
    }
}
```

This test calls a helper `run_tool_with_registry` that takes the registry directly (no `AppHandle` needed for this path — when the tool isn't found we return early before any spawn). We'll add the helper in step 6.

- [ ] **Step 6: Refactor `run_tool` to look up by id; add testable helper**

Replace the contents of `src-tauri/src/application/run_tool.rs` body, keeping the existing imports + constants intact, with:

```rust
use crate::application::{audit, path_resolver, tool_registry::ToolRegistry};
use crate::domain::*;
use crate::events::{ExitEvent, OutputEvent};
use crate::infrastructure::subprocess::{spawn, stream_lines};
use crate::state::{AppState, RunHandle};
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const DEFAULT_TIMEOUT_SECS: u64 = 300;

/// Public entry — looks the tool up in the registry attached to AppState.
pub async fn run_tool(
    app: AppHandle,
    tool_id: String,
    values: HashMap<String, serde_json::Value>,
    confirmed: bool,
) -> Result<RunId> {
    let registry = app.state::<AppState>().registry.clone();
    run_tool_with_registry(Some(app), registry, tool_id, values, confirmed).await
}

/// Test-friendly variant. `app` is None in unit tests where we only exercise the
/// pre-spawn validation (unknown tool, confirm rejection). Spawning paths still
/// require a live AppHandle and run via the public `run_tool` in integration tests.
pub async fn run_tool_with_registry(
    app: Option<AppHandle>,
    registry: Arc<ToolRegistry>,
    tool_id: String,
    values: HashMap<String, serde_json::Value>,
    confirmed: bool,
) -> Result<RunId> {
    let tool = registry.get(&tool_id).ok_or_else(|| anyhow!("unknown tool: {tool_id}"))?;
    if tool.confirm.unwrap_or(false) && !confirmed {
        return Err(anyhow!("confirmation required for tool: {tool_id}"));
    }

    let app = app.ok_or_else(|| anyhow!("no app handle"))?;
    let defaults = registry.defaults();
    let req = RunRequest { tool_id: tool_id.clone(), values };
    spawn_and_stream(app, tool, defaults, req).await
}

async fn spawn_and_stream(
    app: AppHandle,
    tool: Tool,
    defaults: Option<Defaults>,
    req: RunRequest,
) -> Result<RunId> {
    let run_id = Uuid::new_v4().to_string();
    let bin = path_resolver::resolve(&tool.command)?;
    let args = crate::application::arg_template::build_args(&tool, &req.values);
    let cwd = tool.cwd.as_ref()
        .or_else(|| defaults.as_ref().and_then(|d| d.cwd.as_ref()))
        .map(PathBuf::from);
    let process_env: HashMap<String, String> = std::env::vars().collect();
    let resolved_env = crate::application::env_resolver::resolve(
        &tool,
        defaults.as_ref(),
        cwd.as_deref(),
        &process_env,
        &crate::application::env_resolver::keychain_lookup,
    );
    let started = now();

    let redacted = audit::redact_args(&args, &tool.parameters, &req.values);
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
```

`audit::redact_args` does not yet exist — Task 4 creates it. For now, add a temporary no-op pass-through to keep compilation green. In `src-tauri/src/application/audit.rs`, add:

```rust
/// Temporary pass-through; replaced in Task 4 with real redaction.
pub fn redact_args(
    args: &[String],
    _parameters: &[crate::domain::tool::Parameter],
    _values: &std::collections::HashMap<String, serde_json::Value>,
) -> Vec<String> {
    args.to_vec()
}
```

- [ ] **Step 7: Run `run_tool` test, verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml run_tool::tests::rejects_unknown_tool_id`
Expected: 1 passed.

- [ ] **Step 8: Update `commands.rs` to new IPC signature**

Replace `src-tauri/src/commands.rs`:

```rust
use crate::application::load_config::{load_config_from_path, seed_default_if_missing};
use crate::domain::{RunRequestPayload, ToolsConfig};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub fn load_tools_config(app: tauri::AppHandle, path: String) -> Result<ToolsConfig, String> {
    let p = PathBuf::from(path);
    seed_default_if_missing(&p).map_err(|e| e.to_string())?;
    let cfg = load_config_from_path(&p).map_err(|e| e.to_string())?;
    app.state::<AppState>().registry.replace(cfg.clone());
    Ok(cfg)
}

#[tauri::command]
pub fn config_path() -> String {
    let home = dirs::home_dir().expect("home dir");
    home.join(".pier").join("tools.json").to_string_lossy().into()
}

#[tauri::command]
pub async fn run_tool_cmd(
    app: tauri::AppHandle,
    payload: RunRequestPayload,
) -> Result<String, String> {
    crate::application::run_tool::run_tool(app, payload.tool_id, payload.values, payload.confirmed)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_run_cmd(app: tauri::AppHandle, run_id: String) -> Result<(), String> {
    crate::application::run_tool::kill_run(app, run_id)
        .await
        .map_err(|e| e.to_string())
}
```

Make sure `RunRequestPayload` is re-exported from `src-tauri/src/domain/mod.rs` (add `pub use run::RunRequestPayload;` if necessary).

- [ ] **Step 9: Update frontend port + runner**

Replace the `CommandRunner` interface in `src/application/ports.ts`:

```ts
export interface CommandRunner {
  run(toolId: string, values: Record<string, unknown>, confirmed: boolean): Promise<RunOutcome>;
  kill(runId: string): Promise<void>;
  onOutput(cb: (runId: string, line: string, stream: Stream, transient: boolean) => void): () => void;
  onExit(cb: (runId: string, outcome: RunOutcome) => void): () => void;
}
```

Remove the now-unused `Tool, Defaults` imports from `ports.ts` if no other type in the file uses them.

Replace the `run` method body in `src/infrastructure/tauriCommandRunner.ts`:

```ts
async run(toolId, values, confirmed) {
  const runId = await invoke<string>("run_tool_cmd", {
    payload: { toolId, values, confirmed },
  });
  const startedAt = Math.floor(Date.now() / 1000);
  return {
    runId,
    status: "running" as const,
    exitCode: null,
    startedAt,
    endedAt: null,
    outputFiles: [],
  };
},
```

Update the call site in `src/ui/organisms/ToolRunner.tsx` `startRun`:

```tsx
const startRun = async (confirmed: boolean) => {
  const outcome = await runner.run(tool.id, values, confirmed);
  dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
};
```

And update the click + dialog handlers in the same file:

```tsx
const onRunClick = () => (tool.confirm === false ? startRun(false) : setConfirmOpen(true));
// ...
<ConfirmDialog
  open={confirmOpen}
  toolName={tool.name}
  command={tool.command}
  args={resolvedArgs}
  shell={tool.shell ?? false}
  onCancel={() => setConfirmOpen(false)}
  onConfirm={() => { setConfirmOpen(false); startRun(true); }}
/>
```

If any test fakes implement `CommandRunner` (search `src/state/__tests__` and `src/ui/organisms/__tests__`), update their `run` signature to match `(toolId, values, confirmed)`.

- [ ] **Step 10: Run full test suites**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

Run: `npm run test:run`
Expected: all pass. If a fake `CommandRunner` test broke, fix the fake to match the new signature — show me the diff before continuing.

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/application/tool_registry.rs \
        src-tauri/src/application/mod.rs \
        src-tauri/src/state.rs \
        src-tauri/src/domain/run.rs \
        src-tauri/src/domain/mod.rs \
        src-tauri/src/application/run_tool.rs \
        src-tauri/src/application/audit.rs \
        src-tauri/src/commands.rs \
        src/application/ports.ts \
        src/infrastructure/tauriCommandRunner.ts \
        src/ui/organisms/ToolRunner.tsx \
        src/state/__tests__ src/ui/organisms/__tests__
git commit -m "feat(security): server-side tool_id lookup and confirm gate

run_tool_cmd no longer accepts a Tool from IPC. Backend looks the tool
up in a new ToolRegistry attached to AppState. Confirm is enforced
server-side. Refs Finding 1 (CRITICAL) of the 2026-04-26 audit."
```

---

## Task 2: Refresh registry on config-file change

**Files:**
- Modify: `src-tauri/src/application/watch_config.rs`
- Modify: `src-tauri/src/application/load_config.rs` (no behavior change; ensure callable from watcher)

- [ ] **Step 1: Update watcher to repopulate registry**

Replace `src-tauri/src/application/watch_config.rs`:

```rust
use crate::application::load_config::load_config_from_path;
use crate::infrastructure::fs_watcher::watch_path;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

pub fn start(app: AppHandle) -> anyhow::Result<()> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("no home"))?;
    let config_path: PathBuf = home.join(".pier").join("tools.json");

    if let Some(parent) = config_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let app_clone = app.clone();
    let path_for_reload = config_path.clone();
    watch_path(&config_path, move || {
        // Refresh registry first so any subsequent run_tool_cmd sees fresh data,
        // then notify the frontend so it can re-render the tile list.
        if let Ok(cfg) = load_config_from_path(&path_for_reload) {
            app_clone.state::<AppState>().registry.replace(cfg);
        }
        let _ = app_clone.emit("pier://config-changed", ());
    })?;
    Ok(())
}
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: clean build.

- [ ] **Step 3: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/application/watch_config.rs
git commit -m "feat(security): refresh ToolRegistry from config watcher

Hot reload now updates the in-memory registry before notifying the
frontend, keeping registry as the single source of truth."
```

---

## Task 3: Keychain key allowlist (Finding 1c)

**Files:**
- Modify: `src-tauri/src/application/tool_registry.rs` (compute allowlist)
- Modify: `src-tauri/src/application/env_resolver.rs` (consume allowlist)
- Modify: `src-tauri/src/application/run_tool.rs` (pass allowlist into resolver)
- Test: same files

- [ ] **Step 1: Write failing test for allowlist computation**

Add to the `#[cfg(test)] mod tests` block in `src-tauri/src/application/tool_registry.rs`:

```rust
#[test]
fn keychain_allowlist_includes_only_referenced_keys() {
    let r = ToolRegistry::new();
    r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[{
      "id":"a","name":"A","command":"/x",
      "env":{"K1":"${keychain:openai}","K2":"plain","K3":"${keychain:github}"}
    }]}"#));
    let allow = r.keychain_keys_for("a");
    assert!(allow.contains("openai"));
    assert!(allow.contains("github"));
    assert_eq!(allow.len(), 2);
}

#[test]
fn keychain_allowlist_empty_for_tool_with_no_env() {
    let r = ToolRegistry::new();
    r.replace(cfg(r#"{"schemaVersion":"1.0","tools":[
        {"id":"a","name":"A","command":"/x"}
    ]}"#));
    assert!(r.keychain_keys_for("a").is_empty());
}
```

- [ ] **Step 2: Add `keychain_keys_for` and storage**

In `src-tauri/src/application/tool_registry.rs`, change `Inner` to also hold per-tool allowlists, populated in `replace`:

```rust
use std::collections::{HashMap, HashSet};

struct Inner {
    tools: HashMap<String, Tool>,
    keychain_keys: HashMap<String, HashSet<String>>,
    config: Option<ToolsConfig>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { inner: RwLock::new(Inner {
            tools: HashMap::new(),
            keychain_keys: HashMap::new(),
            config: None,
        }) }
    }

    pub fn replace(&self, config: ToolsConfig) {
        let mut tools = HashMap::new();
        let mut keychain_keys: HashMap<String, HashSet<String>> = HashMap::new();
        for t in &config.tools {
            tools.insert(t.id.clone(), t.clone());
            let mut set = HashSet::new();
            for raw in t.env.values() {
                if let Some(rest) = raw.strip_prefix("${keychain:").and_then(|s| s.strip_suffix('}')) {
                    set.insert(rest.to_string());
                }
            }
            // Defaults env keys also allowed for every tool (defaults are global)
            if let Some(d) = &config.defaults {
                for raw in d.env.values() {
                    if let Some(rest) = raw.strip_prefix("${keychain:").and_then(|s| s.strip_suffix('}')) {
                        set.insert(rest.to_string());
                    }
                }
            }
            keychain_keys.insert(t.id.clone(), set);
        }
        let mut g = self.inner.write().unwrap();
        g.tools = tools;
        g.keychain_keys = keychain_keys;
        g.config = Some(config);
    }

    pub fn keychain_keys_for(&self, tool_id: &str) -> HashSet<String> {
        self.inner.read().unwrap().keychain_keys.get(tool_id).cloned().unwrap_or_default()
    }

    // existing get / defaults unchanged
}
```

- [ ] **Step 3: Run registry tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml tool_registry`
Expected: all pass (5 total now).

- [ ] **Step 4: Write failing test in env_resolver for allowlist enforcement**

Add to `src-tauri/src/application/env_resolver.rs` (inside `mod tests`):

```rust
#[test]
fn keychain_lookup_blocked_when_key_not_in_allowlist() {
    let json = r#"{"id":"x","name":"X","command":"/x","env":{"K":"${keychain:secret}"}}"#;
    let tool: Tool = serde_json::from_str(json).unwrap();
    let kc = |_: &str| Some("would-be-leaked".to_string()); // pretend keychain has it
    let allow: std::collections::HashSet<String> = std::collections::HashSet::new(); // empty
    let r = resolve_with_allowlist(&tool, None, None, &HashMap::new(), &kc, &allow);
    assert!(!r.vars.contains_key("K"), "blocked key must not appear in env");
}

#[test]
fn keychain_lookup_allowed_when_key_in_allowlist() {
    let json = r#"{"id":"x","name":"X","command":"/x","env":{"K":"${keychain:secret}"}}"#;
    let tool: Tool = serde_json::from_str(json).unwrap();
    let kc = |k: &str| if k == "secret" { Some("v".to_string()) } else { None };
    let mut allow = std::collections::HashSet::new();
    allow.insert("secret".to_string());
    let r = resolve_with_allowlist(&tool, None, None, &HashMap::new(), &kc, &allow);
    assert_eq!(r.vars.get("K").map(String::as_str), Some("v"));
}
```

- [ ] **Step 5: Implement `resolve_with_allowlist`**

In `src-tauri/src/application/env_resolver.rs`, add the new entry point and have the existing `resolve` delegate to it with an "allow all" set for backwards compat in tests:

```rust
use std::collections::HashSet;

pub fn resolve(
    tool: &Tool,
    defaults: Option<&Defaults>,
    cwd: Option<&Path>,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
) -> ResolvedEnv {
    // Default: allow all (used only by older callers; production goes via run_tool)
    resolve_with_allowlist(tool, defaults, cwd, process_env, keychain_lookup, &AllowAll)
}

trait KeychainAllow {
    fn permits(&self, key: &str) -> bool;
}
struct AllowAll;
impl KeychainAllow for AllowAll {
    fn permits(&self, _: &str) -> bool { true }
}
impl KeychainAllow for HashSet<String> {
    fn permits(&self, key: &str) -> bool { self.contains(key) }
}

pub fn resolve_with_allowlist(
    tool: &Tool,
    defaults: Option<&Defaults>,
    cwd: Option<&Path>,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
) -> ResolvedEnv {
    // Existing resolve body — but `interpolate` now consults `allow` for keychain refs.
    // ... (move existing body here) ...
}

fn interpolate(
    raw: &str,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
) -> Option<(String, EnvSource)> {
    if let Some(rest) = raw.strip_prefix("${keychain:").and_then(|s| s.strip_suffix('}')) {
        if !allow.permits(rest) { return None; }
        return keychain_lookup(rest).map(|v| (v, EnvSource::Keychain));
    }
    if let Some(rest) = raw.strip_prefix("${env:").and_then(|s| s.strip_suffix('}')) {
        return process_env.get(rest).cloned().map(|v| (v, EnvSource::HostEnv));
    }
    Some((raw.to_string(), EnvSource::EnvBlock))
}
```

Update `apply_env_block` to pass `allow` through to `interpolate`. Move the existing resolve body's logic verbatim into `resolve_with_allowlist`, replacing the bare `interpolate(...)` calls with `interpolate(..., allow)`.

- [ ] **Step 6: Run env_resolver tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml env_resolver`
Expected: all pass (existing 7 + 2 new).

- [ ] **Step 7: Wire allowlist into `spawn_and_stream`**

In `src-tauri/src/application/run_tool.rs`, replace the `resolve(...)` call inside `spawn_and_stream` with:

```rust
let registry = app.state::<AppState>().registry.clone();
let allow = registry.keychain_keys_for(&tool.id);
let resolved_env = crate::application::env_resolver::resolve_with_allowlist(
    &tool,
    defaults.as_ref(),
    cwd.as_deref(),
    &process_env,
    &crate::application::env_resolver::keychain_lookup,
    &allow,
);
```

- [ ] **Step 8: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/application/tool_registry.rs \
        src-tauri/src/application/env_resolver.rs \
        src-tauri/src/application/run_tool.rs
git commit -m "feat(security): keychain key allowlist per tool

Each tool can only resolve \${keychain:X} for keys it (or defaults)
references in its env block, computed once at config load. Closes the
keychain enumeration vector."
```

---

## Task 4: `secret: true` parameter + audit redaction (Finding 2)

**Files:**
- Modify: `src-tauri/src/domain/tool.rs` (`secret: Option<bool>` on `ParameterBase`)
- Modify: `src-tauri/src/application/audit.rs` (real `redact_args`)
- Modify: `src/domain/tool.ts` (mirror)
- Create: `src/ui/atoms/SecretField.tsx`
- Modify: `src/ui/molecules/ParamField.tsx` (route `secret: true` to `SecretField`)
- Test: `src-tauri/src/application/audit.rs`, `src/ui/atoms/__tests__/SecretField.test.tsx`

- [ ] **Step 1: Add `secret` field to backend domain**

In `src-tauri/src/domain/tool.rs`, add to `ParameterBase`:

```rust
#[serde(default, skip_serializing_if = "Option::is_none")] pub secret: Option<bool>,
```

And add an accessor on `Parameter`:

```rust
pub fn is_secret(&self) -> bool { self.base().secret.unwrap_or(false) }
```

- [ ] **Step 2: Write failing test for `redact_args`**

Replace the temporary `redact_args` test block in `src-tauri/src/application/audit.rs` (or add a fresh `#[test]` if absent):

```rust
#[test]
fn redact_args_replaces_secret_param_values() {
    use crate::domain::tool::Parameter;
    use serde_json::json;
    let params: Vec<Parameter> = serde_json::from_str(r#"[
        {"id":"token","label":"T","type":"text","secret":true},
        {"id":"name","label":"N","type":"text"}
    ]"#).unwrap();
    let mut values = std::collections::HashMap::new();
    values.insert("token".to_string(), json!("ghp_abc123"));
    values.insert("name".to_string(), json!("hello"));

    let args = vec!["--token".into(), "ghp_abc123".into(), "--name".into(), "hello".into()];
    let out = super::redact_args(&args, &params, &values);
    assert_eq!(out, vec!["--token", "[REDACTED]", "--name", "hello"]);
}

#[test]
fn redact_args_does_not_redact_non_secret_match() {
    use crate::domain::tool::Parameter;
    use serde_json::json;
    let params: Vec<Parameter> = serde_json::from_str(r#"[
        {"id":"name","label":"N","type":"text"}
    ]"#).unwrap();
    let mut values = std::collections::HashMap::new();
    values.insert("name".to_string(), json!("hello"));
    let args = vec!["hello".into()];
    let out = super::redact_args(&args, &params, &values);
    assert_eq!(out, vec!["hello"]);
}
```

- [ ] **Step 3: Implement real `redact_args`**

Replace the temporary pass-through in `src-tauri/src/application/audit.rs` with:

```rust
use crate::domain::tool::Parameter;
use serde_json::Value;
use std::collections::HashMap;

pub fn redact_args(
    args: &[String],
    parameters: &[Parameter],
    values: &HashMap<String, Value>,
) -> Vec<String> {
    let mut secret_strings: Vec<String> = Vec::new();
    for p in parameters {
        if p.is_secret() {
            if let Some(v) = values.get(p.id()) {
                let s = match v {
                    Value::String(s) => s.clone(),
                    Value::Null => String::new(),
                    other => other.to_string(),
                };
                if !s.is_empty() {
                    secret_strings.push(s);
                }
            }
        }
    }
    args.iter()
        .map(|a| if secret_strings.iter().any(|s| s == a) { "[REDACTED]".to_string() } else { a.clone() })
        .collect()
}
```

- [ ] **Step 4: Run audit tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml audit`
Expected: all pass (existing + 2 new).

- [ ] **Step 5: Mirror `secret` to frontend domain**

In `src/domain/tool.ts`, add to `ParameterBase`:

```ts
secret?: boolean;
```

- [ ] **Step 6: Write failing test for `SecretField`**

Create `src/ui/atoms/__tests__/SecretField.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecretField } from "../SecretField";

describe("SecretField", () => {
  it("renders a password input by default", () => {
    render(<SecretField id="t" label="Token" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Token") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to text when reveal pressed, back to password on second press", () => {
    render(<SecretField id="t" label="Token" value="abc" onChange={() => {}} />);
    const input = screen.getByLabelText("Token") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /show|reveal/i });
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    fireEvent.click(toggle);
    expect(input.type).toBe("password");
  });
});
```

- [ ] **Step 7: Implement `SecretField`**

Create `src/ui/atoms/SecretField.tsx`:

```tsx
import { useState } from "react";
import { TextField } from "./TextField";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SecretField({ id, label, value, onChange, placeholder }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <TextField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={revealed ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setRevealed(r => !r)}
        aria-label={revealed ? "Hide" : "Show"}
        className="absolute right-3 top-9 text-[12px] text-ink-3 hover:text-ink-2 transition-colors"
      >
        {revealed ? "Hide" : "Show"}
      </button>
    </div>
  );
}
```

If `TextField` does not currently accept a `type` prop, extend its `Props` to include `type?: "text" | "password"` and forward it to the underlying `<input>`. Keep its `BASE`/`VARIANTS` strings untouched per the styling convention in `CLAUDE.md`.

- [ ] **Step 8: Run SecretField tests**

Run: `npx vitest run src/ui/atoms/__tests__/SecretField.test.tsx`
Expected: 2 passed.

- [ ] **Step 9: Route `ParamField` to `SecretField` for secret text params**

In `src/ui/molecules/ParamField.tsx`, where the `text` param renders, branch:

```tsx
if (param.type === "text" && param.secret) {
  return (
    <SecretField
      id={param.id}
      label={param.label}
      value={String(value ?? "")}
      onChange={onChange as (v: string) => void}
    />
  );
}
```

Add `import { SecretField } from "../atoms/SecretField";` to the top of the file.

- [ ] **Step 10: Run all frontend tests**

Run: `npm run test:run`
Expected: all pass.

- [ ] **Step 11: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src-tauri/src/domain/tool.rs \
        src-tauri/src/application/audit.rs \
        src/domain/tool.ts \
        src/ui/atoms/SecretField.tsx \
        src/ui/atoms/__tests__/SecretField.test.tsx \
        src/ui/atoms/TextField.tsx \
        src/ui/molecules/ParamField.tsx
git commit -m "feat(security): redact secret param values in audit log

Adds parameters[].secret to the schema. Backend redacts matching arg
values to '[REDACTED]' before writing the audit JSONL. Frontend renders
secret text params via a new SecretField atom with reveal toggle."
```

---

## Task 5: Pin command paths at config load; drop home-dir search (Finding 3)

**Files:**
- Modify: `src-tauri/src/application/path_resolver.rs` (search list)
- Modify: `src-tauri/src/application/tool_registry.rs` (resolve & pin on `replace`)

- [ ] **Step 1: Write failing test that home-dir search is gone**

In `src-tauri/src/application/path_resolver.rs` `mod tests`, add:

```rust
#[test]
fn does_not_search_home_dirs() {
    // We can't manipulate $HOME safely in tests, but we can assert the SEARCH
    // constant is the system-only set.
    assert_eq!(
        super::SEARCH,
        &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
    );
}
```

- [ ] **Step 2: Drop home-dir candidates**

Replace the `resolve` function in `src-tauri/src/application/path_resolver.rs`:

```rust
use anyhow::{anyhow, Result};
use std::path::PathBuf;

pub const SEARCH: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
];

pub fn resolve(command: &str) -> Result<PathBuf> {
    if command.contains('/') {
        let p = PathBuf::from(command);
        if p.exists() { return Ok(p); }
        return Err(anyhow!("not found: {}", command));
    }
    for c in SEARCH {
        let p = PathBuf::from(c).join(command);
        if p.exists() { return Ok(p); }
    }
    Err(anyhow!("binary {} not found in known paths", command))
}
```

- [ ] **Step 3: Pin in registry on `replace`**

In `src-tauri/src/application/tool_registry.rs`, modify `replace` to attempt resolution and rewrite `tool.command` to the absolute path when found. Tools that fail to resolve are still loaded (we don't want a single bad entry to brick the registry), but their `command` is left as-is so `path_resolver::resolve` will surface the same error at run-time:

```rust
for t in &config.tools {
    let mut t = t.clone();
    if !t.command.contains('/') {
        if let Ok(abs) = crate::application::path_resolver::resolve(&t.command) {
            t.command = abs.to_string_lossy().into();
        }
    }
    // ... existing keychain_keys logic, using `t` ...
    tools.insert(t.id.clone(), t);
}
```

- [ ] **Step 4: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/application/path_resolver.rs \
        src-tauri/src/application/tool_registry.rs
git commit -m "feat(security): pin command paths at load, drop home-dir search

Bare command names resolve once at config load. Removes ~/.local/bin,
~/.cargo/bin, ~/.bun/bin from the search list to stop user-writable
binaries from shadowing system ones."
```

---

## Task 6: Clean-env default + `${env:X}` opt-in (Finding 4)

**Files:**
- Modify: `src-tauri/src/application/env_resolver.rs` (`baseline_env`)
- Modify: `src-tauri/src/application/run_tool.rs` (use `baseline_env` instead of full `std::env::vars`)

- [ ] **Step 1: Write failing test for baseline filter**

Add to `src-tauri/src/application/env_resolver.rs` `mod tests`:

```rust
#[test]
fn baseline_env_keeps_only_allowlisted_keys() {
    let mut full = HashMap::new();
    full.insert("PATH".into(), "/usr/bin".into());
    full.insert("HOME".into(), "/Users/me".into());
    full.insert("OPENAI_API_KEY".into(), "sk-leak".into());
    full.insert("AWS_SECRET_ACCESS_KEY".into(), "should-not-leak".into());
    full.insert("LANG".into(), "en_US.UTF-8".into());
    full.insert("TMPDIR".into(), "/tmp".into());

    let base = super::baseline_env(&full);
    assert_eq!(base.get("PATH").map(String::as_str), Some("/usr/bin"));
    assert_eq!(base.get("HOME").map(String::as_str), Some("/Users/me"));
    assert_eq!(base.get("LANG").map(String::as_str), Some("en_US.UTF-8"));
    assert_eq!(base.get("TMPDIR").map(String::as_str), Some("/tmp"));
    assert!(base.get("OPENAI_API_KEY").is_none());
    assert!(base.get("AWS_SECRET_ACCESS_KEY").is_none());
}
```

- [ ] **Step 2: Implement `baseline_env`**

Add to `src-tauri/src/application/env_resolver.rs`:

```rust
const BASELINE_KEYS: &[&str] = &["PATH", "HOME", "USER", "LANG", "TERM", "TMPDIR", "SHELL"];

pub fn baseline_env(full: &HashMap<String, String>) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for k in BASELINE_KEYS {
        if let Some(v) = full.get(*k) {
            out.insert((*k).to_string(), v.clone());
        }
    }
    // Pass through any LC_* locale var (LC_ALL, LC_CTYPE, ...) — needed for
    // tools that emit non-ASCII output correctly.
    for (k, v) in full {
        if k.starts_with("LC_") {
            out.insert(k.clone(), v.clone());
        }
    }
    out
}
```

- [ ] **Step 3: Run env_resolver test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml env_resolver::tests::baseline_env_keeps_only_allowlisted_keys`
Expected: 1 passed.

- [ ] **Step 4: Use `baseline_env` in `spawn_and_stream`**

In `src-tauri/src/application/run_tool.rs`, replace the `process_env` initialization in `spawn_and_stream`:

```rust
let full_env: HashMap<String, String> = std::env::vars().collect();
let process_env = crate::application::env_resolver::baseline_env(&full_env);
```

The interpolation flow already supports `${env:FOO}`, so tools that need extra inheritance can opt in by adding `"env": { "FOO": "${env:FOO}" }` to their tool definition. **However**, `${env:FOO}` resolves against the same `process_env` we pass in — so callers must pass `full_env` (not the baselined one) to the resolver for `${env:FOO}` lookups to find the originals.

Update the resolver call:

```rust
let resolved_env = crate::application::env_resolver::resolve_with_allowlist(
    &tool,
    defaults.as_ref(),
    cwd.as_deref(),
    &full_env,        // for ${env:X} lookups
    &crate::application::env_resolver::keychain_lookup,
    &allow,
);
```

But `resolve_with_allowlist` builds the final env starting from its `process_env` arg (Layer 1). We don't want full_env in Layer 1. Either:

(a) Add a new `seed_env: &HashMap<String,String>` arg to `resolve_with_allowlist` to separate Layer 1 from `${env:X}` lookups; or
(b) Change Layer 1 in `resolve_with_allowlist` to take its seed from a dedicated arg.

Pick (a). Add a seed arg:

```rust
pub fn resolve_with_allowlist(
    tool: &Tool,
    defaults: Option<&Defaults>,
    cwd: Option<&Path>,
    seed_env: &HashMap<String, String>,
    interp_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
) -> ResolvedEnv {
    // Layer 1: seed_env (was process_env)
    // Layers 2-5: unchanged, but `interpolate` looks up ${env:X} in interp_env
}
```

Update `apply_env_block` and `interpolate` to take `interp_env` instead of `process_env` for `${env:X}` lookups.

The legacy `resolve` wrapper passes the same map for both args (preserving old behavior for tests).

- [ ] **Step 5: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/application/env_resolver.rs \
        src-tauri/src/application/run_tool.rs
git commit -m "feat(security): clean-env default for spawned tools

Spawned tools inherit only PATH/HOME/USER/LANG/LC_*/TERM/TMPDIR/SHELL.
Tools opt into anything else via env: { FOO: \${env:FOO} }. Stops a
malicious or curious tool from dumping the launcher's full env."
```

---

## Task 7: Production CSP overlay (Finding 5)

**Files:**
- Modify: `src-tauri/tauri.conf.json` (production CSP — drop dev origins)
- Create: `src-tauri/tauri.conf.dev.json` (dev overlay with localhost)

- [ ] **Step 1: Tighten production CSP**

In `src-tauri/tauri.conf.json`, replace the `app.security.csp` value with:

```
"csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost; img-src 'self' data: asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'"
```

(Removed `ws://localhost:1420 http://localhost:1420`.)

- [ ] **Step 2: Add dev overlay**

Create `src-tauri/tauri.conf.dev.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420 http://localhost:1420; img-src 'self' data: asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'"
    }
  }
}
```

Wire the overlay into the dev script. In `package.json`, change the `tauri dev` invocation pattern. If `scripts.tauri` is `"tauri"`, run dev as `npm run tauri dev -- --config src-tauri/tauri.conf.dev.json`. If you don't want every contributor to remember the flag, add a script:

```json
"scripts": {
  "tauri:dev": "tauri dev --config src-tauri/tauri.conf.dev.json"
}
```

Update `CLAUDE.md` to reference `npm run tauri:dev` instead of `npm run tauri dev`.

- [ ] **Step 3: Sanity check — start dev, then build**

Run: `npm run tauri:dev` — confirm the app loads, no CSP errors in devtools console. Stop with Ctrl-C.
Run: `npm run build` — confirm typecheck + bundle succeed.

(Skip `npm run tauri build` here — full notarization is out of scope for this plan.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/tauri.conf.dev.json package.json CLAUDE.md
git commit -m "feat(security): split prod/dev CSP

Production CSP no longer trusts localhost:1420 origins. Dev overlay at
tauri.conf.dev.json keeps Vite HMR working. Run dev via npm run tauri:dev."
```

---

## Final verification

- [ ] **Run full Rust suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all pass.

- [ ] **Run full frontend suite**

Run: `npm run test:run`
Expected: all pass.

- [ ] **Run clippy**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
Expected: no warnings.

- [ ] **Manual smoke test**

Run: `npm run tauri:dev`
Try: the seeded `hello` and `file-info` tools — both should run.
Try: edit `~/.pier/tools.json`, change a tool name, save — UI updates without restart.
Try: add a tool with `"confirm": true`, click Run, verify the confirm dialog gates execution.
Try: add a tool with `parameters: [{ id: "tok", "label":"T", "type":"text", "secret": true }]`, run with a value, then `tail ~/.pier/audit.log` — value must show as `[REDACTED]`.

- [ ] **Done. The branch is ready for PR.**

---

## Self-review notes

- **Spec coverage:** all 5 findings + the 7 spec subsections (registry, tool_id lookup, server-side confirm, keychain allowlist, audit redaction, path pinning, clean env, prod CSP) are mapped to tasks 1–7.
- **Placeholder scan:** none — every code-emitting step has full code or a precise edit instruction.
- **Type consistency:** `RunRequestPayload { tool_id, values, confirmed }` is used identically in `domain/run.rs`, `commands.rs`, `tauriCommandRunner.ts` (as `{toolId, values, confirmed}` after camelCase serde), and `ToolRunner.tsx`. `redact_args(args, parameters, values)` signature is the same in audit.rs and run_tool.rs callers. `keychain_keys_for(tool_id) -> HashSet<String>` matches between `tool_registry.rs` and `run_tool.rs`. `resolve_with_allowlist` final signature in Task 6 supersedes the Task 3 version — Task 6 explicitly notes the seed/interp split.
