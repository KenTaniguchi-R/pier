use anyhow::Result;
use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Entry {
    Start {
        run_id: String,
        tool_id: String,
        bin: String,
        args: Vec<String>,
        #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
        env_keys: std::collections::HashMap<String, crate::application::env_resolver::EnvSource>,
        ts: u64,
    },
    End {
        run_id: String,
        tool_id: String,
        exit_code: Option<i32>,
        ts: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        status: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output_path: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output_bytes: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output_truncated: Option<bool>,
    },
}

impl Entry {
    pub fn start_with_env(
        run_id: &str,
        tool_id: &str,
        bin: &Path,
        args: &[String],
        env_keys: &std::collections::HashMap<String, crate::application::env_resolver::EnvSource>,
        ts: u64,
    ) -> Self {
        Entry::Start {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            bin: bin.to_string_lossy().into(),
            args: args.to_vec(),
            env_keys: env_keys.clone(),
            ts,
        }
    }

    pub fn end(run_id: &str, tool_id: &str, exit_code: Option<i32>, ts: u64) -> Self {
        Entry::End {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            exit_code,
            ts,
            status: None,
            output_path: None,
            output_bytes: None,
            output_truncated: None,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn end_full(
        run_id: &str,
        tool_id: &str,
        exit_code: Option<i32>,
        ts: u64,
        status: &str,
        output_path: Option<String>,
        output_bytes: Option<u64>,
        output_truncated: Option<bool>,
    ) -> Self {
        Entry::End {
            run_id: run_id.into(),
            tool_id: tool_id.into(),
            exit_code,
            ts,
            status: Some(status.into()),
            output_path,
            output_bytes,
            output_truncated,
        }
    }
}

/// Redacts argv elements whose stringified value matches a `secret: true` parameter.
///
/// Relies on the invariant that `arg_template::build_args` emits each parameter
/// value as its OWN argv element (never inlined into a composite like
/// `--header=Bearer <secret>`). If a future feature changes that contract,
/// this redaction will silently fail — update both together.
pub fn redact_args(
    args: &[String],
    parameters: &[crate::domain::tool::Parameter],
    values: &std::collections::HashMap<String, serde_json::Value>,
) -> Vec<String> {
    use serde_json::Value;
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
        .map(|a| {
            if secret_strings.iter().any(|s| s == a) {
                "[REDACTED]".to_string()
            } else {
                a.clone()
            }
        })
        .collect()
}

/// Append an entry to the default audit log at ~/.pier/audit.log
pub fn append(entry: &Entry) -> Result<()> {
    let path = audit_path();
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    append_to(&path, entry)
}

/// Append an entry to a specific audit log file
pub fn append_to(path: &Path, entry: &Entry) -> Result<()> {
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    writeln!(f, "{}", serde_json::to_string(entry)?)?;
    Ok(())
}

fn audit_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".pier").join("audit.log")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn appends_jsonl_lines() {
        let d = tempdir().unwrap();
        let path = d.path().join("audit.log");
        append_to(
            &path,
            &Entry::start_with_env(
                "rid",
                "tid",
                std::path::Path::new("/bin/echo"),
                &["a".into()],
                &std::collections::HashMap::new(),
                1,
            ),
        )
        .unwrap();
        append_to(&path, &Entry::end("rid", "tid", Some(0), 2)).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), 2);
    }

    #[test]
    fn start_entry_serializes_env_keys() {
        use crate::application::env_resolver::EnvSource;
        use std::collections::HashMap;
        let mut keys = HashMap::new();
        keys.insert("PATH".to_string(), EnvSource::Process);
        keys.insert("OPENAI_API_KEY".to_string(), EnvSource::Keychain);
        keys.insert("FROM_FILE".to_string(), EnvSource::EnvFile);
        let entry = Entry::start_with_env(
            "rid",
            "tid",
            std::path::Path::new("/bin/echo"),
            &["a".into()],
            &keys,
            1,
        );
        let json = serde_json::to_string(&entry).unwrap();
        // Keys are present; no values are present.
        assert!(json.contains("\"PATH\""));
        assert!(json.contains("\"OPENAI_API_KEY\""));
        assert!(json.contains("\"FROM_FILE\""));
        assert!(json.contains("\"keychain\""));
        assert!(json.contains("\"envfile\""));
        assert!(json.contains("\"process\""));
        // Definitely no secret-looking content.
        assert!(!json.contains("sk-"));
    }

    #[test]
    fn redact_args_replaces_secret_param_values() {
        use crate::domain::tool::Parameter;
        use serde_json::json;
        let params: Vec<Parameter> = serde_json::from_str(
            r#"[
            {"id":"token","label":"T","type":"text","secret":true},
            {"id":"name","label":"N","type":"text"}
        ]"#,
        )
        .unwrap();
        let mut values = std::collections::HashMap::new();
        values.insert("token".to_string(), json!("ghp_abc123"));
        values.insert("name".to_string(), json!("hello"));

        let args = vec![
            "--token".into(),
            "ghp_abc123".into(),
            "--name".into(),
            "hello".into(),
        ];
        let out = super::redact_args(&args, &params, &values);
        assert_eq!(out, vec!["--token", "[REDACTED]", "--name", "hello"]);
    }

    #[test]
    fn redact_args_does_not_redact_non_secret_match() {
        use crate::domain::tool::Parameter;
        use serde_json::json;
        let params: Vec<Parameter> = serde_json::from_str(
            r#"[
            {"id":"name","label":"N","type":"text"}
        ]"#,
        )
        .unwrap();
        let mut values = std::collections::HashMap::new();
        values.insert("name".to_string(), json!("hello"));
        let args = vec!["hello".into()];
        let out = super::redact_args(&args, &params, &values);
        assert_eq!(out, vec!["hello"]);
    }
}
