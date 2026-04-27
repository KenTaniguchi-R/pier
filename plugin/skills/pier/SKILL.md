---
name: pier
description: Use whenever the user wants to add, register, install, modify, edit, rename, remove, delete, list, or inspect a tool in Pier — the macOS menu-bar launcher for CLI tools. Triggers include "add this script to Pier", "register X in Pier", "make a Pier tile for…", "remove the X tool from Pier", "show my Pier tools", "edit the Pier entry for…", or any time the user wraps a freshly written CLI in a way that suggests they'd want to surface it as a tile. Pier reads ~/.pier/tools.json and hot-reloads on save, so this skill is the right path even when the user doesn't say "Pier" — if they're writing or editing a small CLI on macOS and mention "make it easy to run" or "drop a file on it", consider this skill.
version: 0.1.0
license: MIT
---

# Pier — author tools

Pier is a macOS menu-bar app that turns CLI scripts into drag-drop tiles. Tools live in `~/.pier/tools.json`. The Rust backend watches that file with `notify`; saves take effect within a second, no app restart.

This skill teaches you to add, edit, remove, and list tools without breaking the schema.

## Where things live

- `~/.pier/tools.json` — the tool registry. Created with two starter tools on first launch. **This is the only file you edit.**
- `~/.pier/audit.log` — append-only JSONL of every run. Read-only; never edit.
- The user's Pier app, if running, will pick up your changes automatically.

If `~/.pier/tools.json` doesn't exist yet, the user hasn't launched Pier. Tell them to launch it once, then re-run your task — don't try to seed the file manually, because the app expects to own creation.

## The mental model in one paragraph

Each tool is a JSON object with an `id`, a `name`, a `command` (absolute path to the binary), optional `args`, and optional `parameters`. Parameters declare the inputs the user supplies through the UI: a file drop, a text field, a folder picker, a URL, a select, a checkbox, or a number. Args reference parameters with `{paramId}` placeholders. At run time Pier substitutes the user's input for each placeholder and spawns the command. That's the whole model.

## Required vs optional fields

A tool needs only `id`, `name`, `command`. Everything else is optional. Don't pad entries with empty `args: []` or empty `parameters: []` — omit them.

| Field | Required | Notes |
|---|---|---|
| `id` | yes | kebab-case, unique within the file |
| `name` | yes | What the user sees on the tile |
| `command` | yes | **Absolute path** to the binary. `which X` to find it. Never a bare command. |
| `args` | no | Array of strings. Use `{paramId}` to inject parameter values. |
| `parameters` | no | Array of parameter objects (see below). Omit for zero-input tools. |
| `description` | no | One short line. Shown in the tile. |
| `icon` | no | Emoji or short string. |
| `category` | no | Free-form group (e.g. `media`, `web`, `starter`). |
| `confirm` | no | `true` requires a confirm-dialog before run. Default `false`. Set for destructive or expensive tools. |
| `timeout` | no | Seconds. Kills the process after this. |
| `shell` | no | If `true`, the command runs through a shell. Default `false`. Avoid unless you genuinely need shell features. |
| `cwd` | no | Working directory. |
| `envFile` | no | Path to a `.env` file. Relative paths resolve against `cwd`. Loaded at spawn time. |
| `env` | no | Inline `{KEY: value}` map. Overrides `envFile`. Supports `${keychain:NAME}` and `${env:NAME}` interpolation. |

## Top-level defaults

`tools.json` accepts an optional `defaults` block to avoid repeating `cwd` / `envFile` / `env` per tool:

```json
{
  "schemaVersion": "1.0",
  "defaults": { "envFile": ".env" },
  "tools": [ ... ]
}
```

Per-tool fields override defaults. Resolution order: process env → defaults.envFile → tool.envFile → defaults.env → tool.env.

## Parameter types

Each parameter is `{ id, label, type, ... }`. The `id` must be unique within the tool and must match every `{placeholder}` you put in `args`. `label` is required — it's what the user sees above the input. Allowed `type` values:

| `type` | Extra fields | Used for |
|---|---|---|
| `file` | `accepts?: [".mov", ".mp4"]` | Drag-drop or pick a file. `accepts` is an extension allowlist. |
| `folder` | — | Folder picker. |
| `text` | `multiline?: boolean` | Text field. |
| `url` | — | URL field with light validation. |
| `select` | `options: string[]`, `default?: string` | Dropdown. `default` must be one of `options`. |
| `boolean` | `default?: boolean`, `flag?: string` | Checkbox. If `flag` is set and the box is checked, that string is appended to `args` automatically — you do **not** put `{paramId}` in `args` for boolean+flag pairs. |
| `number` | `min?`, `max?`, `step?`, `default?: number` | Numeric input. |

All parameters also accept: `help` (one-line hint shown under the field), `optional`, `advanced`, `default`, `flag`.

`optional: true` lets the user leave it blank. For optional parameters bound by `flag`, Pier omits both the flag and the value when blank — clean for `ffmpeg`-style optional switches.

`advanced: true` hides the parameter behind the "Advanced" disclosure in the run panel. Use it for power-user knobs (bitrate, verbosity, model overrides) so the default UI stays plain-language and uncluttered. Required parameters should generally not be `advanced`.

## Schema validation rules to respect

These come straight from the validator (`src/domain/validation.ts`). Violations crash config load:

1. `schemaVersion` is the literal string `"1.0"`. Do not change it.
2. Tool `id` must be unique across the file.
3. Parameter `id` must be unique within the tool.
4. Every parameter must have a non-empty `label` — Pier rejects the file otherwise.
5. Every `{placeholder}` in `args` must reference a defined parameter.
6. The legacy field `inputType` is no longer supported — never write it. Use `parameters` instead.
7. `select.default`, if set, must be in `options`.
8. `number.default`, `min`, `max`, `step` must be numbers.
9. `boolean.default` must be a boolean.
10. `file/folder/text/url` defaults must be strings.

## Environment

Pier launches subprocesses with **only** the env you give it (no shell, no inherited login env). For most projects that means setting:

- `cwd` — the project root (so relative paths resolve correctly).
- `envFile: ".env"` — Pier loads it at spawn time.

For inline secrets, prefer `${keychain:NAME}` over plain values — it stays out of `tools.json`. Set the keychain entry once with:

```bash
security add-generic-password -s pier -a NAME -w
```

For tools that need direnv / 1Password / mise / sops integration, **don't** invent a new field — wrap the command:

```json
{
  "command": "/opt/homebrew/bin/op",
  "args": ["run", "--env-file=.env", "--", "/path/to/tool", "{input}"],
  "cwd": "/path/to/project"
}
```

The audit log records which vars Pier passed and *where each came from* (process / envFile / envBlock / keychain / hostEnv) — values from `env` blocks and keychain are never written to disk.

## How to do the four operations

### Add a tool

1. Read `~/.pier/tools.json`.
2. Build the new tool object. Resolve `command` to an absolute path with `which <bin>` if you don't already know it.
3. Pick an `id` that isn't already in the file.
4. Append to `tools` and write back, preserving 2-space indentation and trailing newline (matches the existing file).
5. Tell the user the tool is live and what to drop on it (or what fields to fill).

### Modify a tool

1. Read the file. Find the tool by `id` (or, if the user said "the X one", by `name`/`description` — confirm the match before editing).
2. Mutate only the fields the user asked about. Don't tidy unrelated fields.
3. If you change `parameters`, re-check that every `{placeholder}` in `args` still resolves.
4. Write back. Mention what changed in one line.

### Remove a tool

1. Read the file. Confirm the user means this `id` if there's any ambiguity.
2. Drop the entry from `tools`.
3. Write back. Confirm removal.

### List tools

Just read the file and summarise: id, name, one-line description, parameter shape (e.g. "1 file + select"). Don't dump raw JSON unless asked.

## Worked examples

For five copy-pasteable patterns covering every parameter type and the most common combinations (file-only, file + select + optional flag, URL, plain command, multi-step ffmpeg), see `references/examples.md`.

For the full schema reference and edge cases, see `references/schema.md`.

## Things to avoid

- Don't use a bare command name (`"command": "ffmpeg"`). Pier doesn't run through a shell by default; spawn fails. Use `/opt/homebrew/bin/ffmpeg` (Apple silicon Homebrew) or `which ffmpeg` to find the right path on this machine.
- Don't set `"shell": true` to "fix" the above. Shell mode is for genuine pipelines and quoting, not PATH lookups.
- Don't write `"inputType": "file"`. That's the v0 schema. Pier rejects it on load now.
- Don't pre-create `~/.pier/tools.json` if it's missing. Have the user launch Pier once.
- Don't reformat the whole file. Diff-friendly edits keep the audit trail clean.
- Don't tell the user to "restart Pier" after a save. The file watcher handles it; saying otherwise teaches the wrong mental model.

## When in doubt

Skim `references/examples.md` before composing a new tool — most user requests map onto one of the patterns there with two field changes. The schema reference is for edge cases and validation debugging.
