# The Pier skill

Pier ships with a Claude Code skill that lets you add, edit, and remove tools by talking to Claude instead of hand-editing `~/.pier/tools.json`.

> "Add this ffmpeg script to Pier" → Claude writes the entry, validates it against the schema, and saves. Pier hot-reloads within a second.

## What it is

A skill is a small instruction file Claude Code reads when it detects a relevant request. The Pier skill teaches Claude:

- The exact shape of a tool entry (`id`, `name`, `command`, `parameters`, …)
- The validation rules that crash config load if violated
- How to resolve binaries to absolute paths
- The conventions Pier follows (no shell, no bare commands, kebab-case ids, advanced disclosure, etc.)

It lives at `plugin/skills/pier/SKILL.md` in this repo, with worked examples in `references/examples.md` and the full schema in `references/schema.md`.

## What it can do

- **Add** a new tool — including resolving the binary path, picking parameter types, wiring `{placeholders}`, and choosing sensible defaults.
- **Edit** an existing tool — change a flag, add a parameter, swap the command, mark a parameter `advanced`.
- **Remove** a tool by `id` or by description ("the ffmpeg one").
- **List / inspect** the current registry without dumping raw JSON.
- **Wrap secrets** through macOS Keychain (`${keychain:NAME}`) or `.env` files instead of inline strings.

It will *not* touch `~/.pier/audit.log`, restart the app (no need — file watcher), or seed `~/.pier/tools.json` if it's missing (launch Pier once first).

## How to use it

The skill auto-activates when your prompt to Claude Code mentions Pier or sounds like a tool registration. No `/command` to type. Examples that trigger it:

- "Add this script to Pier"
- "Make a Pier tile for `yt-dlp` that takes a URL"
- "Remove the screenshot tool"
- "Show me my Pier tools"
- "The ffmpeg tile — add a bitrate field, mark it advanced"

You can also invoke it explicitly: "Use the Pier skill to …".

If you're writing a fresh CLI in the same session, just say "make this easy to run" — the skill description is broad enough that Claude will offer to wire it up as a Pier tile.

## Where Pier stores things

| Path | Purpose | Edit by hand? |
|---|---|---|
| `~/.pier/tools.json` | Tool registry. Hot-reloaded on save. | Yes (or via the skill) |
| `~/.pier/audit.log` | Append-only JSONL of every run. | Never |
| `plugin/skills/pier/SKILL.md` | The skill itself. | Only when changing skill behavior |

## Limits worth knowing

- Pier launches subprocesses with **only** the env you give it — no inherited shell. Set `cwd` and `envFile: ".env"` for most projects.
- Bare commands (`"command": "ffmpeg"`) fail. The skill always resolves an absolute path with `which`.
- The legacy `inputType` field is rejected on load. The skill won't write it; if you have an old file, ask Claude to migrate it.
- Required parameters should not be marked `advanced` — keep the default panel usable.

## Troubleshooting

- **"Pier rejected my tools.json"** — ask Claude "validate my Pier config" and it'll diff against the rules in `SKILL.md`.
- **"My tool didn't show up"** — check that Pier is running; the file watcher only runs when the app is open.
- **"The skill didn't trigger"** — say "use the Pier skill" explicitly, or mention "Pier" / "tools.json" in the prompt.

## See also

- [`plugin/skills/pier/SKILL.md`](../plugin/skills/pier/SKILL.md) — the skill itself
- [`plugin/skills/pier/references/examples.md`](../plugin/skills/pier/references/examples.md) — five copy-pasteable patterns
- [`plugin/skills/pier/references/schema.md`](../plugin/skills/pier/references/schema.md) — full schema reference
- [`examples/tools.json`](../examples/tools.json) — runnable example registry
