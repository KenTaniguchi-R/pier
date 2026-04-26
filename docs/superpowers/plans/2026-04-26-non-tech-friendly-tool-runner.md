# Non-Tech-Friendly Tool Runner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pier's tool-runner UI legible to non-technical users by requiring human-readable parameter labels, demoting rarely-used parameters into a collapsible "Advanced options" group that summarizes its values, and rewriting seed examples in plain English.

**Architecture:** Schema additions on both TS (`src/domain/tool.ts`) and Rust (`src-tauri/src/domain/tool.rs`) sides — `label` becomes required, `description` on parameters renames to `help`, and a new `advanced` boolean opts a parameter into the disclosure. Validation enforces `label`. UI gains a new pure helper `summarizeAdvanced` and a new molecule `AdvancedDisclosure`; `ToolRunner` partitions parameters into required vs. advanced; `ParamField` drops the ordinal column and switches to sentence-case labels. Seed `examples/tools.json` is rewritten to demonstrate the new shape.

**Tech Stack:** TypeScript + React 19 + Vitest + jsdom (frontend); Rust + serde + cargo test (backend); Tailwind v4 CSS-first.

**Spec:** `docs/superpowers/specs/2026-04-26-non-tech-friendly-tool-runner-design.md`

---

## File Structure

**New files:**
- `src/application/summarizeAdvanced.ts` — pure helper: `(params, values) => string` for the disclosure summary line.
- `src/application/__tests__/summarizeAdvanced.test.ts`
- `src/ui/molecules/AdvancedDisclosure.tsx` — collapsible group rendering advanced params; closed state shows summary.

**Modified files:**
- `src/domain/tool.ts` — `label` required on `ParameterBase`; rename `description`→`help`; add `advanced?: boolean`.
- `src/domain/validation.ts` — enforce `label` in `parseParam`; treat `help` field same as today's `description` (no validation needed since it's optional free text); allow `advanced` boolean.
- `src/domain/__tests__/validation.test.ts` — new cases.
- `src/ui/molecules/ParamField.tsx` — remove ordinal column, sentence-case label, regular-weight help text.
- `src/ui/organisms/ToolRunner.tsx` — partition required vs. advanced; render `AdvancedDisclosure` below required fields.
- `src/ui/organisms/__tests__/ToolRunner.test.tsx` — update existing tests to provide `label`; add new tests for advanced partitioning.
- `src-tauri/src/domain/tool.rs` — `label: String` (required), rename `description`→`help`, add `advanced: Option<bool>`; add Rust tests.
- `examples/tools.json` — rewrite all entries with labels, help, advanced markers; add a "Dub video" example.

---

## Task 1: Add `advanced` and rename `description`→`help` in TS schema (no validation yet)

This task changes the TypeScript types and ParamField rendering of `help` so the UI builds against the new shape, but does not yet enforce `label` (Task 4). Splitting prevents a giant red wave of failing tests.

**Files:**
- Modify: `src/domain/tool.ts`
- Modify: `src/ui/molecules/ParamField.tsx`

- [ ] **Step 1: Update `ParameterBase` in `src/domain/tool.ts`**

Replace the `ParameterBase` interface (currently lines 5-12) with:

```typescript
interface ParameterBase {
  id: string;
  label: string;
  help?: string;
  optional?: boolean;
  advanced?: boolean;
  default?: ParamValue;
  flag?: string;
}
```

Note: `label` becomes required (no `?`); `description` is removed in favor of `help`; `advanced?: boolean` added.

- [ ] **Step 2: Update `ParamField.tsx` to read `help` and use the required label directly**

In `src/ui/molecules/ParamField.tsx`, replace the `paramLabel` helper (line 16) with a direct read of `param.label`, and rewrite the body so:
- The ordinal `<span>` (the `01 / 02 / 03` column) is removed.
- The label uses display-font sentence case at body size.
- `param.help` (was `param.description`) renders as regular-weight (no italic) sub-text under the input.

Replace the entire file contents with:

```tsx
import type { Parameter, ParamValue } from "../../domain/tool";
import { TextField } from "../atoms/TextField";
import { Textarea } from "../atoms/Textarea";
import { Select } from "../atoms/Select";
import { Checkbox } from "../atoms/Checkbox";
import { NumberField } from "../atoms/NumberField";
import { DropZone } from "./DropZone";

interface Props {
  param: Parameter;
  index: number;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
}

export function ParamField({ param, index, value, onChange }: Props) {
  return (
    <div
      className="flex flex-col gap-2 animate-tile-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-[15px] font-medium leading-tight text-ink">
          {param.label}
        </span>
        <span className="flex-1 h-px bg-line" />
        {param.optional && !param.advanced && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            ◦ optional
          </span>
        )}
      </div>

      <ParamWidget param={param} value={value} onChange={onChange} label={param.label} />

      {param.help && (
        <span className="font-display text-[13px] leading-[1.45] text-ink-3">
          {param.help}
        </span>
      )}
    </div>
  );
}

interface WidgetProps {
  param: Parameter;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
  label: string;
}

function ParamWidget({ param: p, value, onChange, label }: WidgetProps) {
  const str = (value ?? "") as string;

  switch (p.type) {
    case "file":
      return (
        <DropZone
          accepts={p.accepts}
          onDrop={onChange}
          label={str ? str.split("/").pop() : undefined}
        />
      );
    case "folder":
      return <DropZone directory onDrop={onChange} label={str || undefined} />;
    case "text":
      return p.multiline ? (
        <Textarea value={str} onChange={e => onChange(e.target.value)} placeholder="Paste text…" />
      ) : (
        <TextField value={str} onChange={e => onChange(e.target.value)} />
      );
    case "url":
      return (
        <TextField value={str} onChange={e => onChange(e.target.value)} placeholder="https://…" />
      );
    case "select":
      return (
        <Select
          options={p.options}
          value={str || p.options[0]}
          onChange={e => onChange(e.target.value)}
          aria-label={p.id}
        />
      );
    case "boolean":
      return (
        <Checkbox
          label={label}
          checked={value === true}
          onChange={e => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <NumberField
          aria-label={p.id}
          value={value === undefined || value === "" ? "" : (value as number)}
          min={p.min} max={p.max} step={p.step}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
  }
}
```

- [ ] **Step 3: Run typecheck — expect failures in tests/examples that lack `label`**

Run: `npm run build`
Expected: `tsc` errors in `src/ui/organisms/__tests__/ToolRunner.test.tsx` (and possibly other tests) because parameters omit the now-required `label`. This is expected — Task 2 fixes them.

Do NOT proceed past this step until the only errors are missing-`label` errors in test files. If there are unrelated errors, fix them.

- [ ] **Step 4: Commit**

```bash
git add src/domain/tool.ts src/ui/molecules/ParamField.tsx
git commit -m "feat(schema): rename param description→help, add advanced flag, drop ordinal column"
```

---

## Task 2: Update existing tests to provide `label` so the suite typechecks again

**Files:**
- Modify: `src/ui/organisms/__tests__/ToolRunner.test.tsx`
- Modify: any other `*.test.tsx` / `*.test.ts` files where `tcs` reports a missing `label`.

- [ ] **Step 1: Re-run typecheck to enumerate failing files**

Run: `npm run build 2>&1 | grep -E "error TS|tsx?:[0-9]" | sort -u`
Capture every file referenced. Each missing-`label` error is one fix.

- [ ] **Step 2: Add a `label` to every parameter literal in `ToolRunner.test.tsx`**

For each `parameters: [{ id: "<x>", type: "<y>", ... }]` literal in `src/ui/organisms/__tests__/ToolRunner.test.tsx`, add `label: "<sentence-case version>"`. Example diffs:

```tsx
parameters: [{ id: "input", type: "file" }],
// →
parameters: [{ id: "input", label: "Input file", type: "file" }],
```

```tsx
parameters: [{ id: "url", type: "url" }],
// →
parameters: [{ id: "url", label: "URL", type: "url" }],
```

```tsx
parameters: [
  { id: "fmt", type: "select", options: ["mp4", "webm"], default: "mp4" },
],
// →
parameters: [
  { id: "fmt", label: "Format", type: "select", options: ["mp4", "webm"], default: "mp4" },
],
```

- [ ] **Step 3: Apply the same `label` addition to every other test file flagged in Step 1**

For each remaining file, add `label: "<sentence-case>"` to each parameter literal. If a test file uses `as Parameter` cast on inline objects, add `label` there too.

- [ ] **Step 4: Run typecheck — expect a clean build**

Run: `npm run build`
Expected: `tsc` exits 0; `vite build` may then run — if it succeeds, all good.

- [ ] **Step 5: Run the test suite**

Run: `npm run test:run`
Expected: All tests pass. The label string change is cosmetic; existing assertions on text like `/drop a file/i` are not affected.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "test: add required label to parameter literals in tests"
```

---

## Task 3: Add `advanced` and rename `description`→`help` in Rust schema (no validation yet)

**Files:**
- Modify: `src-tauri/src/domain/tool.rs`

- [ ] **Step 1: Update `ParameterBase` struct**

In `src-tauri/src/domain/tool.rs`, replace the `ParameterBase` struct (currently lines 33-42) with:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterBase {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub help: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub optional: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub advanced: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub default: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub flag: Option<String>,
}
```

Changes:
- `label: Option<String>` → `label: String` (no `serde(default)`, no `skip_serializing_if`).
- `description: Option<String>` removed; `help: Option<String>` added in the same place.
- `advanced: Option<bool>` added below `optional`.

- [ ] **Step 2: Add `advanced` accessor on `Parameter`**

In the `impl Parameter` block (currently lines 15-31), add a new method below `optional()`:

```rust
pub fn advanced(&self) -> bool { self.base().advanced.unwrap_or(false) }
```

- [ ] **Step 3: Update existing Rust tests to include `label`**

In the `#[cfg(test)] mod tests` block, every JSON literal that defines a parameter omits `label`. Add it. Concretely:

In `parses_select_parameter`:
```rust
"parameters":[{"id":"fmt","type":"select","options":["mp4","webm"]}]
// →
"parameters":[{"id":"fmt","label":"Format","type":"select","options":["mp4","webm"]}]
```

In `parses_boolean_with_flag`:
```rust
"parameters":[{"id":"dry","type":"boolean","flag":"--dry-run"}]
// →
"parameters":[{"id":"dry","label":"Dry run","type":"boolean","flag":"--dry-run"}]
```

In `rejects_unknown_param_type`:
```rust
"parameters":[{"id":"q","type":"weird"}]
// →
"parameters":[{"id":"q","label":"Q","type":"weird"}]
```

- [ ] **Step 4: Run cargo tests — expect green**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: All tests pass.

- [ ] **Step 5: Run clippy — expect green**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
Expected: No warnings.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/
git commit -m "feat(rust schema): rename param description→help, require label, add advanced flag"
```

---

## Task 4: TS validator enforces `label` — TDD

**Files:**
- Test: `src/domain/__tests__/validation.test.ts`
- Modify: `src/domain/validation.ts`

- [ ] **Step 1: Write failing tests**

Open `src/domain/__tests__/validation.test.ts`. Append (do not replace existing tests):

```typescript
import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";

describe("parseToolsConfig — label requirement", () => {
  it("rejects a parameter that omits label", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "input", type: "file" }],
      }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => /label/.test(e) && /input/.test(e))).toBe(true);
    }
  });

  it("accepts a parameter with label", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "input", label: "Input file", type: "file" }],
      }],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a parameter with advanced: true", () => {
    const result = parseToolsConfig({
      schemaVersion: "1.0",
      tools: [{
        id: "t", name: "T", command: "/x",
        parameters: [{ id: "fmt", label: "Format", type: "select", options: ["a"], advanced: true }],
      }],
    });
    expect(result.ok).toBe(true);
  });
});
```

If the test file does not yet exist, create it with the contents above and add the standard imports. (Verify by running `ls src/domain/__tests__/` first.)

- [ ] **Step 2: Run tests, expect the new "rejects" test to fail**

Run: `npx vitest run src/domain/__tests__/validation.test.ts`
Expected: "rejects a parameter that omits label" FAILS (parser still accepts). The other two new tests pass already.

- [ ] **Step 3: Add label validation in `parseParam`**

In `src/domain/validation.ts`, inside `parseParam` (currently around line 81), add a `label` check just below the existing `id` check (line 85). The new block:

```typescript
if (typeof p.label !== "string" || !p.label) {
  errors.push(`${where}.label required string (parameter id: ${typeof p.id === "string" ? p.id : "?"})`);
}
```

Place it directly after:
```typescript
if (typeof p.id !== "string" || !p.id) errors.push(`${where}.id required string`);
```

- [ ] **Step 4: Run tests, expect green**

Run: `npx vitest run src/domain/__tests__/validation.test.ts`
Expected: All tests pass, including the new three.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: All tests pass. (If anything fails because a fixture forgot `label`, fix the fixture.)

- [ ] **Step 6: Commit**

```bash
git add src/domain/validation.ts src/domain/__tests__/validation.test.ts
git commit -m "feat(validation): require label on every parameter"
```

---

## Task 5: `summarizeAdvanced` pure helper — TDD

**Files:**
- Create: `src/application/summarizeAdvanced.ts`
- Test: `src/application/__tests__/summarizeAdvanced.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/application/__tests__/summarizeAdvanced.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { summarizeAdvanced } from "../summarizeAdvanced";
import type { Parameter, ParamValue } from "../../domain/tool";

const sel = (id: string, label: string, options: string[], advanced = true): Parameter =>
  ({ id, label, type: "select", options, advanced });
const bool = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "boolean", advanced });
const text = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "text", advanced });
const file = (id: string, label: string, advanced = true): Parameter =>
  ({ id, label, type: "file", advanced });

describe("summarizeAdvanced", () => {
  it("renders booleans as on/off", () => {
    const params = [bool("clean", "Clean audio")];
    const values: Record<string, ParamValue> = { clean: false };
    expect(summarizeAdvanced(params, values))
      .toBe("Advanced options · Clean audio: off");
  });

  it("renders selects as the chosen value", () => {
    const params = [sel("voice", "Voice model", ["mlx_qwen3", "tts_other"])];
    expect(summarizeAdvanced(params, { voice: "mlx_qwen3" }))
      .toBe("Advanced options · Voice model: mlx_qwen3");
  });

  it("joins multiple fields with ' · '", () => {
    const params = [
      sel("voice", "Voice model", ["mlx_qwen3"]),
      bool("clean", "Clean audio"),
    ];
    expect(summarizeAdvanced(params, { voice: "mlx_qwen3", clean: false }))
      .toBe("Advanced options · Voice model: mlx_qwen3 · Clean audio: off");
  });

  it("uses '—' for unset / empty values", () => {
    const params = [text("title", "Title")];
    expect(summarizeAdvanced(params, {}))
      .toBe("Advanced options · Title: —");
    expect(summarizeAdvanced(params, { title: "" }))
      .toBe("Advanced options · Title: —");
  });

  it("renders file values as basename only", () => {
    const params = [file("input", "Input")];
    expect(summarizeAdvanced(params, { input: "/Users/me/movies/x.mp4" }))
      .toBe("Advanced options · Input: x.mp4");
  });

  it("truncates long text values to 20 chars with ellipsis", () => {
    const params = [text("note", "Note")];
    expect(summarizeAdvanced(params, { note: "a".repeat(40) }))
      .toBe(`Advanced options · Note: ${"a".repeat(20)}…`);
  });

  it("when total exceeds 80 chars, trims at a · boundary and appends '+N more'", () => {
    const params = [
      text("a", "Alpha alpha alpha"),
      text("b", "Bravo bravo bravo"),
      text("c", "Charlie charlie"),
      text("d", "Delta delta delta"),
      text("e", "Echo echo echo"),
    ];
    const values = {
      a: "value-aaaa", b: "value-bbbb", c: "value-cccc",
      d: "value-dddd", e: "value-eeee",
    };
    const out = summarizeAdvanced(params, values);
    expect(out.length).toBeLessThanOrEqual(80 + " · +N more".length + 2);
    expect(out).toMatch(/\+\d+ more$/);
    expect(out.startsWith("Advanced options · ")).toBe(true);
  });

  it("returns just the prefix when given no params", () => {
    expect(summarizeAdvanced([], {})).toBe("Advanced options");
  });
});
```

- [ ] **Step 2: Run the test, expect import failure**

Run: `npx vitest run src/application/__tests__/summarizeAdvanced.test.ts`
Expected: FAILS with "Cannot find module '../summarizeAdvanced'".

- [ ] **Step 3: Implement the helper**

Create `src/application/summarizeAdvanced.ts`:

```typescript
import type { Parameter, ParamValue } from "../domain/tool";

const MAX_LEN = 80;
const PREFIX = "Advanced options";
const SEP = " · ";
const TEXT_TRUNC = 20;

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function display(param: Parameter, value: ParamValue | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (param.type) {
    case "boolean": return value === true ? "on" : "off";
    case "file":
    case "folder":  return basename(String(value));
    case "select":  return String(value);
    case "number":  return String(value);
    case "text":
    case "url": {
      const s = String(value);
      return s.length > TEXT_TRUNC ? s.slice(0, TEXT_TRUNC) + "…" : s;
    }
  }
}

export function summarizeAdvanced(
  params: Parameter[],
  values: Record<string, ParamValue>,
): string {
  if (params.length === 0) return PREFIX;

  const entries = params.map(p => `${p.label}: ${display(p, values[p.id])}`);
  const full = PREFIX + SEP + entries.join(SEP);
  if (full.length <= MAX_LEN) return full;

  // Trim entries from the right until under MAX_LEN; keep at least one entry.
  let kept = entries.length;
  while (kept > 1) {
    const trimmed = entries.slice(0, kept - 1);
    const dropped = entries.length - trimmed.length;
    const candidate = PREFIX + SEP + trimmed.join(SEP) + SEP + `+${dropped} more`;
    if (candidate.length <= MAX_LEN) return candidate;
    kept -= 1;
  }
  // Even one entry is too long — return prefix + first entry + +N more.
  const dropped = entries.length - 1;
  return PREFIX + SEP + entries[0] + SEP + `+${dropped} more`;
}
```

- [ ] **Step 4: Run tests, expect green**

Run: `npx vitest run src/application/__tests__/summarizeAdvanced.test.ts`
Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/application/summarizeAdvanced.ts src/application/__tests__/summarizeAdvanced.test.ts
git commit -m "feat(app): add summarizeAdvanced helper with truncation"
```

---

## Task 6: `AdvancedDisclosure` molecule

**Files:**
- Create: `src/ui/molecules/AdvancedDisclosure.tsx`

- [ ] **Step 1: Implement the disclosure**

Create `src/ui/molecules/AdvancedDisclosure.tsx`:

```tsx
import { useState } from "react";
import type { Parameter, ParamValue } from "../../domain/tool";
import { ParamField } from "./ParamField";
import { summarizeAdvanced } from "../../application/summarizeAdvanced";

interface Props {
  params: Parameter[];
  values: Record<string, ParamValue>;
  onChange: (id: string, value: ParamValue) => void;
}

export function AdvancedDisclosure({ params, values, onChange }: Props) {
  const [open, setOpen] = useState(false);
  if (params.length === 0) return null;
  const summary = summarizeAdvanced(params, values);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 bg-transparent border-none p-0 text-left cursor-pointer group"
      >
        <span
          aria-hidden
          className={`inline-block w-3 transition-transform text-ink-3 ${open ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        <span className="font-display text-[14px] text-ink-2 group-hover:text-ink">
          {open ? "Advanced options" : summary}
        </span>
        <span className="flex-1 h-px bg-line" />
      </button>

      {open && (
        <div className="flex flex-col gap-7 pl-6">
          {params.map((p, i) => (
            <ParamField
              key={p.id}
              param={p}
              index={i}
              value={values[p.id]}
              onChange={v => onChange(p.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/ui/molecules/AdvancedDisclosure.tsx
git commit -m "feat(ui): add AdvancedDisclosure molecule"
```

---

## Task 7: `ToolRunner` partitions required vs. advanced — TDD

**Files:**
- Test: `src/ui/organisms/__tests__/ToolRunner.test.tsx`
- Modify: `src/ui/organisms/ToolRunner.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/ui/organisms/__tests__/ToolRunner.test.tsx` (inside the existing `describe("ToolRunner", ...)` block):

```tsx
  it("hides advanced parameters until the disclosure is opened", async () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "input", label: "Video file", type: "file" },
        { id: "voice", label: "Voice model", type: "select", options: ["a", "b"], advanced: true, default: "a" },
      ],
    };
    wrap(tool, mockRunner());

    expect(screen.getByText("Video file")).toBeInTheDocument();
    expect(screen.queryByText("Voice model")).not.toBeInTheDocument();

    const summary = screen.getByRole("button", { name: /advanced options/i });
    await userEvent.click(summary);

    expect(screen.getByText("Voice model")).toBeInTheDocument();
  });

  it("preserves advanced field values across collapse and re-expand", async () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "voice", label: "Voice model", type: "select", options: ["a", "b"], advanced: true, default: "a" },
      ],
    };
    wrap(tool, mockRunner());

    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    const select = screen.getByLabelText("voice") as HTMLSelectElement;
    await userEvent.selectOptions(select, "b");
    expect(select.value).toBe("b");

    // Collapse
    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    // Re-expand
    await userEvent.click(screen.getByRole("button", { name: /advanced options/i }));
    const select2 = screen.getByLabelText("voice") as HTMLSelectElement;
    expect(select2.value).toBe("b");
  });

  it("Run stays enabled when only advanced+optional fields are unset", () => {
    const tool: Tool = {
      id: "t", name: "T", command: "/x",
      parameters: [
        { id: "title", label: "Title", type: "text", advanced: true, optional: true },
      ],
    };
    wrap(tool, mockRunner());
    expect(screen.getByRole("button", { name: /^run$/i })).not.toBeDisabled();
  });
```

- [ ] **Step 2: Run the new tests, expect failures**

Run: `npx vitest run src/ui/organisms/__tests__/ToolRunner.test.tsx -t "advanced"`
Expected: The first two tests fail (advanced field is rendered alongside required ones; no disclosure button exists). The third may pass already.

- [ ] **Step 3: Update `ToolRunner.tsx`**

Replace `src/ui/organisms/ToolRunner.tsx` with:

```tsx
import { useState } from "react";
import type { Tool, Parameter, ParamValue } from "../../domain/tool";
import { Button } from "../atoms/Button";
import { ParamField } from "../molecules/ParamField";
import { AdvancedDisclosure } from "../molecules/AdvancedDisclosure";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { buildArgs } from "../../application/argTemplate";

interface Props { tool: Tool }

function defaultValue(p: Parameter): ParamValue {
  if (p.default !== undefined) return p.default;
  if (p.type === "boolean") return false;
  if (p.type === "select") return p.options[0] ?? "";
  return "";
}

function initialValues(tool: Tool): Record<string, ParamValue> {
  return Object.fromEntries((tool.parameters ?? []).map(p => [p.id, defaultValue(p)]));
}

function isFilled(v: ParamValue | undefined): boolean {
  if (typeof v === "string") return v !== "";
  return v !== undefined && v !== null;
}

export function ToolRunner({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [values, setValues] = useState<Record<string, ParamValue>>(() => initialValues(tool));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runId = state.selectedRunIdByTool[tool.id];
  const status = runId ? state.runs[runId]?.status ?? null : null;
  const params = tool.parameters ?? [];
  const required = params.filter(p => !p.advanced);
  const advanced = params.filter(p => p.advanced);
  const canRun =
    status !== "running" &&
    params.every(p => p.optional === true || isFilled(values[p.id]));

  const resolvedArgs = buildArgs(tool, values);

  const startRun = async () => {
    const outcome = await runner.run({ toolId: tool.id, values }, tool);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
  };

  const onRunClick = () => (tool.confirm === false ? startRun() : setConfirmOpen(true));
  const setValue = (id: string, v: ParamValue) => setValues(prev => ({ ...prev, [id]: v }));

  return (
    <div className="flex flex-col gap-7">
      {required.map((p, i) => (
        <ParamField
          key={p.id}
          param={p}
          index={i}
          value={values[p.id]}
          onChange={v => setValue(p.id, v)}
        />
      ))}

      {advanced.length > 0 && (
        <AdvancedDisclosure params={advanced} values={values} onChange={setValue} />
      )}

      {params.length > 0 && <span className="block h-px bg-line mt-1" />}

      <footer className="flex justify-end">
        <Button variant="primary" disabled={!canRun} onClick={onRunClick}>Run</Button>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        toolName={tool.name}
        command={tool.command}
        args={resolvedArgs}
        shell={tool.shell ?? false}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); startRun(); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the targeted tests, expect green**

Run: `npx vitest run src/ui/organisms/__tests__/ToolRunner.test.tsx`
Expected: All ToolRunner tests pass, including the three new ones.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/organisms/ToolRunner.tsx src/ui/organisms/__tests__/ToolRunner.test.tsx
git commit -m "feat(ui): partition advanced params into AdvancedDisclosure"
```

---

## Task 8: Rewrite seed `examples/tools.json` in plain language

**Files:**
- Modify: `examples/tools.json`

- [ ] **Step 1: Replace contents**

Overwrite `examples/tools.json` with:

```json
{
  "schemaVersion": "1.0",
  "tools": [
    {
      "id": "hello",
      "name": "Say hello",
      "command": "/bin/echo",
      "args": ["Welcome to Pier — drag a file onto a tool, or just click Run"],
      "description": "A quick test to make sure everything's working.",
      "icon": "👋",
      "category": "starter",
      "confirm": false
    },
    {
      "id": "file-info",
      "name": "What's this file?",
      "command": "/usr/bin/file",
      "args": ["{input}"],
      "parameters": [
        {
          "id": "input",
          "label": "File",
          "help": "Drop any file. Pier will tell you what kind of file it is.",
          "type": "file"
        }
      ],
      "description": "Drop any file to see what kind it is.",
      "icon": "📄",
      "category": "starter"
    },
    {
      "id": "url-headers",
      "name": "URL headers",
      "command": "/usr/bin/curl",
      "args": ["-I", "-s", "{url}"],
      "parameters": [
        {
          "id": "url",
          "label": "Web address",
          "help": "Paste a URL like https://example.com.",
          "type": "url"
        }
      ],
      "description": "Fetch HTTP headers for a URL.",
      "icon": "🌐",
      "category": "web"
    },
    {
      "id": "ffmpeg-convert",
      "name": "Convert video",
      "command": "/opt/homebrew/bin/ffmpeg",
      "args": ["-y", "-i", "{input}", "out.{format}"],
      "parameters": [
        {
          "id": "input",
          "label": "Video file",
          "help": "The video you want to convert.",
          "type": "file",
          "accepts": [".mov", ".mp4", ".webm"]
        },
        {
          "id": "format",
          "label": "Output format",
          "help": "Pick the format of the converted file. MP4 works almost everywhere.",
          "type": "select",
          "options": ["mp4", "webm", "mov"],
          "default": "mp4",
          "advanced": true
        },
        {
          "id": "bitrate",
          "label": "Video bitrate",
          "help": "Higher = better quality, larger file. Leave blank for the default.",
          "type": "text",
          "flag": "-b:v",
          "optional": true,
          "advanced": true
        },
        {
          "id": "verbose",
          "label": "Show full ffmpeg log",
          "help": "Print every step ffmpeg takes. Useful when something goes wrong.",
          "type": "boolean",
          "flag": "-v",
          "optional": true,
          "advanced": true
        }
      ],
      "description": "Convert a video to another format.",
      "icon": "🎬",
      "category": "media",
      "confirm": true
    },
    {
      "id": "dub-japanese",
      "name": "Dub video to Japanese",
      "command": "/usr/bin/true",
      "args": ["{input}", "--provider", "{provider}"],
      "parameters": [
        {
          "id": "input",
          "label": "English video",
          "help": "Drop the video you want dubbed into Japanese.",
          "type": "file",
          "accepts": [".mp4", ".mov", ".mkv", ".webm"]
        },
        {
          "id": "provider",
          "label": "Voice model",
          "help": "Which AI generates the Japanese voice. The default works well for most videos.",
          "type": "select",
          "options": ["mlx_qwen3", "tts_other"],
          "default": "mlx_qwen3",
          "advanced": true
        },
        {
          "id": "clean",
          "label": "Remove background noise first",
          "help": "Clean up the original audio before dubbing. Slower, but better with noisy footage.",
          "type": "boolean",
          "default": false,
          "advanced": true
        }
      ],
      "description": "Dub an English video to Japanese with cloned voice + burned subs.",
      "icon": "🎙️",
      "category": "media",
      "confirm": true
    }
  ]
}
```

- [ ] **Step 2: Add a vitest that parses the seed file through the validator**

Create `src/domain/__tests__/seed.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";
import seed from "../../../examples/tools.json";

describe("seed examples/tools.json", () => {
  it("parses with the current validator", () => {
    const r = parseToolsConfig(seed);
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
  });
});
```

Run: `npx vitest run src/domain/__tests__/seed.test.ts`
Expected: PASS. Keep this test in the repo — it's a useful guard against future schema drift.

Note: importing a JSON file requires `resolveJsonModule: true` in `tsconfig.json`. If the import errors, add that compilerOption (or use `await import("../../../examples/tools.json")` with `assert { type: "json" }` — vitest supports both).

- [ ] **Step 3: Run the full suite**

Run: `npm run test:run`
Expected: All green.

- [ ] **Step 4: Cargo test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: green (no Rust changes since Task 3, but the seed file is parsed by Rust at runtime — confirming structural validity here is cheap).

- [ ] **Step 5: Commit**

```bash
git add examples/tools.json src/domain/__tests__/seed.test.ts
git commit -m "feat(examples): rewrite seed tools with plain-language labels and advanced markers"
```

---

## Task 9: Manual smoke test in Tauri dev

**Files:** none modified.

- [ ] **Step 1: Wipe local user config so the app re-seeds**

```bash
mv ~/.pier/tools.json ~/.pier/tools.json.bak.$(date +%s) 2>/dev/null || true
```

(Backs up an existing config; safe if the file does not exist.)

- [ ] **Step 2: Run the desktop app**

Run: `npm run tauri dev`
Expected: Vite on :1420, Rust shell launches, main window opens, default seeded tools appear as tiles.

- [ ] **Step 3: Open "Dub video to Japanese"**

Verify by eye:
- The required field shows the label "English video" (sentence case, not all caps).
- The `01 02 03` ordinal column is gone.
- "Voice model" and "Remove background noise first" are NOT visible at first.
- A summary line reads roughly: *"Advanced options · Voice model: mlx_qwen3 · Remove background noise first: off"*.
- Clicking the summary expands the disclosure; both fields appear and show the correct help text.
- Collapsing returns to the summary; values persist if changed.

- [ ] **Step 4: Open "Convert video"**

Verify "Video file" is the only top-level field; format/bitrate/verbose are inside Advanced options.

- [ ] **Step 5: Stop the dev server, restore the previous config if you backed one up**

```bash
# Optional: restore your prior config
ls ~/.pier/tools.json.bak.* 2>/dev/null
```

- [ ] **Step 6: No commit (no source changes).**

---

## Task 10: Final verification

- [ ] **Step 1: Full TS suite**

Run: `npm run test:run`
Expected: all green.

- [ ] **Step 2: TS build (typecheck + bundle)**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Rust tests + clippy**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
Expected: all green.

- [ ] **Step 4: Confirm the spec sections are all addressed**

Open `docs/superpowers/specs/2026-04-26-non-tech-friendly-tool-runner-design.md` and tick mentally:
- Schema: `label` required, `help` rename, `advanced` flag — Tasks 1, 3, 4.
- UI: ordinal removed, sentence case labels, `AdvancedDisclosure` with summary — Tasks 1, 6, 7.
- `summarizeAdvanced` helper with truncation — Task 5.
- Seed examples rewritten — Task 8.
- Tests: validator, summarizer, ToolRunner partition, Rust domain — Tasks 4, 5, 7, 3.
- Manual smoke verifies the actual user experience — Task 9.

If any spec line is uncovered, add a follow-up task and execute it.
