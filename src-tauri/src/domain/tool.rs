use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InputType { File, Text, Folder, Url, None }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub input_type: InputType,
    #[serde(default)]
    pub accepts: Vec<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub timeout: Option<u64>,
    #[serde(default)]
    pub output_path: Option<String>,
    #[serde(default)]
    pub confirm: Option<bool>,
    #[serde(default)]
    pub shell: Option<bool>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
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
    fn parses_minimal_tool() {
        let json = r#"{"schemaVersion":"1.0","tools":[
          {"id":"x","name":"X","command":"/bin/echo","inputType":"file"}
        ]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.tools[0].id, "x");
        assert!(matches!(cfg.tools[0].input_type, InputType::File));
    }

    #[test]
    fn rejects_unknown_input_type() {
        let json = r#"{"schemaVersion":"1.0","tools":[
          {"id":"x","name":"X","command":"/bin/echo","inputType":"weird"}
        ]}"#;
        assert!(serde_json::from_str::<ToolsConfig>(json).is_err());
    }
}
