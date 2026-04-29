use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlatformAsset {
    pub url: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum NetworkAccess {
    None,
    Localhost,
    Internet,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FilesAccess {
    None,
    ReadOnly,
    Writes,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SystemAccess {
    None,
    RunsCommands,
    KillsProcesses,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub network: NetworkAccess,
    pub files: FilesAccess,
    pub system: SystemAccess,
    #[serde(default)]
    pub sentences: Vec<String>,
}

/// Custom deserialize that accepts both the new three-axis shape and the
/// legacy `{ network: bool, fsRead: [], fsWrite: [] }` shape so older
/// catalogs (and our existing signed test fixture) keep loading.
impl<'de> Deserialize<'de> for Permissions {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            New {
                network: NetworkAccess,
                files: FilesAccess,
                system: SystemAccess,
                #[serde(default)]
                sentences: Vec<String>,
            },
            Legacy {
                #[serde(default)]
                network: bool,
                #[serde(default, rename = "fsRead")]
                fs_read: Vec<String>,
                #[serde(default, rename = "fsWrite")]
                fs_write: Vec<String>,
            },
        }
        Ok(match Raw::deserialize(d)? {
            Raw::New {
                network,
                files,
                system,
                sentences,
            } => Permissions {
                network,
                files,
                system,
                sentences,
            },
            Raw::Legacy {
                network,
                fs_read,
                fs_write,
            } => Permissions {
                network: if network {
                    NetworkAccess::Internet
                } else {
                    NetworkAccess::None
                },
                files: if !fs_write.is_empty() {
                    FilesAccess::Writes
                } else if !fs_read.is_empty() {
                    FilesAccess::ReadOnly
                } else {
                    FilesAccess::None
                },
                system: SystemAccess::None,
                sentences: Vec::new(),
            },
        })
    }
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirm: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    pub permissions: Permissions,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audience: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub examples: Vec<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub featured: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub added_at: Option<String>,
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
    fn parses_legacy_permissions_shape() {
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
        assert_eq!(cat.tools[0].permissions.network, NetworkAccess::None);
        assert_eq!(cat.tools[0].permissions.files, FilesAccess::None);
    }

    #[test]
    fn parses_new_permissions_shape() {
        let json = r##"{
            "catalogSchemaVersion": 1,
            "publishedAt": "2026-05-15T00:00:00Z",
            "tools": [{
                "id": "kill-port", "name": "Kill port", "version": "1.0.0",
                "description": "Free a port.", "category": "dev",
                "outcome": "Free up a stuck port",
                "audience": ["developer"],
                "featured": true,
                "addedAt": "2026-04-25",
                "permissions": {
                    "network": "none",
                    "files": "none",
                    "system": "kills-processes",
                    "sentences": ["runs-locally", "may-terminate-processes"]
                },
                "script": "x"
            }]
        }"##;
        let cat: Catalog = serde_json::from_str(json).unwrap();
        let t = &cat.tools[0];
        assert_eq!(t.permissions.network, NetworkAccess::None);
        assert_eq!(t.permissions.system, SystemAccess::KillsProcesses);
        assert_eq!(t.permissions.sentences.len(), 2);
        assert_eq!(t.outcome.as_deref(), Some("Free up a stuck port"));
        assert!(t.featured);
    }

    #[test]
    fn parses_invocation_contract_fields() {
        // Catalog tools must publish a typed param + arg template + run knobs
        // so the installed Tool has enough to render a form and spawn argv.
        let json = r##"{
            "catalogSchemaVersion": 1,
            "publishedAt": "2026-05-15T00:00:00Z",
            "tools": [{
                "id": "kill-port", "name": "Kill port", "version": "1.0.0",
                "description": "Free a port.", "category": "dev",
                "params": [{"id":"port","label":"Port","type":"number","required":true}],
                "args": ["{port}"],
                "confirm": true,
                "timeout": 10,
                "permissions": { "network": "none", "files": "none", "system": "kills-processes" },
                "script": "x"
            }]
        }"##;
        let cat: Catalog = serde_json::from_str(json).unwrap();
        let t = &cat.tools[0];
        assert_eq!(t.params.len(), 1);
        assert_eq!(t.args, vec!["{port}".to_string()]);
        assert_eq!(t.confirm, Some(true));
        assert_eq!(t.timeout, Some(10));
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
