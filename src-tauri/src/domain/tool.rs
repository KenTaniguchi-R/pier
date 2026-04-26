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
}

impl Parameter {
    pub fn base(&self) -> &ParameterBase {
        match self {
            Parameter::File(p)    => &p.base,
            Parameter::Folder(p)  => &p.base,
            Parameter::Text(p)    => &p.base,
            Parameter::Url(p)     => &p.base,
            Parameter::Select(p)  => &p.base,
            Parameter::Boolean(p) => &p.base,
            Parameter::Number(p)  => &p.base,
        }
    }
    pub fn id(&self) -> &str { &self.base().id }
    pub fn flag(&self) -> Option<&str> { self.base().flag.as_deref() }
    pub fn optional(&self) -> bool { self.base().optional.unwrap_or(false) }
    pub fn is_boolean(&self) -> bool { matches!(self, Parameter::Boolean(_)) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterBase {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub optional: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub default: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub flag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Vec::is_empty")] pub accepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub multiline: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectParam {
    #[serde(flatten)] pub base: ParameterBase,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BooleanParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")] pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")] pub parameters: Vec<Parameter>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub timeout: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub confirm: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub shell: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsConfig {
    pub schema_version: String,
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
          "parameters":[{"id":"fmt","type":"select","options":["mp4","webm"]}]
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
          "parameters":[{"id":"dry","type":"boolean","flag":"--dry-run"}]
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
          "parameters":[{"id":"q","type":"weird"}]
        }]}"#;
        assert!(serde_json::from_str::<ToolsConfig>(json).is_err());
    }
}
