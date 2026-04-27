# Pier tool examples

Five patterns that cover the common shapes. Mix and match.

## 1. Zero-input — just runs

```json
{
  "id": "hello",
  "name": "Say hello",
  "command": "/bin/echo",
  "args": ["Welcome to Pier"],
  "icon": "👋",
  "category": "starter"
}
```

No `parameters` block. Click Run, see output.

## 2. Single file drop

```json
{
  "id": "file-info",
  "name": "What's this file?",
  "command": "/usr/bin/file",
  "args": ["{input}"],
  "parameters": [{ "id": "input", "label": "File", "type": "file" }],
  "description": "Drop any file to see what kind it is.",
  "icon": "📄"
}
```

The `{input}` placeholder is replaced with the dropped file's absolute path.

## 3. URL field

```json
{
  "id": "url-headers",
  "name": "URL headers",
  "command": "/usr/bin/curl",
  "args": ["-I", "-s", "{url}"],
  "parameters": [{ "id": "url", "label": "URL", "type": "url" }],
  "icon": "🌐",
  "category": "web"
}
```

## 4. Multi-parameter — file + select + optional flag + boolean flag

```json
{
  "id": "ffmpeg-convert",
  "name": "Convert video",
  "command": "/opt/homebrew/bin/ffmpeg",
  "args": ["-y", "-i", "{input}", "out.{format}"],
  "parameters": [
    { "id": "input",   "label": "Video",   "type": "file",   "accepts": [".mov", ".mp4", ".webm"] },
    { "id": "format",  "label": "Format",  "type": "select", "options": ["mp4", "webm", "mov"], "default": "mp4" },
    { "id": "bitrate", "label": "Bitrate", "type": "text",   "flag": "-b:v", "optional": true, "advanced": true, "help": "e.g. 5000k" },
    { "id": "verbose", "label": "Verbose", "type": "boolean","flag": "-v",   "optional": true, "advanced": true }
  ],
  "icon": "🎬",
  "category": "media",
  "confirm": true
}
```

Notes:
- `bitrate` has a `flag`, so when filled Pier appends `-b:v <value>` automatically. When blank (because `optional: true`), both the flag and value are dropped.
- `verbose` is a boolean with a flag — checked = `-v` appended, unchecked = nothing. No `{verbose}` placeholder needed.
- `confirm: true` because video transcodes are expensive.

## 5. Folder + numeric input

```json
{
  "id": "find-large",
  "name": "Find large files",
  "command": "/usr/bin/find",
  "args": ["{folder}", "-type", "f", "-size", "+{size}M"],
  "parameters": [
    { "id": "folder", "label": "Folder",      "type": "folder" },
    { "id": "size",   "label": "Min size MB", "type": "number", "default": 100, "min": 1, "step": 10 }
  ],
  "icon": "🔍",
  "category": "files"
}
```

## 6. Project with a `.env` file

```json
{
  "id": "dubjp",
  "name": "Dub video to Japanese",
  "command": "/Users/you/coding/dubjp/.venv/bin/dubjp",
  "args": ["{input}"],
  "parameters": [{ "id": "input", "label": "Video", "type": "file" }],
  "cwd": "/Users/you/coding/dubjp",
  "envFile": ".env",
  "icon": "🎙️",
  "category": "media",
  "confirm": true
}
```

`dubjp` reads `GEMINI_API_KEY` etc. from its project `.env`. Pier loads the file once per spawn and merges it into the child env.

## 7. Inline secret from macOS Keychain

```json
{
  "id": "ask-openai",
  "name": "Ask OpenAI",
  "command": "/Users/you/.local/bin/oai",
  "args": ["{prompt}"],
  "parameters": [{ "id": "prompt", "label": "Prompt", "type": "text", "multiline": true }],
  "env": { "OPENAI_API_KEY": "${keychain:openai}" }
}
```

One-time setup:

```bash
security add-generic-password -s pier -a openai -w
```

The key never appears in `tools.json` or in the audit log.

## 8. Wrap with another env tool (direnv / 1Password / mise / sops)

When you need an existing secret manager, don't invent a Pier feature — wrap:

```json
{
  "command": "/opt/homebrew/bin/op",
  "args": ["run", "--env-file=.env", "--", "/path/to/tool", "{input}"],
  "cwd": "/path/to/project",
  "parameters": [{ "id": "input", "label": "File", "type": "file" }]
}
```

Same pattern works for `direnv exec . --`, `mise exec --`, `dotenvx run --`, etc.

## Picking absolute paths quickly

```bash
which ffmpeg     # /opt/homebrew/bin/ffmpeg on Apple silicon
which jq         # /opt/homebrew/bin/jq
command -v rg    # works for shell builtins too
```

If the user's `command` resolves to multiple paths, pick the Homebrew one on macOS.

## Adding to the file safely

The whole file looks like:

```json
{
  "schemaVersion": "1.0",
  "tools": [
    { ... existing ... },
    { ... your new tool ... }
  ]
}
```

Append to the `tools` array. Keep `schemaVersion` as `"1.0"`. 2-space indent, trailing newline.
