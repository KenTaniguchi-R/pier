# Contributing to Pier

Thanks for your interest! This doc covers how to set up a dev environment,
the architectural rules to follow, and how PRs land.

## Development setup

Prerequisites: **Node 20+**, **Rust stable**, and the Tauri prerequisites for
macOS (Xcode Command Line Tools).

```bash
git clone https://github.com/KenTaniguchi-R/pier.git
cd pier
npm install
npm run tauri:dev
```

Vite runs on port **1420** with `strictPort: true` — free that port first.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run tauri:dev` | Run the desktop app (frontend + Rust shell) |
| `npm run dev` | Frontend only, in browser (Tauri commands will fail) |
| `npm run build` | Typecheck + build web bundle |
| `npm run tauri build` | Produce an unsigned local DMG |
| `npm test` | Vitest watch mode |
| `npm run test:run` | One-shot test run |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust tests |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Rust lint |

## Architectural rules

Pier follows clean-architecture layering on **both** sides:

```
domain → application → infrastructure → ui/commands
```

Two rules that are enforced in review:

1. **No `@tauri-apps/api` or `@tauri-apps/plugin-*` imports outside
   `src/infrastructure/`.** UI, state, and application code must go through
   the port interfaces in `src/application/ports.ts`.
2. **`src-tauri/src/commands.rs` is a thin shim layer.** Real logic belongs in
   `application/` use cases.

See `CLAUDE.md` for more detail on layering and the runtime model.

## Pull requests

- Branch from `main`, push, open a PR.
- Keep PRs focused — one feature/fix per PR.
- Conventional commit prefixes are appreciated (`feat:`, `fix:`, `docs:`,
  `chore:`, `refactor:`).
- CI must be green before merge: typecheck, tests, clippy, fmt.
- Add or update tests when changing behavior. Frontend tests live in
  `__tests__/` siblings; backend tests live next to the code they cover.
- For UI changes, include a screenshot or short clip in the PR description.

## Reporting bugs / requesting features

Use the issue templates under [Issues](https://github.com/KenTaniguchi-R/pier/issues/new/choose).
For security issues, see [SECURITY.md](SECURITY.md) — please do **not** open a
public issue.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
