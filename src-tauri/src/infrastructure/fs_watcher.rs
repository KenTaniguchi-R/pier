use anyhow::Result;
use notify::{recommended_watcher, EventKind, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::thread;
use std::time::{Duration, Instant};

/// Watch `path` and call `on_change` (debounced 300ms) on any modify/create/remove event.
/// Spawns a thread; the watcher is leaked intentionally for the lifetime of the app.
pub fn watch_path<F: Fn() + Send + 'static>(path: &Path, on_change: F) -> Result<()> {
    let path_buf = path.to_path_buf();
    thread::spawn(move || {
        let (tx, rx) = channel();
        let mut watcher = match recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(ev) = res {
                let _ = tx.send(ev);
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("watcher init: {e}");
                return;
            }
        };

        // Watch the parent directory non-recursively so we catch atomic-replace renames
        let watch_target = path_buf.parent().unwrap_or(&path_buf).to_path_buf();
        if let Err(e) = watcher.watch(&watch_target, RecursiveMode::NonRecursive) {
            eprintln!("watch error: {e}");
            return;
        }

        let mut last_fire: Option<Instant> = None;
        let debounce = Duration::from_millis(300);

        for ev in rx {
            // Filter: only events touching our specific file
            let touches_us = ev
                .paths
                .iter()
                .any(|p| p == &path_buf || p.file_name() == path_buf.file_name());
            if !touches_us {
                continue;
            }
            match ev.kind {
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                    let now = Instant::now();
                    let fire = last_fire
                        .map(|t| now.duration_since(t) > debounce)
                        .unwrap_or(true);
                    if fire {
                        last_fire = Some(now);
                        on_change();
                    }
                }
                _ => {}
            }
        }
    });
    Ok(())
}
