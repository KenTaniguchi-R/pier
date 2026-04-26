# Pier `tools.json` schema reference

Authoritative reference. Source of truth: `src/domain/tool.ts` and `src/domain/validation.ts` in the Pier repo.

## Top level

```ts
{
  schemaVersion: "1.0",   // literal — required
  tools: Tool[]           // required, may be empty
}
```

## Tool

```ts
{
  id: string,               // required, kebab-case, unique in the file
  name: string,             // required, display name
  command: string,          // required, ABSOLUTE path to the binary
  args?: string[],          // optional; "{paramId}" placeholders allowed
  parameters?: Parameter[], // optional; defines UI inputs
  description?: string,
  icon?: string,            // emoji or short string
  timeout?: number,         // seconds
  outputPath?: string,      // path Pier reads to surface a result file
  confirm?: boolean,        // default false; prompts before running
  shell?: boolean,          // default false; runs through a shell if true
  cwd?: string,             // working directory
  category?: string         // free-form group label
}
```

## Parameter — common base

```ts
{
  id: string,             // required, unique within the tool
  label?: string,         // UI label; defaults to id
  description?: string,
  optional?: boolean,     // user may leave blank
  default?: ParamValue,
  flag?: string           // CLI flag prepended when this param has a value
}
```

When a parameter has `flag`, Pier inserts `<flag> <value>` (or for booleans, just `<flag>` when checked) into the command line. You normally do **not** also reference such a parameter as a `{placeholder}` in `args`.

## Parameter types

```ts
FileParam     = { ...base, type: "file",   accepts?: string[] }
FolderParam   = { ...base, type: "folder" }
TextParam     = { ...base, type: "text",   multiline?: boolean }
UrlParam      = { ...base, type: "url" }
SelectParam   = { ...base, type: "select", options: string[] }   // options required
BooleanParam  = { ...base, type: "boolean" }
NumberParam   = { ...base, type: "number", min?: number, max?: number, step?: number }
```

## Validation rules

The validator rejects the whole file (no partial load) when any of these fail:

1. Root must be an object.
2. `schemaVersion` must equal `"1.0"`.
3. `tools` must be an array.
4. Each tool must have `id`, `name`, `command` as non-empty strings.
5. Tool `id`s must be unique.
6. The legacy field `inputType` is rejected with an explicit error.
7. `parameters`, if present, must be an array.
8. Parameter `id`s must be unique within a tool.
9. Parameter `type` must be one of: `file`, `folder`, `text`, `url`, `select`, `boolean`, `number`.
10. Every `{name}` placeholder in `args` must reference a defined parameter `id`.
11. `select.options` must be `string[]`. `select.default`, if set, must be in `options`.
12. `number.default`, `min`, `max`, `step` must be numbers.
13. `boolean.default` must be a boolean.
14. `file/folder/text/url` defaults must be strings.

## Placeholder substitution

- `{paramId}` in `args` is replaced with the user's input as a single argument.
- File and folder values are absolute paths.
- Boolean, number, and select values are stringified.
- A boolean parameter with a `flag` is handled implicitly — see above.
- Optional parameters bound by `flag` are omitted entirely (flag and value) when blank.

## File location and writes

- Path: `~/.pier/tools.json`.
- Watcher: `notify` in the Rust backend reloads the config on save (debounced).
- Encoding: UTF-8, 2-space indent, trailing newline. Pier doesn't enforce style, but matching it keeps git diffs sane.

## Audit log

`~/.pier/audit.log` is JSONL of every run (`run_id`, tool id, exit status, timestamps). Read-only. Never edit.

## Defaults file

If `~/.pier/tools.json` is missing on first launch, Pier seeds it from its built-in defaults (two starter tools). Don't try to seed it yourself — let the app do it.
