//! Resolve the user's interactive-shell `PATH` so GUI launches of Pier behave
//! like a Terminal launch.
//!
//! When macOS launches a `.app` from Finder/Dock, the process inherits a
//! minimal env (`PATH=/usr/bin:/bin:/usr/sbin:/sbin`). Tools installed via
//! Homebrew, nvm, pnpm, asdf, mise, etc. live elsewhere and won't be found.
//! We work around this the same way VS Code / Atom do: spawn the user's
//! login shell, source their rc files, and read back `$PATH`.
//!
//! The result is cached for the process lifetime — we only pay the shell
//! startup cost once.

use std::sync::OnceLock;
use std::time::Duration;

const SENTINEL: &str = "__PIER_PATH__=";

static LOGIN_PATH: OnceLock<Option<String>> = OnceLock::new();

/// Returns the login-shell `PATH` if we could resolve one, else `None`.
/// Cached after the first call.
pub fn login_path() -> Option<&'static str> {
    LOGIN_PATH.get_or_init(resolve_login_path).as_deref()
}

fn resolve_login_path() -> Option<String> {
    let shell = std::env::var("SHELL").ok()?;
    // -i (interactive) + -l (login) makes zsh/bash source ~/.zshrc, ~/.zprofile,
    // ~/.bash_profile etc. — the same files the user's Terminal uses.
    // Sentinel lets us ignore any chatter the rc files print to stdout.
    let script = format!("echo \"{SENTINEL}$PATH\"");
    let output = std::process::Command::new(&shell)
        .args(["-ilc", &script])
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output_with_timeout(Duration::from_secs(5))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(rest) = line.strip_prefix(SENTINEL) {
            let trimmed = rest.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Tiny shim so `Command::output()` doesn't hang the app forever if the user's
/// shell rc blocks (rare, but a misconfigured rc shouldn't brick startup).
trait CommandOutputTimeout {
    fn output_with_timeout(&mut self, timeout: Duration) -> Option<std::process::Output>;
}

impl CommandOutputTimeout for std::process::Command {
    fn output_with_timeout(&mut self, timeout: Duration) -> Option<std::process::Output> {
        let mut child = self
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .ok()?;
        let start = std::time::Instant::now();
        loop {
            match child.try_wait().ok()? {
                Some(_status) => return child.wait_with_output().ok(),
                None => {
                    if start.elapsed() >= timeout {
                        let _ = child.kill();
                        return None;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    }
}
