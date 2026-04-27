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
  confirm?: boolean,        // default false; prompts before running
  shell?: boolean,          // default false; runs through a shell if true
  cwd?: string,             // working directory
  envFile?: string,        // path to .env (relative paths resolve against cwd)
  env?: Record<string,string>,  // inline overrides; ${keychain:X}, ${env:X} supported
  category?: string         // free-form group label
}
```

## Parameter — common base

```ts
{
  id: string,             // required, unique within the tool
  label: string,          // required, UI label shown above the input
  help?: string,          // one-line hint shown under the field
  optional?: boolean,     // user may leave blank
  advanced?: boolean,     // hide behind the "Advanced" disclosure in the run panel
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
9. Each parameter must have a non-empty `label` string.
10. Parameter `type` must be one of: `file`, `folder`, `text`, `url`, `select`, `boolean`, `number`.
11. Every `{name}` placeholder in `args` must reference a defined parameter `id`.
12. `select.options` must be `string[]`. `select.default`, if set, must be in `options`.
13. `number.default`, `min`, `max`, `step` must be numbers.
14. `boolean.default` must be a boolean.
15. `file/folder/text/url` defaults must be strings.

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

## Defaults (optional, top-level)

```ts
{
  cwd?: string,
  envFile?: string,
  env?: Record<string,string>
}
```

Per-tool fields override these. Resolution order at spawn time:
1. process env
2. defaults.envFile
3. tool.envFile
4. defaults.env (interpolated)
5. tool.env (interpolated)

A `${keychain:X}` or `${env:X}` reference that can't be resolved drops the var entirely (the tool sees a missing var, not an empty string).

**Scope of `${env:X}`:** resolves against Pier's *own* process env at spawn time. It does **not** see vars introduced by an `envFile` in the same tool. If you need a value from your `.env`, name the var directly in the env block — don't try to chain `${env:FROM_DOTENV}`.

## Audit log env recording

Each `start` entry includes `env_keys`: a map of var name → source tag (`process | envfile | envblock | keychain | hostenv`). Values are never recorded.

## Audit log

`~/.pier/audit.log` is JSONL of every run (`run_id`, tool id, exit status, timestamps). Read-only. Never edit.

## Defaults file

If `~/.pier/tools.json` is missing on first launch, Pier seeds it from its built-in defaults (two starter tools). Don't try to seed it yourself — let the app do it.
