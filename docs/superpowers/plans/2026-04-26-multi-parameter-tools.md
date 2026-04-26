# Multi-Parameter Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pier's single-input tool schema with a typed, ordered list of parameters (file/folder/text/url/select/boolean/number) supporting `optional` + `default` + per-parameter CLI `flag`. Render the form as a numbered "specification sheet" inside the existing editorial-paper aesthetic.

**Architecture:** Hard schema migration (no `inputType` shim). Two-pass arg builder shared between TS and Rust as pure modules. New `Parameter` discriminated union in domain; `ToolRunner` becomes a form driven by `tool.parameters`. New atoms (`Select`, `Checkbox`, `NumberField`) follow the existing `BASE + VARIANTS` pattern. New molecule (`ParamField`) owns one row's layout.

**Tech Stack:** TypeScript + React 19 + Tailwind v4 (frontend); Rust + Tauri 2 + serde (backend); Vitest + Rust `cargo test`.

---

## Spec

See `docs/superpowers/specs/2026-04-26-multi-parameter-tools-design.md`.

---

## File Map

**Pure / domain (TS):**
- `src/domain/tool.ts` — rewrite. `Parameter` union + new `Tool`.
- `src/domain/runRequest.ts` — `RunRequest` carries `values: Record<string, ParamValue>`.
- `src/domain/validation.ts` — extend with per-parameter validation.
- `src/application/argTemplate.ts` — NEW. Pure two-pass argv builder.

**Infrastructure / wiring (TS):**
- `src/application/ports.ts` — type ripple from new `RunRequest`.
- `src/infrastructure/tauriCommandRunner.ts` — pass `values` through invoke.
- `src/application/loadConfig.ts` — unchanged signature.

**UI (TS):**
- `src/ui/atoms/Select.tsx` — NEW.
- `src/ui/atoms/Checkbox.tsx` — NEW.
- `src/ui/atoms/NumberField.tsx` — NEW.
- `src/ui/molecules/ParamField.tsx` — NEW. One spec-sheet row.
- `src/ui/organisms/ToolRunner.tsx` — rewrite. Form driven by `tool.parameters`.
- `src/ui/organisms/ToolDetail.tsx` — eyebrow no longer reads `inputType`.

**Rust (mirrors):**
- `src-tauri/src/domain/tool.rs` — `Parameter` enum + new `Tool`.
- `src-tauri/src/domain/run.rs` — `RunRequest` with `values: HashMap<String, serde_json::Value>`.
- `src-tauri/src/application/arg_template.rs` — NEW.
- `src-tauri/src/application/run_tool.rs` — use `arg_template`.

**Config / examples:**
- `src-tauri/src/application/load_config.rs` — `DEFAULT_CONFIG` rewrite.
- `examples/tools.json` — rewrite + add multi-param example.

---

## Task 1: Domain — Parameter union + Tool rewrite (TS)

**Files:**
- Modify: `src/domain/tool.ts` (rewrite)

- [ ] **Step 1: Replace `src/domain/tool.ts` with the new types**

```ts
export type ParamType = "file" | "folder" | "text" | "url" | "select" | "boolean" | "number";

export type ParamValue = string | number | boolean;

interface ParameterBase {
  id: string;
  label?: string;
  description?: string;
  optional?: boolean;
  default?: ParamValue;
  flag?: string;
}

export interface FileParam     extends ParameterBase { type: "file"; accepts?: string[] }
export interface FolderParam   extends ParameterBase { type: "folder" }
export interface TextParam     extends ParameterBase { type: "text"; multiline?: boolean }
export interface UrlParam      extends ParameterBase { type: "url" }
export interface SelectParam   extends ParameterBase { type: "select"; options: string[] }
export interface BooleanParam  extends ParameterBase { type: "boolean" }
export interface NumberParam   extends ParameterBase { type: "number"; min?: number; max?: number; step?: number }

export type Parameter =
  | FileParam | FolderParam | TextParam | UrlParam
  | SelectParam | BooleanParam | NumberParam;

export interface Tool {
  id: string;
  name: string;
  command: string;
  args?: string[];
  parameters?: Parameter[];
  description?: string;
  icon?: string;
  timeout?: number;
  outputPath?: string;
  confirm?: boolean;
  shell?: boolean;
  cwd?: string;
  category?: string;
}

export interface ToolsConfig {
  schemaVersion: "1.0";
  tools: Tool[];
}
```

- [ ] **Step 2: Run typecheck — expect failures elsewhere (validation, ToolRunner, etc.)**

Run: `npx tsc --noEmit`
Expected: errors in `src/domain/validation.ts` (no `InputType` export), `src/ui/organisms/ToolRunner.tsx`, `src/ui/organisms/ToolDetail.tsx`. These are fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/domain/tool.ts
git commit -m "refactor(domain): replace inputType with Parameter[] on Tool

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Domain — RunRequest values map (TS)

**Files:**
- Modify: `src/domain/runRequest.ts`

- [ ] **Step 1: Replace `src/domain/runRequest.ts`**

```ts
import type { ParamValue } from "./tool";

export type RunStatus = "pending" | "running" | "success" | "failed" | "killed";

export interface RunRequest {
  toolId: string;
  values: Record<string, ParamValue>;
}

export interface RunOutcome {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  outputFiles: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/runRequest.ts
git commit -m "refactor(domain): RunRequest carries typed values map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Pure module — `argTemplate` (TS) with TDD

**Files:**
- Create: `src/application/argTemplate.ts`
- Create: `src/application/__tests__/argTemplate.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/application/__tests__/argTemplate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildArgs } from "../argTemplate";
import type { Tool } from "../../domain/tool";

const tool = (overrides: Partial<Tool>): Tool => ({
  id: "t",
  name: "T",
  command: "/bin/echo",
  ...overrides,
});

describe("buildArgs", () => {
  it("substitutes {id} placeholders in positional args", () => {
    const t = tool({
      args: ["-i", "{input}"],
      parameters: [{ id: "input", type: "file" }],
    });
    expect(buildArgs(t, { input: "/tmp/a.mov" })).toEqual(["-i", "/tmp/a.mov"]);
  });

  it("drops a positional arg whose placeholder param is empty + optional", () => {
    const t = tool({
      args: ["-i", "{input}", "{extra}"],
      parameters: [
        { id: "input", type: "file" },
        { id: "extra", type: "text", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", extra: "" })).toEqual(["-i", "/a"]);
  });

  it("emits flag + value when a flagged param is set", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", type: "file" },
        { id: "bitrate", type: "text", flag: "-b:v", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", bitrate: "5000k" })).toEqual([
      "/a", "-b:v", "5000k",
    ]);
  });

  it("omits the flag entirely when an optional flagged param is empty", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", type: "file" },
        { id: "bitrate", type: "text", flag: "-b:v", optional: true },
      ],
    });
    expect(buildArgs(t, { input: "/a", bitrate: "" })).toEqual(["/a"]);
  });

  it("emits a boolean true as flag-only", () => {
    const t = tool({
      parameters: [{ id: "dry", type: "boolean", flag: "--dry-run" }],
    });
    expect(buildArgs(t, { dry: true })).toEqual(["--dry-run"]);
  });

  it("omits a boolean false even with flag set", () => {
    const t = tool({
      parameters: [{ id: "dry", type: "boolean", flag: "--dry-run" }],
    });
    expect(buildArgs(t, { dry: false })).toEqual([]);
  });

  it("emits flags in parameters[] declaration order, after positional args", () => {
    const t = tool({
      args: ["{input}"],
      parameters: [
        { id: "input", type: "file" },
        { id: "a", type: "text", flag: "-a" },
        { id: "b", type: "text", flag: "-b" },
      ],
    });
    expect(buildArgs(t, { input: "/x", a: "1", b: "2" })).toEqual([
      "/x", "-a", "1", "-b", "2",
    ]);
  });

  it("coerces numbers to string", () => {
    const t = tool({
      args: ["-p", "{port}"],
      parameters: [{ id: "port", type: "number" }],
    });
    expect(buildArgs(t, { port: 8080 })).toEqual(["-p", "8080"]);
  });

  it("returns empty when tool has no args and no flagged params", () => {
    expect(buildArgs(tool({}), {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (module missing)**

Run: `npx vitest run src/application/__tests__/argTemplate.test.ts`
Expected: FAIL — cannot resolve `../argTemplate`.

- [ ] **Step 3: Implement `src/application/argTemplate.ts`**

```ts
import type { Tool, Parameter, ParamValue } from "../domain/tool";

export function buildArgs(tool: Tool, values: Record<string, ParamValue>): string[] {
  const params = tool.parameters ?? [];
  const paramById = new Map(params.map(p => [p.id, p]));
  const out: string[] = [];

  // Pass 1: positional args with {id} substitution.
  for (const raw of tool.args ?? []) {
    const placeholder = matchPlaceholder(raw);
    if (placeholder) {
      const p = paramById.get(placeholder);
      const v = values[placeholder];
      if (isEmpty(v) && p?.optional) continue; // drop entire entry
      out.push(raw.replace(`{${placeholder}}`, stringify(v)));
    } else {
      out.push(raw);
    }
  }

  // Pass 2: flagged parameters in declaration order.
  for (const p of params) {
    if (!p.flag) continue;
    const v = values[p.id];
    if (p.type === "boolean") {
      if (v === true) out.push(p.flag);
      continue;
    }
    if (isEmpty(v)) continue;
    out.push(p.flag, stringify(v));
  }

  return out;
}

function matchPlaceholder(s: string): string | null {
  const m = s.match(/^\{([a-zA-Z_][\w-]*)\}$/);
  return m ? m[1] : null;
}

function isEmpty(v: ParamValue | undefined): boolean {
  return v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

function stringify(v: ParamValue | undefined): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

// Re-export type used by callers.
export type { Parameter };
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run src/application/__tests__/argTemplate.test.ts`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/application/argTemplate.ts src/application/__tests__/argTemplate.test.ts
git commit -m "feat(application): pure two-pass argv builder for parameterized tools

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Validation — per-parameter rules (TS)

**Files:**
- Modify: `src/domain/validation.ts` (rewrite)
- Modify: `src/domain/__tests__/validation.test.ts` (extend)

- [ ] **Step 1: Replace `src/domain/__tests__/validation.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseToolsConfig } from "../validation";

const ok = (input: unknown) => {
  const r = parseToolsConfig(input);
  if (!r.ok) throw new Error("expected ok, got: " + r.errors.join(", "));
  return r.value;
};
const fail = (input: unknown): string[] => {
  const r = parseToolsConfig(input);
  if (r.ok) throw new Error("expected fail");
  return r.errors;
};

describe("parseToolsConfig — basics", () => {
  it("accepts an empty parameters list", () => {
    const cfg = ok({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/echo", parameters: [] }],
    });
    expect(cfg.tools[0].parameters).toEqual([]);
  });

  it("accepts a tool with parameters omitted", () => {
    ok({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/bin/echo" }],
    });
  });

  it("rejects missing schemaVersion", () => {
    fail({ tools: [] });
  });

  it("rejects duplicate tool ids", () => {
    fail({
      schemaVersion: "1.0",
      tools: [
        { id: "x", name: "A", command: "/a" },
        { id: "x", name: "B", command: "/b" },
      ],
    });
  });

  it("rejects legacy inputType field with a clear message", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x", inputType: "file" }],
    });
    expect(errs.join(" ")).toMatch(/inputType.*parameters/i);
  });
});

describe("parseToolsConfig — parameters", () => {
  it("validates a select param requires options", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "format", type: "select" }] }],
    });
  });

  it("rejects duplicate parameter ids within a tool", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [
          { id: "a", type: "text" },
          { id: "a", type: "text" },
        ] }],
    });
    expect(errs.join(" ")).toMatch(/duplicate.*parameter/i);
  });

  it("rejects unknown placeholder in args", () => {
    const errs = fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        args: ["{ghost}"],
        parameters: [{ id: "real", type: "text" }] }],
    });
    expect(errs.join(" ")).toMatch(/ghost/);
  });

  it("rejects select default not in options", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "f", type: "select", options: ["a", "b"], default: "c" }] }],
    });
  });

  it("rejects number default that is not a number", () => {
    fail({
      schemaVersion: "1.0",
      tools: [{ id: "x", name: "X", command: "/x",
        parameters: [{ id: "n", type: "number", default: "five" }] }],
    });
  });

  it("accepts a valid file + select + boolean tool", () => {
    ok({
      schemaVersion: "1.0",
      tools: [{
        id: "convert",
        name: "Convert",
        command: "/usr/bin/ffmpeg",
        args: ["-i", "{input}"],
        parameters: [
          { id: "input", type: "file", accepts: [".mov"] },
          { id: "fmt", type: "select", options: ["mp4", "webm"], default: "mp4" },
          { id: "dry", type: "boolean", flag: "--dry-run", optional: true },
        ],
      }],
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/domain/__tests__/validation.test.ts`
Expected: failures (rules not yet implemented).

- [ ] **Step 3: Replace `src/domain/validation.ts`**

```ts
import type {
  Tool, ToolsConfig, Parameter, ParamType, ParamValue,
} from "./tool";

const PARAM_TYPES: ParamType[] = [
  "file", "folder", "text", "url", "select", "boolean", "number",
];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function parseToolsConfig(input: unknown): ParseResult<ToolsConfig> {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["root not an object"] };
  if (input.schemaVersion !== "1.0") errors.push("schemaVersion must be '1.0'");
  if (!Array.isArray(input.tools)) errors.push("tools must be an array");
  if (errors.length) return { ok: false, errors };

  const tools: Tool[] = [];
  const seen = new Set<string>();
  (input.tools as unknown[]).forEach((t, i) => {
    const r = parseTool(t, i);
    if (!r.ok) { errors.push(...r.errors); return; }
    if (seen.has(r.value.id)) errors.push(`duplicate tool id: ${r.value.id}`);
    seen.add(r.value.id);
    tools.push(r.value);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { schemaVersion: "1.0", tools } };
}

function parseTool(t: unknown, idx: number): ParseResult<Tool> {
  if (!isRecord(t)) return { ok: false, errors: [`tools[${idx}] not an object`] };
  const errors: string[] = [];
  const reqStr = (k: string) => {
    if (typeof t[k] !== "string" || !t[k]) errors.push(`tools[${idx}].${k} required string`);
  };
  ["id", "name", "command"].forEach(reqStr);

  if ("inputType" in t) {
    errors.push(
      `tools[${idx}].inputType is no longer supported — use parameters: [{ id, type, ... }]`,
    );
  }

  // parameters
  let parameters: Parameter[] | undefined;
  if (t.parameters !== undefined) {
    if (!Array.isArray(t.parameters)) {
      errors.push(`tools[${idx}].parameters must be an array`);
    } else {
      parameters = [];
      const seen = new Set<string>();
      (t.parameters as unknown[]).forEach((p, j) => {
        const r = parseParam(p, idx, j);
        if (!r.ok) { errors.push(...r.errors); return; }
        if (seen.has(r.value.id)) {
          errors.push(`tools[${idx}].parameters duplicate parameter id: ${r.value.id}`);
        }
        seen.add(r.value.id);
        parameters!.push(r.value);
      });
    }
  }

  // args placeholders must reference known param ids
  if (Array.isArray(t.args) && parameters) {
    const ids = new Set(parameters.map(p => p.id));
    (t.args as unknown[]).forEach(a => {
      if (typeof a !== "string") return;
      const m = a.match(/\{([a-zA-Z_][\w-]*)\}/);
      if (m && !ids.has(m[1])) {
        errors.push(`tools[${idx}].args references unknown parameter: ${m[1]}`);
      }
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { ...(t as Tool), parameters } };
}

function parseParam(p: unknown, ti: number, pi: number): ParseResult<Parameter> {
  const where = `tools[${ti}].parameters[${pi}]`;
  if (!isRecord(p)) return { ok: false, errors: [`${where} not an object`] };
  const errors: string[] = [];
  if (typeof p.id !== "string" || !p.id) errors.push(`${where}.id required string`);
  if (!PARAM_TYPES.includes(p.type as ParamType)) {
    errors.push(`${where}.type must be one of ${PARAM_TYPES.join(", ")}`);
  }
  if (errors.length) return { ok: false, errors };

  const type = p.type as ParamType;

  if (type === "select") {
    if (!Array.isArray(p.options) || (p.options as unknown[]).some(o => typeof o !== "string")) {
      errors.push(`${where}.options must be a string[]`);
    } else if (p.default !== undefined && !(p.options as string[]).includes(p.default as string)) {
      errors.push(`${where}.default not in options`);
    }
  }

  if (type === "number") {
    if (p.default !== undefined && typeof p.default !== "number") {
      errors.push(`${where}.default must be a number`);
    }
    for (const k of ["min", "max", "step"] as const) {
      if (p[k] !== undefined && typeof p[k] !== "number") {
        errors.push(`${where}.${k} must be a number`);
      }
    }
  }

  if (type === "boolean" && p.default !== undefined && typeof p.default !== "boolean") {
    errors.push(`${where}.default must be a boolean`);
  }

  if ((type === "text" || type === "url" || type === "file" || type === "folder")
      && p.default !== undefined && typeof p.default !== "string") {
    errors.push(`${where}.default must be a string`);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: p as unknown as Parameter };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Re-export ParamValue for convenience.
export type { ParamValue };
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/domain/__tests__/validation.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/__tests__/validation.test.ts
git commit -m "feat(domain): per-parameter validation with placeholder + default checks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Domain — Rust Parameter enum + Tool

**Files:**
- Modify: `src-tauri/src/domain/tool.rs` (rewrite)

- [ ] **Step 1: Replace `src-tauri/src/domain/tool.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Parameter {
    File(FileParam),
    Folder(FolderParam),
    Text(TextParam),
    Url(UrlParam),
    Select(SelectParam),
    Boolean(BooleanParam),
    Number(NumberParam),
}

impl Parameter {
    pub fn id(&self) -> &str {
        match self {
            Parameter::File(p)    => &p.base.id,
            Parameter::Folder(p)  => &p.base.id,
            Parameter::Text(p)    => &p.base.id,
            Parameter::Url(p)     => &p.base.id,
            Parameter::Select(p)  => &p.base.id,
            Parameter::Boolean(p) => &p.base.id,
            Parameter::Number(p)  => &p.base.id,
        }
    }
    pub fn flag(&self) -> Option<&str> {
        let b = match self {
            Parameter::File(p)    => &p.base,
            Parameter::Folder(p)  => &p.base,
            Parameter::Text(p)    => &p.base,
            Parameter::Url(p)     => &p.base,
            Parameter::Select(p)  => &p.base,
            Parameter::Boolean(p) => &p.base,
            Parameter::Number(p)  => &p.base,
        };
        b.flag.as_deref()
    }
    pub fn optional(&self) -> bool {
        let b = match self {
            Parameter::File(p)    => &p.base,
            Parameter::Folder(p)  => &p.base,
            Parameter::Text(p)    => &p.base,
            Parameter::Url(p)     => &p.base,
            Parameter::Select(p)  => &p.base,
            Parameter::Boolean(p) => &p.base,
            Parameter::Number(p)  => &p.base,
        };
        b.optional.unwrap_or(false)
    }
    pub fn is_boolean(&self) -> bool {
        matches!(self, Parameter::Boolean(_))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterBase {
    pub id: String,
    #[serde(default)] pub label: Option<String>,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub optional: Option<bool>,
    #[serde(default)] pub default: Option<serde_json::Value>,
    #[serde(default)] pub flag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default)] pub accepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default)] pub multiline: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectParam {
    #[serde(flatten)] pub base: ParameterBase,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BooleanParam { #[serde(flatten)] pub base: ParameterBase }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberParam {
    #[serde(flatten)] pub base: ParameterBase,
    #[serde(default)] pub min: Option<f64>,
    #[serde(default)] pub max: Option<f64>,
    #[serde(default)] pub step: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)] pub args: Vec<String>,
    #[serde(default)] pub parameters: Vec<Parameter>,
    #[serde(default)] pub accepts: Vec<String>,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub icon: Option<String>,
    #[serde(default)] pub timeout: Option<u64>,
    #[serde(default)] pub output_path: Option<String>,
    #[serde(default)] pub confirm: Option<bool>,
    #[serde(default)] pub shell: Option<bool>,
    #[serde(default)] pub cwd: Option<String>,
    #[serde(default)] pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsConfig {
    pub schema_version: String,
    pub tools: Vec<Tool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_no_param_tool() {
        let json = r#"{"schemaVersion":"1.0","tools":[
          {"id":"x","name":"X","command":"/bin/echo"}
        ]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.tools[0].id, "x");
        assert!(cfg.tools[0].parameters.is_empty());
    }

    #[test]
    fn parses_select_parameter() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"fmt","type":"select","options":["mp4","webm"]}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        match &cfg.tools[0].parameters[0] {
            Parameter::Select(p) => assert_eq!(p.options, vec!["mp4", "webm"]),
            _ => panic!("expected Select"),
        }
    }

    #[test]
    fn parses_boolean_with_flag() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"dry","type":"boolean","flag":"--dry-run"}]
        }]}"#;
        let cfg: ToolsConfig = serde_json::from_str(json).unwrap();
        let p = &cfg.tools[0].parameters[0];
        assert_eq!(p.id(), "dry");
        assert_eq!(p.flag(), Some("--dry-run"));
        assert!(p.is_boolean());
    }

    #[test]
    fn rejects_unknown_param_type() {
        let json = r#"{"schemaVersion":"1.0","tools":[{
          "id":"x","name":"X","command":"/x",
          "parameters":[{"id":"q","type":"weird"}]
        }]}"#;
        assert!(serde_json::from_str::<ToolsConfig>(json).is_err());
    }
}
```

- [ ] **Step 2: Run Rust tests — expect PASS in `domain/tool.rs`, fails elsewhere**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::tool`
Expected: 4 passing in this module. Other modules (`run_tool`, `load_config`) won't compile yet.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/domain/tool.rs
git commit -m "refactor(domain-rs): Parameter enum replaces InputType

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Domain — Rust RunRequest values map

**Files:**
- Modify: `src-tauri/src/domain/run.rs`

- [ ] **Step 1: Replace `src-tauri/src/domain/run.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type RunId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus { Pending, Running, Success, Failed, Killed }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub tool_id: String,
    #[serde(default)]
    pub values: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOutcome {
    pub run_id: RunId,
    pub status: RunStatus,
    pub exit_code: Option<i32>,
    pub started_at: u64,
    pub ended_at: Option<u64>,
    pub output_files: Vec<String>,
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/domain/run.rs
git commit -m "refactor(domain-rs): RunRequest carries values map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Pure module — `arg_template.rs` (Rust) with TDD

**Files:**
- Create: `src-tauri/src/application/arg_template.rs`
- Modify: `src-tauri/src/application/mod.rs` (add `pub mod arg_template;`)

- [ ] **Step 1: Add module declaration**

Modify `src-tauri/src/application/mod.rs` — append `pub mod arg_template;` (preserve existing modules).

- [ ] **Step 2: Create `src-tauri/src/application/arg_template.rs` with tests + impl**

```rust
use crate::domain::tool::{Parameter, Tool};
use serde_json::Value;
use std::collections::HashMap;

pub fn build_args(tool: &Tool, values: &HashMap<String, Value>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let by_id: HashMap<&str, &Parameter> =
        tool.parameters.iter().map(|p| (p.id(), p)).collect();

    // Pass 1: positional args.
    for raw in &tool.args {
        if let Some(name) = match_placeholder(raw) {
            let v = values.get(name);
            let empty = is_empty(v);
            if empty {
                if by_id.get(name).map(|p| p.optional()).unwrap_or(false) {
                    continue; // drop entry
                }
                out.push(raw.replace(&format!("{{{}}}", name), ""));
            } else {
                out.push(raw.replace(&format!("{{{}}}", name), &stringify(v)));
            }
        } else {
            out.push(raw.clone());
        }
    }

    // Pass 2: flagged params in declaration order.
    for p in &tool.parameters {
        let Some(flag) = p.flag() else { continue };
        let v = values.get(p.id());
        if p.is_boolean() {
            if matches!(v, Some(Value::Bool(true))) {
                out.push(flag.to_string());
            }
            continue;
        }
        if is_empty(v) { continue; }
        out.push(flag.to_string());
        out.push(stringify(v));
    }

    out
}

fn match_placeholder(s: &str) -> Option<&str> {
    let bytes = s.as_bytes();
    if !s.starts_with('{') || !s.ends_with('}') || s.len() < 3 { return None; }
    let inner = &s[1..s.len() - 1];
    let valid_first = inner.chars().next()
        .map(|c| c.is_ascii_alphabetic() || c == '_').unwrap_or(false);
    let valid_rest = inner.chars().skip(1)
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    let _ = bytes;
    if valid_first && valid_rest { Some(inner) } else { None }
}

fn is_empty(v: Option<&Value>) -> bool {
    match v {
        None => true,
        Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

fn stringify(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(other) => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tool(json_str: &str) -> Tool {
        serde_json::from_str(json_str).unwrap()
    }

    fn vals(pairs: &[(&str, Value)]) -> HashMap<String, Value> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect()
    }

    #[test]
    fn substitutes_positional_placeholder() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["-i","{input}"],
          "parameters":[{"id":"input","type":"file"}]}"#);
        let r = build_args(&t, &vals(&[("input", json!("/tmp/a"))]));
        assert_eq!(r, vec!["-i", "/tmp/a"]);
    }

    #[test]
    fn drops_optional_empty_positional() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["-i","{input}","{extra}"],
          "parameters":[
            {"id":"input","type":"file"},
            {"id":"extra","type":"text","optional":true}
          ]}"#);
        let r = build_args(&t, &vals(&[("input", json!("/a")), ("extra", json!(""))]));
        assert_eq!(r, vec!["-i", "/a"]);
    }

    #[test]
    fn emits_flag_when_set() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","type":"file"},
            {"id":"bitrate","type":"text","flag":"-b:v","optional":true}
          ]}"#);
        let r = build_args(&t, &vals(&[
            ("input", json!("/a")), ("bitrate", json!("5000k")),
        ]));
        assert_eq!(r, vec!["/a", "-b:v", "5000k"]);
    }

    #[test]
    fn omits_flag_when_empty() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","type":"file"},
            {"id":"bitrate","type":"text","flag":"-b:v","optional":true}
          ]}"#);
        let r = build_args(&t, &vals(&[("input", json!("/a")), ("bitrate", json!(""))]));
        assert_eq!(r, vec!["/a"]);
    }

    #[test]
    fn boolean_true_emits_flag_only() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "parameters":[{"id":"dry","type":"boolean","flag":"--dry-run"}]}"#);
        let r = build_args(&t, &vals(&[("dry", json!(true))]));
        assert_eq!(r, vec!["--dry-run"]);
    }

    #[test]
    fn boolean_false_emits_nothing() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "parameters":[{"id":"dry","type":"boolean","flag":"--dry-run"}]}"#);
        let r = build_args(&t, &vals(&[("dry", json!(false))]));
        assert!(r.is_empty());
    }

    #[test]
    fn flag_order_follows_parameters_declaration() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["{input}"],
          "parameters":[
            {"id":"input","type":"file"},
            {"id":"a","type":"text","flag":"-a"},
            {"id":"b","type":"text","flag":"-b"}
          ]}"#);
        let r = build_args(&t, &vals(&[
            ("input", json!("/x")), ("a", json!("1")), ("b", json!("2")),
        ]));
        assert_eq!(r, vec!["/x", "-a", "1", "-b", "2"]);
    }

    #[test]
    fn coerces_number_to_string() {
        let t = tool(r#"{"id":"t","name":"T","command":"/x",
          "args":["-p","{port}"],
          "parameters":[{"id":"port","type":"number"}]}"#);
        let r = build_args(&t, &vals(&[("port", json!(8080))]));
        assert_eq!(r, vec!["-p", "8080"]);
    }
}
```

- [ ] **Step 3: Run Rust tests — expect PASS for arg_template module**

Run: `cargo test --manifest-path src-tauri/Cargo.toml application::arg_template`
Expected: 8 passing.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/application/arg_template.rs src-tauri/src/application/mod.rs
git commit -m "feat(application-rs): pure two-pass argv builder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire Rust runner to use `arg_template` + new RunRequest

**Files:**
- Modify: `src-tauri/src/application/run_tool.rs:30-36` (replace inline replace with `arg_template::build_args`).

- [ ] **Step 1: Edit `src-tauri/src/application/run_tool.rs`**

Find the block (currently around lines 28-36):
```rust
let bin = path_resolver::resolve(&tool.command)?;
let input = req.input.clone().unwrap_or_default();
let args: Vec<String> = tool
    .args
    .iter()
    .map(|a| a.replace("{input}", &input))
    .collect();
```

Replace with:
```rust
let bin = path_resolver::resolve(&tool.command)?;
let args = crate::application::arg_template::build_args(&tool, &req.values);
```

(The `req.input` field no longer exists — `req.values` is the new shape.)

- [ ] **Step 2: Build Rust — expect compile success**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: success (commands.rs uses `Tool` + `RunRequest` types but their public API didn't change shape — both still serde from JSON).

- [ ] **Step 3: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/application/run_tool.rs
git commit -m "refactor(run-tool): use arg_template + values map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Migrate default config + examples

**Files:**
- Modify: `src-tauri/src/application/load_config.rs` (`DEFAULT_CONFIG` constant)
- Modify: `examples/tools.json`

- [ ] **Step 1: Replace `DEFAULT_CONFIG` in `src-tauri/src/application/load_config.rs`**

Find the existing `DEFAULT_CONFIG: &str = r#"{...}"#` block and replace it with:

```rust
const DEFAULT_CONFIG: &str = r#"{
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
      "parameters": [{ "id": "input", "type": "file" }],
      "description": "Drop any file to see what kind it is.",
      "icon": "📄",
      "category": "starter"
    }
  ]
}
"#;
```

- [ ] **Step 2: Run Rust tests — `seeds_default_when_missing` exercises this path**

Run: `cargo test --manifest-path src-tauri/Cargo.toml application::load_config`
Expected: all passing.

- [ ] **Step 3: Replace `examples/tools.json` with the new schema**

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
      "parameters": [{ "id": "input", "type": "file" }],
      "description": "Drop any file to see what kind it is.",
      "icon": "📄",
      "category": "starter"
    },
    {
      "id": "url-headers",
      "name": "URL headers",
      "command": "/usr/bin/curl",
      "args": ["-I", "-s", "{url}"],
      "parameters": [{ "id": "url", "type": "url" }],
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
        { "id": "input", "type": "file", "accepts": [".mov", ".mp4", ".webm"] },
        { "id": "format", "type": "select", "options": ["mp4", "webm", "mov"], "default": "mp4" },
        { "id": "bitrate", "type": "text", "flag": "-b:v", "optional": true, "description": "e.g. 5000k" },
        { "id": "dry", "type": "boolean", "flag": "-loglevel", "optional": true }
      ],
      "description": "Multi-parameter example: file + format + optional bitrate.",
      "icon": "🎬",
      "category": "media",
      "confirm": true
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/application/load_config.rs examples/tools.json
git commit -m "feat: migrate default config + examples to new parameter schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Atom — `Select.tsx`

**Files:**
- Create: `src/ui/atoms/Select.tsx`

- [ ] **Step 1: Create `src/ui/atoms/Select.tsx`**

```tsx
import { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: string[];
}

const BASE =
  "w-full appearance-none font-body font-normal text-[14px] leading-[1.5] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 pr-9 " +
  "transition-[border-color,box-shadow,background-color] duration-200 ease-(--ease-smooth) " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const CHEVRON =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 " +
  "w-3 h-3 text-ink-3";

export function Select({ options, className = "", ...rest }: Props) {
  return (
    <span className="relative block">
      <select className={`${BASE} ${className}`} {...rest}>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <svg className={CHEVRON} viewBox="0 0 12 12" aria-hidden>
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Quick smoke test — render the atom**

Create `src/ui/atoms/__tests__/Select.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../Select";

describe("Select", () => {
  it("renders options", () => {
    render(<Select options={["mp4", "webm"]} defaultValue="mp4" aria-label="format" />);
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByRole("option", { name: "mp4" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "webm" })).toBeTruthy();
  });

  it("fires onChange", () => {
    let v = "mp4";
    render(<Select options={["mp4", "webm"]} value={v} onChange={e => (v = e.target.value)} aria-label="format" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "webm" } });
    expect(v).toBe("webm");
  });
});
```

- [ ] **Step 3: Run test — expect PASS**

Run: `npx vitest run src/ui/atoms/__tests__/Select.test.tsx`
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/ui/atoms/Select.tsx src/ui/atoms/__tests__/Select.test.tsx
git commit -m "feat(ui): Select atom matching TextField vocabulary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Atom — `Checkbox.tsx`

**Files:**
- Create: `src/ui/atoms/Checkbox.tsx`

- [ ] **Step 1: Create `src/ui/atoms/Checkbox.tsx`**

```tsx
import { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const WRAP =
  "inline-flex items-center gap-2.5 cursor-pointer select-none";

const BOX =
  "relative inline-flex items-center justify-center w-[14px] h-[14px] " +
  "bg-surface border border-line-hi rounded-[4px] shadow-1 " +
  "transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-smooth) " +
  "peer-hover:border-ink-4 " +
  "peer-checked:bg-accent peer-checked:border-accent " +
  "peer-focus-visible:shadow-[0_0_0_4px_var(--color-accent-soft)]";

const LABEL =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2";

export function Checkbox({ label, className = "", ...rest }: Props) {
  return (
    <label className={`${WRAP} ${className}`}>
      <input type="checkbox" className="peer sr-only" {...rest} />
      <span className={BOX}>
        <svg
          className="w-2 h-2 text-white opacity-0 peer-checked:opacity-100"
          viewBox="0 0 8 8" aria-hidden
        >
          <path d="M1 4l2 2 4-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className={LABEL}>{label}</span>}
    </label>
  );
}
```

Note: Tailwind's `peer-checked:opacity-100` won't apply through nested elements; the SVG's opacity must be controlled by the box's checked state. Adjust the SVG to live as a sibling element of the input, OR keep this structure and rely on `:has()` (modern browsers). For broader support, render the SVG conditionally instead — see Step 2.

- [ ] **Step 2: Refine Checkbox so the check glyph is driven by `checked` prop**

Replace the body to use the `checked` value directly (controlled component is the only realistic use case here):

```tsx
import { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const WRAP = "inline-flex items-center gap-2.5 cursor-pointer select-none";

const BOX_BASE =
  "inline-flex items-center justify-center w-[14px] h-[14px] " +
  "rounded-[4px] shadow-1 border " +
  "transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-smooth)";

const BOX_OFF = "bg-surface border-line-hi hover:border-ink-4";
const BOX_ON  = "bg-accent border-accent";

const LABEL = "font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2";

export function Checkbox({ label, checked, className = "", ...rest }: Props) {
  return (
    <label className={`${WRAP} ${className}`}>
      <input type="checkbox" className="sr-only" checked={checked} {...rest} />
      <span className={`${BOX_BASE} ${checked ? BOX_ON : BOX_OFF}`}>
        {checked && (
          <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" aria-hidden>
            <path d="M1 4l2 2 4-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className={LABEL}>{label}</span>}
    </label>
  );
}
```

- [ ] **Step 3: Test**

Create `src/ui/atoms/__tests__/Checkbox.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("renders label", () => {
    render(<Checkbox label="DRY RUN" checked={false} onChange={() => {}} />);
    expect(screen.getByText("DRY RUN")).toBeTruthy();
  });

  it("fires onChange on click", () => {
    let v = false;
    const { container } = render(
      <Checkbox checked={v} onChange={e => (v = e.target.checked)} aria-label="x" />,
    );
    fireEvent.click(container.querySelector("input")!);
    expect(v).toBe(true);
  });
});
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/ui/atoms/__tests__/Checkbox.test.tsx`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/ui/atoms/Checkbox.tsx src/ui/atoms/__tests__/Checkbox.test.tsx
git commit -m "feat(ui): Checkbox atom with mono caps label

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Atom — `NumberField.tsx`

**Files:**
- Create: `src/ui/atoms/NumberField.tsx`

- [ ] **Step 1: Create `src/ui/atoms/NumberField.tsx`**

```tsx
import { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  min?: number; max?: number; step?: number;
}

const BASE =
  "w-full font-mono tabular-nums text-right text-[13px] leading-[1.5] " +
  "bg-surface text-ink border border-line rounded-[10px] px-3 py-2.5 " +
  "transition-[border-color,box-shadow] duration-200 ease-(--ease-smooth) " +
  "placeholder:text-ink-4 " +
  "focus:outline-none focus:border-accent-edge focus:shadow-[0_0_0_4px_var(--color-accent-soft)]";

export function NumberField({ className = "", ...rest }: Props) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={`${BASE} ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Test**

Create `src/ui/atoms/__tests__/NumberField.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberField } from "../NumberField";

describe("NumberField", () => {
  it("renders as a number input", () => {
    render(<NumberField aria-label="port" defaultValue={8080} />);
    const input = screen.getByLabelText("port") as HTMLInputElement;
    expect(input.type).toBe("number");
  });

  it("forwards onChange", () => {
    let v = 0;
    render(<NumberField aria-label="n" value={v} onChange={e => (v = Number(e.target.value))} />);
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "42" } });
    expect(v).toBe(42);
  });
});
```

- [ ] **Step 3: Run test — expect PASS**

Run: `npx vitest run src/ui/atoms/__tests__/NumberField.test.tsx`
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/ui/atoms/NumberField.tsx src/ui/atoms/__tests__/NumberField.test.tsx
git commit -m "feat(ui): NumberField atom with mono tabular numerals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Molecule — `ParamField.tsx`

**Files:**
- Create: `src/ui/molecules/ParamField.tsx`

- [ ] **Step 1: Create `src/ui/molecules/ParamField.tsx`**

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
  const counter = String(index + 1).padStart(2, "0");
  const label = (param.label ?? humanize(param.id)).toUpperCase();
  const optional = param.optional === true;

  return (
    <div
      className="flex gap-5 animate-tile-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <span className="flex-none w-8 pt-[2px] font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-3">
        {counter}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
            {label}
          </span>
          <span className="flex-1 h-px bg-line" />
          {optional && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
              ◦ optional
            </span>
          )}
        </div>

        {renderField(param, value, onChange)}

        {param.description && (
          <span className="font-display italic text-[13px] leading-[1.45] text-ink-3">
            {param.description}
          </span>
        )}
      </div>
    </div>
  );
}

function renderField(p: Parameter, value: ParamValue | undefined, onChange: (v: ParamValue) => void) {
  const str = (value ?? "") as string;

  switch (p.type) {
    case "file":
      return (
        <DropZone
          accepts={p.accepts}
          onDrop={path => onChange(path)}
          label={str ? str.split("/").pop() : undefined}
        />
      );
    case "folder":
      return (
        <DropZone
          directory
          onDrop={path => onChange(path)}
          label={str || undefined}
        />
      );
    case "text":
      return p.multiline ? (
        <Textarea value={str} onChange={e => onChange(e.target.value)} placeholder="Paste text…" />
      ) : (
        <TextField value={str} onChange={e => onChange(e.target.value)} />
      );
    case "url":
      return (
        <TextField
          value={str} onChange={e => onChange(e.target.value)}
          placeholder="https://…"
        />
      );
    case "select":
      return (
        <Select
          options={p.options}
          value={str}
          onChange={e => onChange(e.target.value)}
          aria-label={p.id}
        />
      );
    case "boolean":
      return (
        <Checkbox
          label={(p.label ?? humanize(p.id)).toUpperCase()}
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
          onChange={e => {
            const n = e.target.value === "" ? "" : Number(e.target.value);
            onChange(n as ParamValue);
          }}
        />
      );
  }
}

function humanize(id: string): string {
  return id.replace(/[-_]+/g, " ").trim();
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: any remaining errors are in `ToolRunner.tsx` / `ToolDetail.tsx` (next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/ui/molecules/ParamField.tsx
git commit -m "feat(ui): ParamField molecule — numbered specification-sheet row

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Rewrite `ToolRunner.tsx` as a form

**Files:**
- Modify: `src/ui/organisms/ToolRunner.tsx` (rewrite)

- [ ] **Step 1: Replace `src/ui/organisms/ToolRunner.tsx`**

```tsx
import { useState } from "react";
import type { Tool, ParamValue } from "../../domain/tool";
import { Button } from "../atoms/Button";
import { ParamField } from "../molecules/ParamField";
import { ConfirmDialog } from "../molecules/ConfirmDialog";
import { useApp } from "../../state/AppContext";
import { useRunner } from "../../state/RunnerContext";
import { buildArgs } from "../../application/argTemplate";

interface Props { tool: Tool }

function initialValues(tool: Tool): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of tool.parameters ?? []) {
    if (p.default !== undefined) out[p.id] = p.default;
    else if (p.type === "boolean") out[p.id] = false;
    else out[p.id] = "";
  }
  return out;
}

function isFilled(v: ParamValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v !== "";
  return true;
}

export function ToolRunner({ tool }: Props) {
  const { state, dispatch } = useApp();
  const runner = useRunner();
  const [values, setValues] = useState<Record<string, ParamValue>>(() => initialValues(tool));
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = latestRunId ? state.runs[latestRunId]?.status ?? null : null;
  const params = tool.parameters ?? [];
  const allRequiredFilled = params.every(p => p.optional === true || isFilled(values[p.id]));
  const canRun = allRequiredFilled && status !== "running";

  const resolvedArgs = buildArgs(tool, values);

  const startRun = async () => {
    const outcome = await runner.run({ toolId: tool.id, values }, tool);
    setLatestRunId(outcome.runId);
    dispatch({ type: "RUN_STARTED", runId: outcome.runId, toolId: tool.id, startedAt: outcome.startedAt });
    dispatch({ type: "SELECT_RUN", runId: outcome.runId });
  };

  const onRunClick = () => {
    if (tool.confirm === false) startRun();
    else setConfirmOpen(true);
  };

  const setValue = (id: string, v: ParamValue) => setValues(prev => ({ ...prev, [id]: v }));

  return (
    <div className="flex flex-col gap-7">
      {params.map((p, i) => (
        <ParamField
          key={p.id}
          param={p}
          index={i}
          value={values[p.id]}
          onChange={v => setValue(p.id, v)}
        />
      ))}

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

- [ ] **Step 2: Run tests — existing `ToolRunner.test.tsx` likely needs updating**

Run: `npx vitest run src/ui/organisms/__tests__/ToolRunner.test.tsx`
Expected: failures (test uses old `inputType`-based fixtures). Update the test file to use the new schema:

Read the existing file first, then rewrite each fixture. Replace any `inputType: "file"` with `parameters: [{ id: "input", type: "file" }]`. If the test passes `input: "/path"` to a fake runner, replace with `values: { input: "/path" }` in the assertion.

- [ ] **Step 3: Re-run tests — expect PASS**

Run: `npm run test:run`
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/ui/organisms/ToolRunner.tsx src/ui/organisms/__tests__/ToolRunner.test.tsx
git commit -m "refactor(ui): ToolRunner becomes the parameter form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Update `ToolDetail.tsx` eyebrow

**Files:**
- Modify: `src/ui/organisms/ToolDetail.tsx`

- [ ] **Step 1: Remove the `INPUT_LABELS` map and replace eyebrow logic**

Find:
```tsx
const INPUT_LABELS: Record<InputType, string> = { ... };
...
const eyebrow = tool.category ?? INPUT_LABELS[tool.inputType];
```

Replace with:
```tsx
const params = tool.parameters ?? [];
const inputSummary =
  params.length === 0 ? "no input"
  : params.length === 1 ? `accepts ${params[0].type}`
  : `${params.length} parameters`;
const eyebrow = tool.category ?? inputSummary;
```

Also remove the unused `import type { ... InputType } from ...`.

- [ ] **Step 2: Build & typecheck**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/ui/organisms/ToolDetail.tsx
git commit -m "refactor(ui): ToolDetail eyebrow summarizes parameters instead of inputType

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Final verification

- [ ] **Step 1: Full TS test pass**

Run: `npm run test:run`
Expected: all passing.

- [ ] **Step 2: Full Rust test pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: all passing.

- [ ] **Step 3: Frontend typecheck + build**

Run: `npm run build`
Expected: success, no TS errors.

- [ ] **Step 4: Rust clippy**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
Expected: no warnings.

- [ ] **Step 5: Manual smoke test**

Run: `npm run tauri dev`

Verify in the running app:
1. Default seeded `~/.pier/tools.json` migrated correctly — "Say hello" and "What's this file?" tiles render and run.
2. Replace `~/.pier/tools.json` with `examples/tools.json`. Verify the multi-param `ffmpeg-convert` tile shows numbered parameter rows: file drop zone, format select, optional bitrate text, dry checkbox.
3. Required-empty: open ffmpeg-convert with no input file; Run button is disabled.
4. Drop a `.mov`, pick `webm`, leave bitrate empty, leave dry off. Click Run. Confirm dialog shows: `/opt/homebrew/bin/ffmpeg -y -i /path/to/file.mov out.webm`.
5. Toggle dry on; confirm dialog now appends `-loglevel`.
6. Add bitrate `5000k`; confirm dialog appends `-b:v 5000k` after the positional args, before `-loglevel`.
7. Hot-reload: edit `~/.pier/tools.json` in another editor, save — UI updates without restart.

- [ ] **Step 6: Commit any final fixes if smoke test surfaced issues**

If any issue: write a focused fix + test, commit. If clean, no commit needed.

---

## Self-Review Notes

**Spec coverage:**
- §Schema → Tasks 1, 5
- §Argument templating → Tasks 3, 7
- §RunRequest → Tasks 2, 6
- §UI atoms → Tasks 10, 11, 12
- §Molecule (ParamField) → Task 13
- §ToolRunner refactor → Task 14
- §ToolDetail eyebrow → Task 15
- §Validation → Task 4
- §Migration (default seed + examples) → Task 9
- §Tests → distributed across 3, 4, 7, 10, 11, 12, 14, 16

**Type consistency check:** `ParamValue` defined in Task 1 is referenced consistently in Tasks 2, 3, 4, 13, 14. `buildArgs` signature `(tool, values)` matches across TS test (Task 3) and consumer (Task 14). Rust `Parameter` accessors `id()` / `flag()` / `optional()` / `is_boolean()` defined in Task 5 are used in Task 7.

**No placeholders:** every code step has full code; every command step has the exact command + expected outcome.
