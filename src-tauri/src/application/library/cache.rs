use crate::infrastructure::atomic_write::atomic_write;
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
    dirs::home_dir()
        .expect("home")
        .join(".pier/cache/catalog.json")
}

pub fn load(path: &std::path::Path) -> Result<Option<CachedCatalog>> {
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(serde_json::from_str(&s)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn save(path: &std::path::Path, c: &CachedCatalog) -> Result<()> {
    atomic_write(path, serde_json::to_string(c)?.as_bytes(), None)
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
