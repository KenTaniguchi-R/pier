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
  "parameters": [{ "id": "input", "type": "file" }],
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
  "parameters": [{ "id": "url", "type": "url" }],
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
    { "id": "input",   "type": "file",   "accepts": [".mov", ".mp4", ".webm"] },
    { "id": "format",  "type": "select", "options": ["mp4", "webm", "mov"], "default": "mp4" },
    { "id": "bitrate", "type": "text",   "flag": "-b:v", "optional": true, "description": "e.g. 5000k" },
    { "id": "verbose", "type": "boolean","flag": "-v",   "optional": true }
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
    { "id": "folder", "type": "folder" },
    { "id": "size",   "type": "number", "default": 100, "min": 1, "step": 10 }
  ],
  "icon": "🔍",
  "category": "files"
}
```

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
