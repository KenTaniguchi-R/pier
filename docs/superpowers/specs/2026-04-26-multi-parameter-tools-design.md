# Multi-Parameter Tools — Design

**Status:** approved (auto-mode)
**Date:** 2026-04-26
**Author:** Ryusei + Claude

## Problem

Pier's `tools.json` schema supports exactly one input per tool (`inputType: "file" | "text" | "url" | "folder" | "none"` plus a single `{input}` placeholder). Real CLIs that Claude Code generates routinely take an input + a format + flags + an optional bitrate/quality/etc. Today the only workaround is a shell wrapper or one tile per preset. This spec extends the schema and runner to support multiple, typed, optional parameters with selectable values, while preserving Pier's editorial aesthetic.

## Design Decisions (locked)

1. **Hard schema migration.** `inputType` is removed. Every tool declares `parameters: Parameter[]` (or omits it for no-input tools). Old configs fail validation with a clear message. Rationale: v0.1 self-dogfood, no users to grandfather, dual code paths rot.
2. **Tight type set.** Ship `file, folder, text, url, select, boolean, number`. Defer `files (multi)`, `clipboard`, `secret`, `enum-from-command`, `date`, `json` to a later round. The `Parameter` union stays open for extension.
3. **Per-param `flag` field for optional CLI flags.** When set, value is emitted as `[flag, value]` (or `[flag]` alone for booleans). When unset/empty, nothing is emitted. Avoids the `-b:v ""` problem without inventing a templating mini-language.

## Schema (domain)

```ts
type ParamType = "file" | "folder" | "text" | "url" | "select" | "boolean" | "number";

interface ParameterBase {
  id: string;                      // unique within tool; used as {id} in args
  label?: string;                  // form label; defaults to humanized id
  description?: string;            // helper text under the field
  optional?: boolean;              // default false
  default?: string | number | boolean;
  flag?: string;                   // e.g. "-b:v" — emitted as ["<flag>", "<value>"] when set
}

interface FileParam     extends ParameterBase { type: "file"; accepts?: string[] }
interface FolderParam   extends ParameterBase { type: "folder" }
interface TextParam     extends ParameterBase { type: "text"; multiline?: boolean }
interface UrlParam      extends ParameterBase { type: "url" }
interface SelectParam   extends ParameterBase { type: "select"; options: string[] }
interface BooleanParam  extends ParameterBase { type: "boolean" }
interface NumberParam   extends ParameterBase { type: "number"; min?: number; max?: number; step?: number }

type Parameter = FileParam | FolderParam | TextParam | UrlParam | SelectParam | BooleanParam | NumberParam;

interface Tool {
  id: string; name: string; command: string;
  args?: string[];                 // positional template; supports {paramId} substitution
  parameters?: Parameter[];        // form fields, in display order
  description?: string; icon?: string; category?: string;
  timeout?: number; confirm?: boolean; shell?: boolean; cwd?: string;
}
```

Rust mirror: `Parameter` as `#[serde(tag = "type", rename_all = "lowercase")]` enum.

### Notes

- `text` covers both single-line and multi-line via `multiline: true`. No separate `textarea` type.
- `boolean` with no `flag` is meaningless; validation warns. With `flag`, `true` emits `[flag]`, `false` emits nothing.
- `default` on `select` must be one of `options`. Number `default` must respect `min`/`max`. String defaults pass through.
- A tool with no `parameters` (or `[]`) is a no-input tool; the form shows just the Run button.

## Argument Templating

Two-pass, declaration-order-stable algorithm:

1. **Positional pass.** For each entry in `tool.args`, substitute `{paramId}` placeholders with the param's current value (string-coerced). If the entry contains a placeholder for an unset/empty optional param, drop the entire entry.
2. **Flag pass.** For each parameter with `flag` set AND a non-empty value:
   - Boolean true → append `[flag]`
   - Anything else → append `[flag, String(value)]`
   Append in `parameters[]` declaration order, after the positional args.

A param can have **either or both** `flag` and a positional `{id}` reference — but typically only one. Validation flags overlap as a warning, not an error.

### Implementation

- `src/application/argTemplate.ts` — pure TS (used by ConfirmDialog preview + tests).
- `src-tauri/src/application/arg_template.rs` — pure Rust (authoritative at run time).
- Both share an identical algorithm and snapshot tests.

## RunRequest

```ts
interface RunRequest {
  toolId: string;
  values: Record<string, string | number | boolean>;
}
```

Rust mirror: `HashMap<String, serde_json::Value>`. Validation at the runner boundary ensures the shape matches the tool's declared parameters.

## UI Design — "Specification Sheet"

The form is the heart of this feature. Pier's existing visual language is **editorial-minimal warm paper** (Fraunces serif display, Manrope body, JetBrains Mono eyebrows, tomato accent on cream). The form must feel like a continuation of that language — not a stack of generic Material-style fields.

### Concept

Each parameter renders as a **numbered entry**, like a film credits list or a tasting menu. Mono counter on the left in the eyebrow style, label in mono caps, hairline rule, the field, optional italic-serif helper text. Generous vertical rhythm. The required/optional distinction reads as typographic weight, not asterisks or red.

### Anatomy of one parameter row

```
┌─────────────────────────────────────────────────────────────┐
│ 01    INPUT FILE                              ◦ optional   │
│       ─────────────────────────────────────────────         │
│       [ DropZone / TextField / Select / etc. ]              │
│       Tiny serif-italic helper text in ink-3                │
└─────────────────────────────────────────────────────────────┘
```

- **Counter** (`01`, `02`, …): `font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3`. Fixed-width column on the left (~40px). On narrow widths, collapses inline before the label.
- **Label**: `font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2`. Slightly heavier than the counter.
- **Optional marker**: right-aligned in the label row, `font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4`, prefixed with a small `◦` glyph. Required is the default state — no marker shown (less noise).
- **Hairline rule** under the label: `h-px bg-line` — anchors the row visually, matches the "Output ━━━" pattern already used in `ToolDetail`.
- **Field**: existing atoms (`DropZone`, `TextField`, `Textarea`) plus new `Select`, `Checkbox`, `NumberField`. Same border / radius / focus-ring vocabulary.
- **Description** (if any): `font-display italic text-[13px] leading-[1.45] text-ink-3`. Same italic-serif voice as tool descriptions in `ToolDetail`.

Vertical gap between rows: `gap-7` (28px). Generous, magazine-like.

### New atoms (`src/ui/atoms/`)

All match the existing `BASE + VARIANTS` pattern. All preserve the focus-ring vocabulary `focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]`.

- **`Select.tsx`** — native `<select>` styled to match `TextField`: same border, padding, radius, focus ring. Custom chevron via SVG mask in `text-ink-3`. Body font, 14px. Native rendering for the open menu (don't reinvent a popover).
- **`Checkbox.tsx`** — custom 14×14 box with hairline `border-line-hi`. Unchecked: empty cream (`bg-surface`). Checked: `bg-accent` with a hairline white check glyph (`✓` via SVG, 8px). Inline with a mono-caps label. Hover: `border-ink-4`. Focus: same accent ring as TextField, applied to the box.
- **`NumberField.tsx`** — wraps `TextField` with `inputMode="numeric"` and `font-mono tabular-nums text-right`. Min/max/step plumbed through to the underlying `<input type="number">`. Helper text auto-includes the range when min/max are set (`12 – 320`).

### New molecule (`src/ui/molecules/`)

- **`ParamField.tsx`** — owns the row layout (counter, label, optional marker, hairline, field, description). Switches on `param.type` and delegates to the right atom or existing `DropZone`. Props: `{ param: Parameter, index: number, value: ParamValue, onChange: (v: ParamValue) => void }`. No state of its own.

### Refactored organism

- **`ToolRunner.tsx`** absorbs the form responsibility. The current `inputType` switch is deleted. Replaced with:
  - Local `values: Record<string, ParamValue>` initialized from each param's `default` (or empty).
  - A `<ParamField>` per entry in `tool.parameters ?? []`.
  - `canRun` = every required param has a non-empty value AND no run is in flight.
  - `argTemplate(tool, values)` is called once for the ConfirmDialog preview.
  - Run dispatch passes `values` (not the old `input`) through the runner port.

### Run footer

Hairline `bg-line` separator above the existing right-aligned Run button. Same `Button variant="primary"` — preserves the current visual end-of-form punctuation.

### Empty / no-param tools

A tool with no parameters renders just the footer (Run button + hairline). No empty "Parameters" header, no placeholder text. Matches today's `inputType: "none"` UX.

### Animation

Each `ParamField` gets `animate-tile-in` with a staggered `style={{ animationDelay: index * 30ms }}` — same easing as the existing tile reveals. Subtle. Reads as the form "settling in" when the user opens a tool.

### Validation states

- **Required-empty + user pressed Run**: field's border ring momentarily shifts to `border-accent` for 600ms, then settles. No red, no error label. Pier already uses tomato as its sole accent — this stays consistent.
- **Schema-level errors** (config fails to load) surface through the existing `configErrors` channel — out of scope for this spec.

## Validation (`validation.ts`)

Extended to:

1. Walk `tool.parameters`, validate each entry's shape per `type` (e.g. `select` requires `options: string[]`; `number` rejects non-numeric `default`).
2. Reject duplicate `id` values within a tool.
3. Verify every `{name}` placeholder in `tool.args` references an existing param `id`.
4. Verify `default` matches the param's type. For `select`, `default` must be in `options`. For `number`, must respect `min`/`max`.
5. Warn (not error) when a `boolean` param has no `flag` (the value would be unobservable).

## Files Changed / Added

```
src/domain/tool.ts                              (rewrite: Parameter union + Tool)
src/domain/runRequest.ts                        (values map)
src/domain/validation.ts                        (per-param validation)
src/domain/__tests__/validation.test.ts         (extend)
src/application/argTemplate.ts                  (NEW — pure)
src/application/__tests__/argTemplate.test.ts   (NEW)
src/application/ports.ts                        (RunRequest type ripple)
src/infrastructure/tauriCommandRunner.ts        (pass values through invoke)
src/ui/atoms/Select.tsx                         (NEW)
src/ui/atoms/Checkbox.tsx                       (NEW)
src/ui/atoms/NumberField.tsx                    (NEW)
src/ui/molecules/ParamField.tsx                 (NEW)
src/ui/organisms/ToolRunner.tsx                 (rewrite — form)
src/ui/organisms/ToolDetail.tsx                 (eyebrow no longer reads inputType)
src/ui/molecules/ConfirmDialog.tsx              (uses argTemplate for preview)
src/application/loadConfig.ts                   (default seed → new schema)

src-tauri/src/domain/tool.rs                    (Parameter enum + Tool rewrite)
src-tauri/src/domain/run.rs                     (values map)
src-tauri/src/application/arg_template.rs       (NEW — pure)
src-tauri/src/application/run_tool.rs           (use arg_template)
src-tauri/src/commands.rs                       (request shape)

examples/tools.json                             (rewrite + multi-param example)
```

Net: 3 new atoms, 1 new molecule, 2 mirrored pure modules, rewrites to existing domain/runner/form files. No new state slice, no new context, no new Tauri command.

## Tests

- **`argTemplate` (TS + Rust)**: positional substitution, optional drop, flag emission for set / unset / boolean true / boolean false, declaration-order stability, mixed flag+positional.
- **`validation`**: each param type's required fields, duplicate ids, unknown `{name}` placeholder references, default-type mismatches, `default` not in `options`.
- **`ToolRunner`**: required-param gating disables Run; values flow into the runner; all parameter widget types render and accept input; ConfirmDialog preview matches `argTemplate` output.
- **Atom unit tests**: `Select`, `Checkbox`, `NumberField` — render, change events, disabled state.

## Out of Scope

- `files` (multi-file picker with ordering)
- `clipboard` button
- `secret` (masked + audit-log redaction)
- `enum-from-command` (dynamic options from a shell command)
- `date` / `datetime`
- `json` (validated structured input)

All deferred. The `Parameter` union is open; adding a new variant is a localized change.

## Migration

`examples/tools.json` and the seeded default in `loadConfig.ts` are rewritten to the new schema. The user (sole v0.1 user) re-edits their personal `~/.pier/tools.json` once. Validation messages name the offending field and link to the new schema doc.
