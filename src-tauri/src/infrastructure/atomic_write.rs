use anyhow::Result;
use std::path::Path;

/// Write `bytes` to `path` atomically: create the parent dir if needed, write to
/// a per-process unique temp file, optionally chmod, then rename onto the final
/// path. Concurrent writers can't trample each other because the tmp suffix
/// includes pid + nanos, and the rename is atomic on POSIX filesystems.
pub fn atomic_write(path: &Path, bytes: &[u8], mode: Option<u32>) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = path.with_extension(format!("tmp.{}.{}", std::process::id(), nanos));
    std::fs::write(&tmp, bytes)?;
    if let Some(m) = mode {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(m))?;
        }
        #[cfg(not(unix))]
        let _ = m;
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn writes_and_creates_parent() {
        let d = tempdir().unwrap();
        let p = d.path().join("nested/dir/out.txt");
        atomic_write(&p, b"hello", None).unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "hello");
    }

    #[cfg(unix)]
    #[test]
    fn applies_executable_mode() {
        use std::os::unix::fs::PermissionsExt;
        let d = tempdir().unwrap();
        let p = d.path().join("script.sh");
        atomic_write(&p, b"#!/bin/sh\n", Some(0o755)).unwrap();
        let mode = std::fs::metadata(&p).unwrap().permissions().mode();
        assert!(mode & 0o111 != 0, "expected executable bits, got mode={mode:o}");
    }
}
