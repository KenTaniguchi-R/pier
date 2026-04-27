# Pier — IPC Hardening + Light Refactor

**Date:** 2026-04-26
**Status:** Approved for implementation planning
**Scope:** Backend IPC surface, audit logging, env handling, command resolution, build CSP. Minimal frontend touch.

## Background

A security review (see `/cso` output, 2026-04-26) surfaced five findings. The critical one: `run_tool_cmd` accepts an attacker-supplied `Tool` over IPC, so any future XSS or supply-chain pinhole in the webview escalates to RCE plus Keychain dump. The other four are smaller but compound the blast radius.

Rather than bolt fixes onto the current shape, we use the touch-points to enforce the clean-architecture boundaries that already exist. No new layers, no UI redesign. Atomic design preserved.

## Findings addressed

| # | Sev | Finding |
|---|-----|---------|
| 1 | CRIT | Backend trusts arbitrary `Tool` from IPC; `confirm` is frontend-only; `${keychain:*}` becomes a Keychain read primitive |
| 2 | HIGH | Tool args (incl. user-typed secrets) logged plaintext to `~/.pier/audit.log` |
| 3 | MED  | Bare command names resolve through user-writable `~/.local/bin`, `~/.cargo/bin`, `~/.bun/bin` |
| 4 | MED  | Full parent-process env forwarded to every spawned tool by default |
| 5 | LOW  | Dev-server origins shipped in production CSP |

## Architecture changes

### Backend (`src-tauri/src/`)

#### Domain (`domain/`) — additive only

- `domain/tool.rs`: add `secret: Option<bool>` to `ParameterBase`. Default `false`. Used by audit redaction and the frontend `SecretField`.
- `domain/run.rs`: introduce `RunRequestPayload { tool_id: String, values: HashMap<String, Value>, confirmed: bool }`. The IPC payload type. The existing `RunRequest` (internal) stays for the value map.

#### Application (`application/`) — the real work

- **New `application/tool_registry.rs`:**
  - Owns the in-memory `ToolsConfig` (loaded + path-resolved + keychain-allowlist-computed).
  - API: `get(tool_id) -> Option<Tool>`, `replace(config: ToolsConfig)`, `keychain_keys_for(tool_id) -> HashSet<String>`.
  - Stored on `AppState` via `Arc<RwLock<...>>`.
  - Populated by `load_tools_config` and refreshed by the file watcher.

- **`application/run_tool.rs`:**
  - Signature: `run_tool(app, tool_id, values, confirmed)`. Looks up the `Tool` via the registry. **Returns error `unknown tool` if the id isn't loaded — no execution.**
  - Server-side `confirm` enforcement: if `tool.confirm == true && !confirmed`, return `confirmation required`. The frontend dialog is now UX, not security.
  - Builds env using `baseline_env()` (see env_resolver below) instead of `std::env::vars()`.

- **`application/env_resolver.rs`:**
  - New `baseline_env() -> HashMap<String,String>`: returns only `{PATH, HOME, USER, LANG, LC_*, TERM, TMPDIR, SHELL}` from the process env. Tools opt into anything else via `${env:FOO}` (already supported).
  - `resolve()` takes the registry's precomputed `keychain_allowlist: &HashSet<String>` and rejects `${keychain:X}` where `X` is not in the allowlist. Allowlist is the union of every literal `X` referenced in the tool's own `env` block, computed once at config load.

- **`application/audit.rs`:**
  - New `redact_args(args: &[String], parameters: &[Parameter], values: &HashMap<String,Value>) -> Vec<String>`: replaces stringified values that came from a `secret: true` parameter with `"[REDACTED]"`. Compares by exact string equality against the raw param value.
  - `Entry::start_with_env` becomes `Entry::start_with_env(run_id, tool_id, bin, redacted_args, env_keys, ts)`. Caller passes already-redacted args.

- **`application/path_resolver.rs`:**
  - Resolve bare command names **once at config-load time** in `tool_registry::replace`. Store the absolute path on the in-memory `Tool`.
  - Drop home-dir candidates (`~/.local/bin`, `~/.cargo/bin`, `~/.bun/bin`). Keep `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`.
  - Document pinning in `tools-schema.md` (Obsidian vault).

- **`application/watch_config.rs`:**
  - On file change: reload + path-resolve + repopulate registry, then emit `pier://config-changed`. The frontend reload of `tools.json` becomes a render-state refresh, not a re-execution authority.

#### Infrastructure (`infrastructure/`) — untouched.

#### Commands (`commands.rs`) — thinner

- `run_tool_cmd(app, tool_id: String, values: HashMap<String,Value>, confirmed: bool) -> Result<RunId>`. **No `Tool` or `Defaults` accepted from IPC.**
- `load_tools_config(path)` — also populates the registry on success.
- `kill_run_cmd` unchanged.

#### Build config (`tauri.conf.json`)

- Split CSP via a `tauri.conf.dev.json` overlay (Tauri 2 supports this). Production CSP drops `http://localhost:1420 ws://localhost:1420` from `connect-src`.

### Frontend (`src/`)

Atomic design preserved. Minimal change.

- `application/ports.ts`: `CommandRunner.run(toolId, values, confirmed)` signature. No `Tool` object.
- `infrastructure/tauriCommandRunner.ts`: invoke with `{ tool_id, values, confirmed }`.
- `state/RunnerContext`: same shape, internal signature updated.
- `domain/tool.ts`: mirror `secret?: boolean` on parameter base.
- `ui/atoms/SecretField.tsx`: **one new atom.** Renders a `Text` parameter as a password input with reveal toggle. Reuses `TextField`'s `BASE` + `VARIANTS` per the styling convention.
- `ui/organisms/RunForm` (or wherever Run lives): when `tool.confirm == true`, show the existing dialog, then call runner with `confirmed: true`. Otherwise `confirmed: false`.

### Schema (`tools.json`) — additive

```jsonc
{
  "id": "deploy",
  "command": "deploy.sh",
  "confirm": true,                       // already existed; now enforced server-side
  "parameters": [
    { "id": "token", "label": "API token", "type": "text", "secret": true }
  ]
}
```

Old configs keep working. No migration needed.

## What stays the same

- Layering (`domain → application → infrastructure → commands/UI`).
- `subprocess.rs`, `fs_watcher.rs`, audit JSONL format (additive only).
- All existing components, atoms, tokens, Tailwind v4 setup.
- Tray, window, Keychain shell-out via `security`.

## Why this is not a bigger refactor

The architecture is sound. The bug isn't structural — it's a missing authorization check at one IPC boundary. Every finding maps to a single file already in the right layer. The only new module (`tool_registry`) formalizes state that already exists implicitly (the file watcher already implies a single source of truth for tools).

## Testing

### Rust

- `application/tool_registry`: load → get returns the tool; unknown id returns `None`; replace swaps cleanly.
- `application/run_tool`:
  - Rejects unknown `tool_id` with `unknown tool`.
  - Rejects `confirm: true` tool when `confirmed == false`.
  - Spawns successfully for `confirm: true` tool when `confirmed == true`.
  - Spawned env contains baseline keys only unless `${env:FOO}` opts in.
- `application/audit`: `redact_args` replaces secret-typed values, leaves others untouched, handles repeated values correctly.
- `application/env_resolver`: `${keychain:X}` rejected when `X` not in allowlist; baseline env contains expected keys only.
- `application/path_resolver`: bare names resolve only against system dirs; home dirs ignored.

### Frontend

- `tauriCommandRunner` test: invokes with `{tool_id, values, confirmed}`.
- `RunForm` test: confirm-required tool shows dialog; only after accept does it call `runner.run(..., confirmed: true)`.
- `SecretField` test: input type is `password` by default; reveal toggle flips to `text`.

## Build order

Each step independently shippable and testable.

1. **Finding 1a (critical):** `tool_registry` + `run_tool_cmd` signature change + reject-unknown-id test.
2. **Finding 1b:** Backend `confirm` enforcement + frontend wiring.
3. **Finding 1c:** Keychain key allowlist.
4. **Finding 2:** `secret: true` parameter + audit redaction + `SecretField` atom.
5. **Finding 3:** Path resolver pinning at load time, drop home dirs.
6. **Finding 4:** Clean-env default + `${env:X}` opt-in.
7. **Finding 5:** Prod CSP overlay.

## Out of scope

- Sandboxing the subprocess (seatbelt, AppContainer). Future hardening.
- Encrypted audit log. Future hardening.
- Per-tool resource limits / DoS mitigations. Excluded by review FP rules.
- Notarization / signing flow. Separate workstream.
- UI redesign. Atomic design preserved.

## Surface summary

- Backend: ~6 files modified, 1 new module (`tool_registry.rs`).
- Frontend: ~4 files modified, 1 new atom (`SecretField.tsx`).
- Config: 1 new build overlay (`tauri.conf.dev.json`).
- Schema: 2 additive fields (`parameters[].secret`, `confirm` now enforced).
