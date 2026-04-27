# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately via either:

- GitHub Private Vulnerability Reporting:
  https://github.com/KenTaniguchi-R/pier/security/advisories/new
- Email: **`taniguchi.ryusei@gmail.com`** with the subject `[pier] security`

Please include:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept code is welcome)
- The Pier version affected
- Your name / handle for credit (optional)

You should receive an initial response within **72 hours**. We will keep you
informed throughout the investigation and coordinate disclosure timing with
you before any public announcement.

## Scope

In scope:

- The Pier desktop app (Tauri shell + frontend)
- The bundled updater flow (signature verification, download integrity)
- Subprocess execution and argument handling in `run_tool`
- Filesystem access patterns (`~/.pier/*`)

Out of scope:

- User-supplied tools defined in `~/.pier/tools.json` — Pier executes whatever
  command the user configures. Treat this file as trusted local configuration.
- Vulnerabilities in upstream dependencies (please report those upstream); we
  will track CVEs via Dependabot and ship patched releases.

## Supported Versions

Pier is in early development; only the latest released version receives
security fixes.
