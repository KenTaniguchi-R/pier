use crate::domain::tool::{Parameter, Tool};
use serde_json::Value;
use std::collections::HashMap;

pub fn build_args(tool: &Tool, values: &HashMap<String, Value>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let by_id: HashMap<&str, &Parameter> = tool.parameters.iter().map(|p| (p.id(), p)).collect();

    // Pass 1: positional args with {id} substitution.
    for raw in &tool.args {
        let Some(name) = match_placeholder(raw) else {
            out.push(raw.clone());
            continue;
        };
        let v = values.get(name);
        if is_empty(v) {
            if by_id.get(name).map(|p| p.optional()).unwrap_or(false) {
                continue;
            }
            out.push(String::new());
        } else {
            out.push(stringify(v));
        }
    }

    // Pass 2: flagged params in declaration order.
    for p in &tool.parameters {
        let Some(flag) = p.flag() else { continue };
        let v = values.get(p.id());
        if p.is_boolean() {
            if matches!(v, Some(Value::Bool(true))) {
                out.push(flag.to_string());
            }
            continue;
        }
        if is_empty(v) {
            continue;
        }
        out.push(flag.to_string());
        out.push(stringify(v));
    }

    out
}

fn match_placeholder(s: &str) -> Option<&str> {
    if !s.starts_with('{') || !s.ends_with('}') || s.len() < 3 {
        return None;
    }
    let inner = &s[1..s.len() - 1];
    let mut chars = inner.chars();
    let first_ok = chars
        .next()
        .map(|c| c.is_ascii_alphabetic() || c == '_')
        .unwrap_or(false);
    let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if first_ok && rest_ok {
        Some(inner)
    } else {
        None
    }
}

fn is_empty(v: Option<&Value>) -> bool {
    match v {
        None => true,
        Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

fn stringify(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(other) => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tool(json_str: &str) -> Tool {
        serde_json::from_str(json_str).unwrap()
    }

    fn vals(pairs: &[(&str, Value)]) -> HashMap<String, Value> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect()
    }

    #[test]
    fn substitutes_positional_placeholder() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["-i","{input}"],
          "parameters":[{"id":"input","label":"Input","type":"file"}]}"#,
        );
        let r = build_args(&t, &vals(&[("input", json!("/tmp/a"))]));
        assert_eq!(r, vec!["-i", "/tmp/a"]);
    }

    #[test]
    fn drops_optional_empty_positional() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["-i","{input}","{extra}"],
          "parameters":[
            {"id":"input","label":"Input","type":"file"},
            {"id":"extra","label":"Extra","type":"text","optional":true}
          ]}"#,
        );
        let r = build_args(&t, &vals(&[("input", json!("/a")), ("extra", json!(""))]));
        assert_eq!(r, vec!["-i", "/a"]);
    }

    #[test]
    fn emits_flag_when_set() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","label":"Input","type":"file"},
            {"id":"bitrate","label":"Bitrate","type":"text","flag":"-b:v","optional":true}
          ]}"#,
        );
        let r = build_args(
            &t,
            &vals(&[("input", json!("/a")), ("bitrate", json!("5000k"))]),
        );
        assert_eq!(r, vec!["/a", "-b:v", "5000k"]);
    }

    #[test]
    fn omits_flag_when_empty() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","label":"Input","type":"file"},
            {"id":"bitrate","label":"Bitrate","type":"text","flag":"-b:v","optional":true}
          ]}"#,
        );
        let r = build_args(&t, &vals(&[("input", json!("/a")), ("bitrate", json!(""))]));
        assert_eq!(r, vec!["/a"]);
    }

    #[test]
    fn boolean_true_emits_flag_only() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "parameters":[{"id":"dry","label":"Dry run","type":"boolean","flag":"--dry-run"}]}"#,
        );
        let r = build_args(&t, &vals(&[("dry", json!(true))]));
        assert_eq!(r, vec!["--dry-run"]);
    }

    #[test]
    fn boolean_false_emits_nothing() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "parameters":[{"id":"dry","label":"Dry run","type":"boolean","flag":"--dry-run"}]}"#,
        );
        let r = build_args(&t, &vals(&[("dry", json!(false))]));
        assert!(r.is_empty());
    }

    #[test]
    fn flag_order_follows_parameters_declaration() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","label":"Input","type":"file"},
            {"id":"a","label":"A","type":"text","flag":"-a"},
            {"id":"b","label":"B","type":"text","flag":"-b"}
          ]}"#,
        );
        let r = build_args(
            &t,
            &vals(&[("input", json!("/x")), ("a", json!("1")), ("b", json!("2"))]),
        );
        assert_eq!(r, vec!["/x", "-a", "1", "-b", "2"]);
    }

    #[test]
    fn coerces_number_to_string() {
        let t = tool(
            r#"{"id":"t","name":"T","command":"/x",
          "args":["-p","{port}"],
          "parameters":[{"id":"port","label":"Port","type":"number"}]}"#,
        );
        let r = build_args(&t, &vals(&[("port", json!(8080))]));
        assert_eq!(r, vec!["-p", "8080"]);
    }
}
