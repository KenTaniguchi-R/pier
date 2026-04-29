use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CachedCatalog {
    pub etag: Option<String>,
    pub body: String,
    pub fetched_at: i64,
}

pub fn cache_path() -> PathBuf {
    dirs::home_dir().expect("home").join(".pier/cache/catalog.json")
}

pub fn load(path: &std::path::Path) -> Result<Option<CachedCatalog>> {
    if !path.exists() {
        return Ok(None);
    }
    let s = std::fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&s)?))
}

pub fn save(path: &std::path::Path, c: &CachedCatalog) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_string(c)?)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    #[test]
    fn roundtrip() {
        let d = tempdir().unwrap();
        let p = d.path().join("c.json");
        assert!(load(&p).unwrap().is_none());
        save(
            &p,
            &CachedCatalog {
                etag: Some("W/\"abc\"".into()),
                body: "{}".into(),
                fetched_at: 1,
            },
        )
        .unwrap();
        let c = load(&p).unwrap().unwrap();
        assert_eq!(c.etag.as_deref(), Some("W/\"abc\""));
    }
}
