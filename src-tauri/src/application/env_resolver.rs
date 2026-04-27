use crate::domain::{Defaults, Tool};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Static env keys that spawned tools inherit from Pier's process by default.
/// Anything else (API keys, AWS creds, etc.) must be opted into via `${env:X}`
/// in the tool's `env` block.
///
/// This is the *static* portion of the baseline only. `LC_*` locale keys are
/// added dynamically inside `baseline_env` (because their names vary —
/// `LC_ALL`, `LC_CTYPE`, `LC_NUMERIC`, etc.). Always go through `baseline_env`
/// to get the full baseline; never iterate this constant directly outside that
/// function.
// LC_* keys are added dynamically below — don't bypass baseline_env()
pub const BASELINE_STATIC_KEYS: &[&str] =
    &["PATH", "HOME", "USER", "LANG", "TERM", "TMPDIR", "SHELL"];

/// Filter `full` down to BASELINE_STATIC_KEYS plus any `LC_*` locale keys. Used
/// to build the seed env passed to spawned tools, while interpolation still
/// sees the full process env.
pub fn baseline_env(full: &HashMap<String, String>) -> HashMap<String, String> {
    let mut out: HashMap<String, String> = HashMap::new();
    for k in BASELINE_STATIC_KEYS {
        if let Some(v) = full.get(*k) {
            out.insert((*k).to_string(), v.clone());
        }
    }
    for (k, v) in full {
        if k.starts_with("LC_") && !out.contains_key(k) {
            out.insert(k.clone(), v.clone());
        }
    }
    out
}

/// Gate over which `${keychain:X}` keys a tool may resolve. Computed at config
/// load (`ToolRegistry::keychain_keys_for`) and consulted before every keychain
/// lookup so a malicious tool definition can't enumerate other tools' secrets.
pub trait KeychainAllow {
    fn permits(&self, key: &str) -> bool;
}

/// Permissive allow used by tests / legacy callers that want the previous
/// "anything goes" behavior of `resolve()`.
pub(crate) struct AllowAll;
impl KeychainAllow for AllowAll {
    fn permits(&self, _: &str) -> bool {
        true
    }
}

impl KeychainAllow for HashSet<String> {
    fn permits(&self, key: &str) -> bool {
        self.contains(key)
    }
}

/// Where a resolved env var came from. Used by the audit log to redact safely.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EnvSource {
    /// Inherited from Pier's own process env.
    Process,
    /// Loaded from the user's envFile (path recorded for the audit log).
    EnvFile,
    /// Set by the inline `env` block with no interpolation.
    EnvBlock,
    /// Resolved via `${keychain:X}` from the macOS Keychain.
    Keychain,
    /// Resolved via `${env:X}` from the host process env.
    HostEnv,
}

pub struct ResolvedEnv {
    pub vars: HashMap<String, String>,
    pub keys: HashMap<String, EnvSource>,
}

/// Resolve a tool's effective environment by merging, in order:
///   1. process env (always)
///   2. defaults.envFile (if present)
///   3. tool.envFile (if present, overrides defaults)
///   4. defaults.env (interpolated)
///   5. tool.env (interpolated, overrides defaults)
///
/// `cwd` is the resolved working directory (tool.cwd ?? defaults.cwd ?? None);
/// envFile paths are resolved relative to `cwd` if present, else relative to the
/// current process directory.
///
/// `keychain_lookup` is injected so tests don't shell out. In production it shells
/// out to `security find-generic-password -s pier -a <key> -w`.
pub fn resolve(
    tool: &Tool,
    defaults: Option<&Defaults>,
    cwd: Option<&Path>,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
) -> ResolvedEnv {
    // Default: allow all (used only by tests / older call sites; production
    // goes through `run_tool` which always passes a per-tool allowlist).
    resolve_with_allowlist(
        tool,
        defaults,
        cwd,
        process_env,
        process_env,
        keychain_lookup,
        &AllowAll,
    )
}

/// Like `resolve`, but takes a separate `seed_env` (Layer 1, the starting map
/// that becomes the spawned tool's inherited env) and `interp_env` (the lookup
/// table for `${env:X}` interpolation). In production `seed_env` is a baselined
/// subset while `interp_env` is the full process env, so a tool only inherits
/// what it explicitly opted into.
pub fn resolve_with_allowlist(
    tool: &Tool,
    defaults: Option<&Defaults>,
    cwd: Option<&Path>,
    seed_env: &HashMap<String, String>,
    interp_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
) -> ResolvedEnv {
    let mut vars: HashMap<String, String> = HashMap::new();
    let mut keys: HashMap<String, EnvSource> = HashMap::new();

    // Layer 1: seed env (baselined process env in production)
    for (k, v) in seed_env {
        vars.insert(k.clone(), v.clone());
        keys.insert(k.clone(), EnvSource::Process);
    }

    // Layer 2: defaults envFile
    if let Some(d) = defaults {
        if let Some(rel) = &d.env_file {
            load_env_file(rel, cwd, &mut vars, &mut keys);
        }
    }

    // Layer 3: tool envFile (overrides defaults)
    if let Some(rel) = &tool.env_file {
        load_env_file(rel, cwd, &mut vars, &mut keys);
    }

    // Layer 4: defaults env block
    if let Some(d) = defaults {
        apply_env_block(
            &d.env,
            interp_env,
            keychain_lookup,
            allow,
            &mut vars,
            &mut keys,
        );
    }

    // Layer 5: tool env block (overrides defaults)
    apply_env_block(
        &tool.env,
        interp_env,
        keychain_lookup,
        allow,
        &mut vars,
        &mut keys,
    );

    ResolvedEnv { vars, keys }
}

fn resolve_env_file_path(rel: &str, cwd: Option<&Path>) -> std::path::PathBuf {
    let p = Path::new(rel);
    if p.is_absolute() {
        p.to_path_buf()
    } else if let Some(c) = cwd {
        c.join(rel)
    } else {
        std::env::current_dir().unwrap_or_default().join(rel)
    }
}

fn load_env_file(
    rel: &str,
    cwd: Option<&Path>,
    vars: &mut HashMap<String, String>,
    keys: &mut HashMap<String, EnvSource>,
) {
    let path = resolve_env_file_path(rel, cwd);
    let iter = match dotenvy::from_path_iter(&path) {
        Ok(it) => it,
        Err(_) => return, // missing or unreadable — silent (see test: missing_env_file_is_silent)
    };
    for item in iter.flatten() {
        let (k, v) = item;
        vars.insert(k.clone(), v);
        keys.insert(k, EnvSource::EnvFile);
    }
}

fn apply_env_block(
    block: &HashMap<String, String>,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
    vars: &mut HashMap<String, String>,
    keys: &mut HashMap<String, EnvSource>,
) {
    for (k, raw) in block {
        match interpolate(raw, process_env, keychain_lookup, allow) {
            Some((value, source)) => {
                vars.insert(k.clone(), value);
                keys.insert(k.clone(), source);
            }
            None => {
                // Interpolation target missing — drop the var so the tool fails
                // loudly rather than silently inheriting a stale value.
                vars.remove(k);
                keys.remove(k);
            }
        }
    }
}

/// Returns `(resolved_value, source)` or `None` if a `${keychain:X}` / `${env:X}`
/// reference can't be resolved. A literal (no `${...}` token) always resolves and
/// is reported as `EnvBlock`.
fn interpolate(
    raw: &str,
    process_env: &HashMap<String, String>,
    keychain_lookup: &dyn Fn(&str) -> Option<String>,
    allow: &dyn KeychainAllow,
) -> Option<(String, EnvSource)> {
    if let Some(rest) = raw
        .strip_prefix("${keychain:")
        .and_then(|s| s.strip_suffix('}'))
    {
        // Block before invoking the lookup so a malicious tool definition
        // can't probe the keychain for keys it doesn't already reference.
        if !allow.permits(rest) {
            return None;
        }
        return keychain_lookup(rest).map(|v| (v, EnvSource::Keychain));
    }
    if let Some(rest) = raw.strip_prefix("${env:").and_then(|s| s.strip_suffix('}')) {
        return process_env
            .get(rest)
            .cloned()
            .map(|v| (v, EnvSource::HostEnv));
    }
    Some((raw.to_string(), EnvSource::EnvBlock))
}

/// Production keychain lookup. Shells out to:
///   security find-generic-password -s pier -a <key> -w
/// Returns the password on success, None on any failure (entry missing, denied, etc.).
///
/// Set up: `security add-generic-password -s pier -a <key> -w <value>`
pub fn keychain_lookup(key: &str) -> Option<String> {
    let out = std::process::Command::new("security")
        .args(["find-generic-password", "-s", "pier", "-a", key, "-w"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?;
    Some(s.trim_end_matches('\n').to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Tool;

    fn empty_tool() -> Tool {
        serde_json::from_str(r#"{"id":"x","name":"X","command":"/x"}"#).unwrap()
    }

    fn no_keychain(_: &str) -> Option<String> {
        None
    }

    #[test]
    fn process_env_passes_through() {
        let mut proc_env = HashMap::new();
        proc_env.insert("PATH".into(), "/usr/bin".into());
        let r = resolve(&empty_tool(), None, None, &proc_env, &no_keychain);
        assert_eq!(r.vars.get("PATH").map(String::as_str), Some("/usr/bin"));
        assert_eq!(r.keys.get("PATH"), Some(&EnvSource::Process));
    }

    #[test]
    fn env_block_overrides_process_env() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"DEBUG":"1"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let mut proc_env = HashMap::new();
        proc_env.insert("DEBUG".into(), "0".into());
        let r = resolve(&tool, None, None, &proc_env, &no_keychain);
        assert_eq!(r.vars.get("DEBUG").map(String::as_str), Some("1"));
        assert_eq!(r.keys.get("DEBUG"), Some(&EnvSource::EnvBlock));
    }

    #[test]
    fn keychain_interpolation_resolves() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"API_KEY":"${keychain:openai}"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let proc_env = HashMap::new();
        let kc = |k: &str| {
            if k == "openai" {
                Some("sk-test".into())
            } else {
                None
            }
        };
        let r = resolve(&tool, None, None, &proc_env, &kc);
        assert_eq!(r.vars.get("API_KEY").map(String::as_str), Some("sk-test"));
        assert_eq!(r.keys.get("API_KEY"), Some(&EnvSource::Keychain));
    }

    #[test]
    fn host_env_interpolation_resolves() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"TOKEN":"${env:GH_TOKEN}"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let mut proc_env = HashMap::new();
        proc_env.insert("GH_TOKEN".into(), "ghp_xyz".into());
        let r = resolve(&tool, None, None, &proc_env, &no_keychain);
        assert_eq!(r.vars.get("TOKEN").map(String::as_str), Some("ghp_xyz"));
        assert_eq!(r.keys.get("TOKEN"), Some(&EnvSource::HostEnv));
    }

    #[test]
    fn missing_keychain_drops_var() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"K":"${keychain:nope}"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let r = resolve(&tool, None, None, &HashMap::new(), &no_keychain);
        // Missing keychain entries are dropped (not silently set to empty).
        assert!(!r.vars.contains_key("K"));
    }

    #[test]
    fn env_file_loads_and_envblock_overrides() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".env"), "FROM_FILE=yes\nDEBUG=0\n").unwrap();
        let json = format!(
            r#"{{"id":"x","name":"X","command":"/x","envFile":".env","env":{{"DEBUG":"1"}}}}"#
        );
        let tool: Tool = serde_json::from_str(&json).unwrap();
        let r = resolve(&tool, None, Some(dir.path()), &HashMap::new(), &no_keychain);
        assert_eq!(r.vars.get("FROM_FILE").map(String::as_str), Some("yes"));
        assert_eq!(r.keys.get("FROM_FILE"), Some(&EnvSource::EnvFile));
        assert_eq!(r.vars.get("DEBUG").map(String::as_str), Some("1"));
        assert_eq!(r.keys.get("DEBUG"), Some(&EnvSource::EnvBlock));
    }

    #[test]
    fn tool_env_file_overrides_defaults_env_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.env"), "K=from_a\n").unwrap();
        std::fs::write(dir.path().join("b.env"), "K=from_b\n").unwrap();
        let defaults: Defaults = serde_json::from_str(r#"{"envFile":"a.env"}"#).unwrap();
        let tool: Tool =
            serde_json::from_str(r#"{"id":"x","name":"X","command":"/x","envFile":"b.env"}"#)
                .unwrap();
        let r = resolve(
            &tool,
            Some(&defaults),
            Some(dir.path()),
            &HashMap::new(),
            &no_keychain,
        );
        assert_eq!(r.vars.get("K").map(String::as_str), Some("from_b"));
    }

    #[test]
    fn keychain_lookup_blocked_when_key_not_in_allowlist() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"K":"${keychain:secret}"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let kc = |_: &str| Some("would-be-leaked".to_string());
        let allow: HashSet<String> = HashSet::new();
        let env = HashMap::new();
        let r = resolve_with_allowlist(&tool, None, None, &env, &env, &kc, &allow);
        assert!(
            !r.vars.contains_key("K"),
            "blocked key must not appear in env"
        );
    }

    #[test]
    fn keychain_lookup_allowed_when_key_in_allowlist() {
        let json = r#"{"id":"x","name":"X","command":"/x","env":{"K":"${keychain:secret}"}}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let kc = |k: &str| {
            if k == "secret" {
                Some("v".to_string())
            } else {
                None
            }
        };
        let mut allow: HashSet<String> = HashSet::new();
        allow.insert("secret".to_string());
        let env = HashMap::new();
        let r = resolve_with_allowlist(&tool, None, None, &env, &env, &kc, &allow);
        assert_eq!(r.vars.get("K").map(String::as_str), Some("v"));
    }

    #[test]
    fn baseline_env_keeps_only_allowlisted_keys() {
        let mut full = HashMap::new();
        full.insert("PATH".into(), "/usr/bin".into());
        full.insert("HOME".into(), "/Users/test".into());
        full.insert("LANG".into(), "en_US.UTF-8".into());
        full.insert("LC_ALL".into(), "en_US.UTF-8".into());
        full.insert("TMPDIR".into(), "/tmp".into());
        full.insert("OPENAI_API_KEY".into(), "sk-leak".into());
        full.insert("AWS_SECRET_ACCESS_KEY".into(), "leak".into());
        let base = baseline_env(&full);
        assert_eq!(base.get("PATH").map(String::as_str), Some("/usr/bin"));
        assert_eq!(base.get("HOME").map(String::as_str), Some("/Users/test"));
        assert_eq!(base.get("LANG").map(String::as_str), Some("en_US.UTF-8"));
        assert_eq!(base.get("LC_ALL").map(String::as_str), Some("en_US.UTF-8"));
        assert_eq!(base.get("TMPDIR").map(String::as_str), Some("/tmp"));
        assert!(!base.contains_key("OPENAI_API_KEY"));
        assert!(!base.contains_key("AWS_SECRET_ACCESS_KEY"));
    }

    #[test]
    fn missing_env_file_is_silent() {
        // Tool says envFile=".env" but it doesn't exist on disk. Don't crash —
        // tools.json may reference future files; the user just sees their tool
        // start with whatever env Pier already has.
        let json = r#"{"id":"x","name":"X","command":"/x","envFile":"nope.env"}"#;
        let tool: Tool = serde_json::from_str(json).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let r = resolve(&tool, None, Some(dir.path()), &HashMap::new(), &no_keychain);
        // No envFile loaded, no env block, empty process env → empty result. The point
        // of this test is that the missing file is *silent*, not that it crashes.
        assert!(r.vars.is_empty());
    }
}
