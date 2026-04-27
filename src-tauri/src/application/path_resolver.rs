use anyhow::{anyhow, Result};
use std::path::PathBuf;

pub const SEARCH: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];

pub fn resolve(command: &str) -> Result<PathBuf> {
    if command.contains('/') {
        let p = PathBuf::from(command);
        if p.exists() {
            return Ok(p);
        }
        return Err(anyhow!("not found: {}", command));
    }
    for c in SEARCH {
        let p = PathBuf::from(c).join(command);
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

    #[test]
    fn does_not_search_home_dirs() {
        // We can't manipulate $HOME safely in tests, but we can assert the SEARCH
        // constant is the system-only set.
        assert_eq!(
            super::SEARCH,
            &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
        );
    }
}
