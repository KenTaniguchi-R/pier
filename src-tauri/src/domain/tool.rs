use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Parameter {
    File(FileParam),
    Folder(FolderParam),
    Text(TextParam),
    Url(UrlParam),
    Select(SelectParam),
    Boolean(BooleanParam),
    Number(NumberParam),
    #[serde(rename = "multiselect")]
    MultiSelect(MultiSelectParam),
    Slider(SliderParam),
    Date(DateParam),
}

impl Parameter {
    pub fn base(&self) -> &ParameterBase {
        match self {
            Parameter::File(p) => &p.base,
            Parameter::Folder(p) => &p.base,
            Parameter::Text(p) => &p.base,
            Parameter::Url(p) => &p.base,
            Parameter::Select(p) => &p.base,
            Parameter::Boolean(p) => &p.base,
            Parameter::Number(p) => &p.base,
            Parameter::MultiSelect(p) => &p.base,
            Parameter::Slider(p) => &p.base,
            Parameter::Date(p) => &p.base,
        }
    }
    pub fn id(&self) -> &str {
        &self.base().id
    }
    pub fn flag(&self) -> Option<&str> {
        self.base().flag.as_deref()
    }
    pub fn optional(&self) -> bool {
        self.base().optional.unwrap_or(false)
    }
    pub fn advanced(&self) -> bool {
        self.base().advanced.unwrap_or(false)
    }
    pub fn is_boolean(&self) -> bool {
        matches!(self, Parameter::Boolean(_))
    }
    pub fn is_secret(&self) -> bool {
        self.base().secret.unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterBase {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub help: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub optional: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flag: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub accepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderParam {
    #[serde(flatten)]
    pub base: ParameterBase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub multiline: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BooleanParam {
    #[serde(flatten)]
    pub base: ParameterBase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiSelectParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SliderParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    pub min: f64,
    pub max: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateParam {
    #[serde(flatten)]
    pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parameters: Vec<Parameter>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirm: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shell: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env_file: Option<String>,
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub env: std::collections::HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<ToolSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolSource {
    pub catalog: String,
    pub version: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Defaults {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env_file: Option<String>,
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub env: std::collections::HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsConfig {
    pub schema_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub defaults: Option<Defaults>,
    pub tools: Vec<Tool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_no_param_tool() {
        let json = r#"{"schemaVersion":"1.0","tools":[
          {"id":"x","name":"X","command":"/bin/echo"}
        ]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.tools[0].id, "x");
        assert!(cfg.tools[0].parameters.is_empty());
    }

    #[test]
    fn parses_select_parameter() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"fmt","label":"Format","type":"select","options":["mp4","webm"]}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        match &cfg.tools[0].parameters[0] {
            Parameter::Select(p) => assert_eq!(p.options, vec!["mp4", "webm"]),
            _ => panic!("expected Select"),
        }
    }

    #[test]
    fn parses_boolean_with_flag() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"dry","label":"Dry run","type":"boolean","flag":"--dry-run"}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        let p = &cfg.tools[0].parameters[0];
        assert_eq!(p.id(), "dry");
        assert_eq!(p.flag(), Some("--dry-run"));
        assert!(p.is_boolean());
    }

    #[test]
    fn rejects_unknown_param_type() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"q","label":"Q","type":"weird"}]
        }]}"#;
        assert!(serde_json::from_str::<ToolsConfig>(json).is_err());
    }

    #[test]
    fn parses_tool_with_env_file_and_env_block() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "cwd":"/tmp/proj",
          "envFile":".env",
          "env":{"DEBUG":"1","KEY":"${keychain:k}"}
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        let t = &cfg.tools[0];
        assert_eq!(t.env_file.as_deref(), Some(".env"));
        assert_eq!(t.env.get("DEBUG").map(String::as_str), Some("1"));
        assert_eq!(t.env.get("KEY").map(String::as_str), Some("${keychain:k}"));
    }

    #[test]
    fn parses_multiselect_parameter() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"tags","label":"Tags","type":"multiselect",
            "options":["a","b","c"],"default":["a"]}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        match &cfg.tools[0].parameters[0] {
            Parameter::MultiSelect(p) => assert_eq!(p.options, vec!["a", "b", "c"]),
            _ => panic!("expected MultiSelect"),
        }
    }

    #[test]
    fn parses_slider_parameter() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"q","label":"Quality","type":"slider","min":0,"max":100,"step":5}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        match &cfg.tools[0].parameters[0] {
            Parameter::Slider(p) => {
                assert_eq!(p.min, 0.0);
                assert_eq!(p.max, 100.0);
                assert_eq!(p.step, Some(5.0));
            }
            _ => panic!("expected Slider"),
        }
    }

    #[test]
    fn parses_date_parameter() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"d","label":"Date","type":"date","min":"2020-01-01"}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        match &cfg.tools[0].parameters[0] {
            Parameter::Date(p) => assert_eq!(p.min.as_deref(), Some("2020-01-01")),
            _ => panic!("expected Date"),
        }
    }

    #[test]
    fn parses_top_level_defaults() {
        let json = r#"{"schemaVersion":"1.0","defaults":{"envFile":".env"},"tools":[
          {"id":"x","name":"X","command":"/x"}
        ]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(
            cfg.defaults.as_ref().and_then(|d| d.env_file.as_deref()),
            Some(".env")
        );
    }
}
