# Non-Tech-Friendly Tool Runner — Design

Date: 2026-04-26
Status: Draft for review

## Problem

A non-technical user opening a tool like "Dub video to Japanese" sees three labeled fields:

- `INPUT` — a drop zone (clear enough)
- `PROVIDER` — a select containing `mlx_qwen3` (opaque jargon)
- `CLEAN` — a checkbox whose label is the same word as the field (`☐ CLEAN`) and gives no clue what gets cleaned

The visual hierarchy is good. The *language* and *information density* are not. Every parameter is presented with equal weight, defaults are not surfaced, and labels are derived from raw schema `id`s when authors omit `label`. The all-caps mono treatment, while stylish, slows reading for end users.

## Goals

1. End users can run a tool without understanding implementation details (model names, CLI flags).
2. Tool authors are nudged toward writing human-readable labels and help text.
3. Defaults are visible without being obtrusive — the user sees what's about to happen but is not asked to think about it.

## Non-goals

- Per-user personalization, saved presets, or parameter history.
- A separate "author mode" UI. The same UI serves both; the schema does the disambiguation.
- Localization / i18n (out of scope for v0.1).

## Approach

Two changes work together:

1. **Schema changes** that force tool authors to write human-readable labels and let them mark fields as advanced.
2. **UI changes** that demote advanced fields into a single collapsed disclosure, summarizing their current values when closed, and switch end-user labels to sentence case.

## Schema changes

`Parameter` (TypeScript: `src/domain/tool.ts`; Rust mirror: `src-tauri/src/domain/tool.rs`):

| Field | Before | After |
|---|---|---|
| `label` | optional string, fell back to `id.toUpperCase().replace(/[-_]/g," ")` | **required** string |
| `description` | optional sub-text on the parameter | **renamed to `help`** (same semantics, clearer name) |
| `advanced` | — | new optional boolean, default `false` |

`label` is required because the previous fallback produced labels like `BITRATE` and `MLX_QWEN3` that read as jargon. Pre-launch, we have no users to migrate, so the schema can break.

`description` is renamed to `help` on parameters. The tool itself still has `description` (its tagline). Two different meanings of `description` at two levels invites confusion for both human contributors and LLM-generated configs. `help` is unambiguous.

`advanced: true` opts a parameter into the collapsed disclosure. Independent of `optional` — a field can be required-but-rarely-touched (advanced) or optional-but-prominent. The author chooses.

### Validation

`validateTool` (TS) and the Rust domain constructor reject any parameter missing a `label`. The error message names the parameter id so the author can find it in `tools.json`.

## UI changes

### `ParamField` (`src/ui/molecules/ParamField.tsx`)

- Drop the `01 / 02 / 03` ordinal column. The ordinal added cognitive load in user testing context (per discussion); it is preserved conceptually if we ever build a dedicated debug/author surface.
- Label rendering switches from `font-mono uppercase tracking-[0.16em] text-[11px]` to display-font sentence case at body size. The mono-caps treatment stays on the page eyebrow and the command preview in `ConfirmDialog` — those are author/debug surfaces.
- Help text (formerly `description`) renders as regular-weight sentence-case sub-text under the input, no italic. Italics read as "aside"; help is primary guidance and should not be visually deprioritized.
- The optional indicator (`◦ optional`) stays for fields that are `optional: true` but not `advanced` (i.e. visible-but-skippable).

### New molecule: `AdvancedDisclosure` (`src/ui/molecules/AdvancedDisclosure.tsx`)

Renders a single collapsible group containing all `advanced: true` parameters of a tool.

- Closed state: a single line styled like a parameter row, reading e.g. *"Advanced options · Voice model: mlx_qwen3 · Clean audio: off"*. Clicking expands.
- Open state: each advanced parameter renders via `ParamField` exactly as a top-level field would.
- The summary string is built by a pure helper `summarizeAdvanced(params, values)` (see below) so the truncation logic is unit-testable.

### `ToolRunner` (`src/ui/organisms/ToolRunner.tsx`)

- Partition parameters into `required = params.filter(p => !p.advanced)` and `advanced = params.filter(p => p.advanced)`.
- Render `required` as today (a vertical stack of `ParamField`s).
- If `advanced.length > 0`, render `<AdvancedDisclosure params={advanced} values={values} onChange={setValue} />` below the required fields.
- The `canRun` calculation is unchanged — it still walks all params and treats `optional` as the skip signal.

### Summary helper: `summarizeAdvanced(params, values)`

Lives in `src/application/summarizeAdvanced.ts` (pure, no React, no Tauri).

Algorithm:

1. For each param in order, compute `"<label>: <displayValue(value)>"`.
2. `displayValue` rules:
   - `boolean` → `"on"` / `"off"`
   - `select` → the value as-is
   - `text` / `url` / `number` → the value as-is, truncated to 20 chars with ellipsis
   - `file` / `folder` → basename only
   - empty / unset → `"—"`
3. Join with `" · "` and prefix with `"Advanced options · "`.
4. If the joined string exceeds 80 chars, truncate from the right at a `·` boundary and append `" · +N more"` where N is the count of trimmed entries.

Examples:
- 2 fields, short values → `"Advanced options · Voice model: mlx_qwen3 · Clean audio: off"`
- 5 fields, long values → `"Advanced options · Voice model: mlx_qwen3 · Clean audio: off · +3 more"`

## Seed examples rewrite (`examples/tools.json`)

All seed tools updated to demonstrate the new schema. Concretely:

- Every parameter gets a sentence-case `label` and a one-sentence `help`.
- `ffmpeg-convert` marks `format`, `bitrate`, `verbose` as `advanced: true`. The `input` (file) stays as the only top-level field.
- A new "Dub video" entry (matching the screenshot) is added to seed examples — required = video drop; advanced = voice model + clean-audio toggle.
- `hello`, `file-info`, `url-headers`: minor label/help additions so they read as user-facing tools.

The first-run seeded `~/.pier/tools.json` (handled by the loader's "seed defaults if missing" path) uses the same content.

## Backend

The Rust `Parameter` struct mirrors the TS change: `label: String` (was `Option<String>`), `description` field renamed to `help`, new `advanced: bool` (serde default = false). Loader rejects parameters missing `label` with a structured error. No changes to the run pipeline — `argTemplate` and `subprocess.rs` operate on values, not labels.

## Tests

TypeScript (Vitest):
- `summarizeAdvanced.test.ts` — boolean rendering, file basename, number/text truncation, join, 80-char overflow with `+N more`, empty values.
- `validation.test.ts` — adds a case rejecting a parameter missing `label`.
- `ToolRunner.test.tsx` — renders required fields above the disclosure; advanced fields are not in the DOM until the disclosure opens; values typed into an advanced field persist across collapse/expand.
- `ParamField.test.tsx` (if it exists; otherwise add) — confirms label is sentence case and ordinal column is gone.

Rust:
- `domain::tool` test rejecting a `Parameter` missing `label` and accepting one with `advanced = true`.

## Migration / breaking changes

- Pre-launch, no published users. The schema breaks freely.
- Any local `~/.pier/tools.json` someone has authored during development needs `label` added to every parameter and `description` renamed to `help`. The validator's error message names the parameter id and the missing field, so the fix is mechanical.

## Out of scope (explicit follow-ups)

- Per-tool "Reset to defaults" affordance inside the disclosure.
- Remembering the disclosure open/closed state across runs.
- A `placeholder` or `example` field on parameters (potential future siblings of `help`).
- Locale-specific labels/help.

## File touch list

New:
- `src/application/summarizeAdvanced.ts`
- `src/application/__tests__/summarizeAdvanced.test.ts`
- `src/ui/molecules/AdvancedDisclosure.tsx`

Modified:
- `src/domain/tool.ts` — `label` required, rename `description`→`help`, add `advanced`.
- `src/domain/validation.ts` — enforce `label`.
- `src/domain/__tests__/validation.test.ts`
- `src/ui/molecules/ParamField.tsx` — drop ordinal, sentence-case label, regular-weight help.
- `src/ui/organisms/ToolRunner.tsx` — partition + render disclosure.
- `src/ui/organisms/__tests__/ToolRunner.test.tsx`
- `src-tauri/src/domain/tool.rs` — mirror schema; reject missing label.
- `examples/tools.json` — rewrite all entries; add Dub example.
