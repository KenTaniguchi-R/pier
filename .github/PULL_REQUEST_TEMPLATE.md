## Summary

<!-- What does this PR change and why? Link any related issues with `Closes #123`. -->

## Changes

- 

## Testing

<!-- How did you verify this works? Include commands run, screenshots/clips for UI changes. -->

- [ ] `npm run test:run` passes
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] Manually verified in `npm run tauri:dev`

## Checklist

- [ ] Followed the layering rules (no `@tauri-apps/*` outside `src/infrastructure/`; thin `commands.rs`)
- [ ] Updated `CHANGELOG.md` if user-facing
- [ ] Updated docs/CLAUDE.md if architecture or scope shifted
