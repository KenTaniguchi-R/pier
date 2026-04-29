use crate::domain::CatalogTool;
use crate::infrastructure::atomic_write::atomic_write;
use anyhow::{anyhow, bail, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub fn current_platform() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "darwin-arm64"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "darwin-amd64"
    }
    #[cfg(not(target_os = "macos"))]
    {
        "unsupported"
    }
}

pub fn install_root() -> PathBuf {
    dirs::home_dir().expect("home").join(".pier/tools")
}

#[derive(Debug)]
pub struct Installed {
    pub command: String,
    pub sha256: String,
}

fn validate_path_component(s: &str) -> Result<()> {
    anyhow::ensure!(
        !s.is_empty() && !s.contains('/') && !s.contains('\\') && s != ".." && s != ".",
        "unsafe path component: {s:?}"
    );
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub async fn install(tool: &CatalogTool, root: &Path) -> Result<Installed> {
    validate_path_component(&tool.id)?;
    validate_path_component(&tool.version)?;
    let dest_dir = root.join(&tool.id).join(&tool.version);

    if let Some(script) = &tool.script {
        let path = dest_dir.join(format!("{}.sh", tool.id));
        atomic_write(&path, script.as_bytes(), Some(0o755))?;
        return Ok(Installed {
            command: path.to_string_lossy().into_owned(),
            sha256: sha256_hex(script.as_bytes()),
        });
    }

    let plat = current_platform();
    let asset = tool
        .platforms
        .get(plat)
        .ok_or_else(|| anyhow!("no asset for platform {plat}"))?;
    let bytes = crate::infrastructure::library_http::download_bytes(&asset.url).await?;
    let actual = sha256_hex(&bytes);
    if actual != asset.sha256.to_lowercase() {
        bail!("sha256 mismatch: expected {}, got {}", asset.sha256, actual);
    }
    let path = dest_dir.join(&tool.id);
    atomic_write(&path, &bytes, Some(0o755))?;
    Ok(Installed {
        command: path.to_string_lossy().into_owned(),
        sha256: actual,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{FilesAccess, NetworkAccess, Permissions, SystemAccess};
    use tempfile::tempdir;

    fn shell_tool() -> CatalogTool {
        CatalogTool {
            id: "kill-port".into(),
            name: "Kill port".into(),
            version: "1.0.0".into(),
            description: "x".into(),
            category: "dev".into(),
            params: vec![],
            args: vec![],
            confirm: None,
            timeout: None,
            permissions: Permissions {
                network: NetworkAccess::None,
                files: FilesAccess::None,
                system: SystemAccess::None,
                sentences: vec![],
            },
            outcome: None,
            audience: vec![],
            examples: vec![],
            featured: false,
            added_at: None,
            platforms: Default::default(),
            script: Some("#!/bin/sh\necho hi\n".into()),
            min_pier_version: None,
            deprecated: false,
        }
    }

    #[tokio::test]
    async fn installs_shell_tool_executable() {
        use std::os::unix::fs::PermissionsExt;
        let d = tempdir().unwrap();
        let i = install(&shell_tool(), d.path()).await.unwrap();
        let meta = std::fs::metadata(&i.command).unwrap();
        assert!(meta.permissions().mode() & 0o111 != 0, "must be executable");
    }

    #[tokio::test]
    async fn rejects_sha_mismatch() {
        let server = httpmock::MockServer::start();
        let _m = server.mock(|w, t| {
            w.method(httpmock::Method::GET).path("/bin");
            t.status(200).body("hello");
        });
        let mut t = shell_tool();
        t.script = None;
        t.platforms.insert(
            current_platform().into(),
            crate::domain::PlatformAsset {
                url: server.url("/bin"),
                sha256: "0000000000000000000000000000000000000000000000000000000000000000".into(),
            },
        );
        let d = tempdir().unwrap();
        let err = install(&t, d.path()).await.unwrap_err();
        assert!(err.to_string().contains("sha256 mismatch"));
    }

    #[tokio::test]
    async fn rejects_path_traversal_in_id() {
        let mut t = shell_tool();
        t.id = "../evil".into();
        let d = tempdir().unwrap();
        let err = install(&t, d.path()).await.unwrap_err();
        assert!(
            err.to_string().contains("unsafe path component"),
            "got: {err}"
        );
    }
}
