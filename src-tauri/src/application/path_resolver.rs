use anyhow::{anyhow, Result};
use std::path::PathBuf;

const SEARCH: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
];

pub fn resolve(command: &str) -> Result<PathBuf> {
    if command.contains('/') {
        let p = PathBuf::from(command);
        if p.exists() {
            return Ok(p);
        }
        return Err(anyhow!("not found: {}", command));
    }
    let home = dirs::home_dir().ok_or_else(|| anyhow!("no home"))?;
    let mut candidates: Vec<PathBuf> = SEARCH.iter().map(PathBuf::from).collect();
    for sub in [".local/bin", ".cargo/bin", ".bun/bin"] {
        candidates.push(home.join(sub));
    }
    for c in candidates {
        let p = c.join(command);
        if p.exists() {
            return Ok(p);
        }
    }
    Err(anyhow!("binary {} not found in known paths", command))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_command_as_is_when_absolute() {
        let r = resolve("/bin/echo");
        assert_eq!(r.unwrap().to_str().unwrap(), "/bin/echo");
    }

    #[test]
    fn errors_when_not_found() {
        assert!(resolve("definitely_not_a_real_binary_xyz").is_err());
    }
}
