use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlatformAsset {
    pub url: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub network: bool,
    pub fs_read: Vec<String>,
    pub fs_write: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogTool {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub params: Vec<crate::domain::tool::Parameter>,
    pub permissions: Permissions,
    #[serde(default)]
    pub platforms: HashMap<String, PlatformAsset>,
    #[serde(default)]
    pub script: Option<String>,
    #[serde(default)]
    pub min_pier_version: Option<String>,
    #[serde(default)]
    pub deprecated: bool,
}

const SUPPORTED_SCHEMA: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub catalog_schema_version: u32,
    pub published_at: String,
    pub tools: Vec<CatalogTool>,
}

impl<'de> Deserialize<'de> for Catalog {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Raw {
            catalog_schema_version: u32,
            published_at: String,
            tools: Vec<CatalogTool>,
        }
        let r = Raw::deserialize(d)?;
        if r.catalog_schema_version != SUPPORTED_SCHEMA {
            return Err(serde::de::Error::custom(format!(
                "unsupported catalogSchemaVersion: {}",
                r.catalog_schema_version
            )));
        }
        Ok(Catalog {
            catalog_schema_version: r.catalog_schema_version,
            published_at: r.published_at,
            tools: r.tools,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_minimal_catalog() {
        let json = r##"{
            "catalogSchemaVersion": 1,
            "publishedAt": "2026-05-15T00:00:00Z",
            "tools": [{
                "id": "kill-port", "name": "Kill port", "version": "1.0.0",
                "description": "Free a port.", "category": "dev",
                "permissions": { "network": false, "fsRead": [], "fsWrite": [] },
                "script": "#!/bin/sh\nlsof -ti:$1 | xargs kill -9\n"
            }]
        }"##;
        let cat: Catalog = serde_json::from_str(json).unwrap();
        assert_eq!(cat.tools.len(), 1);
        assert_eq!(cat.tools[0].id, "kill-port");
        assert!(cat.tools[0].script.is_some());
    }

    #[test]
    fn rejects_unknown_schema_version() {
        let json = r#"{"catalogSchemaVersion": 99, "publishedAt": "x", "tools": []}"#;
        let res: Result<Catalog, _> = serde_json::from_str(json);
        let err = res.unwrap_err().to_string();
        assert!(
            err.contains("unsupported catalogSchemaVersion"),
            "expected schema-version error, got: {}",
            err,
        );
    }
}
