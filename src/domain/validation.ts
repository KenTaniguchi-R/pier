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

  let parameters: Parameter[] | undefined;
  if (t.parameters !== undefined) {
    if (!Array.isArray(t.parameters)) {
      errors.push(`tools[${idx}].parameters must be an array`);
    } else {
      parameters = [];
      const seenIds = new Set<string>();
      (t.parameters as unknown[]).forEach((p, j) => {
        const r = parseParam(p, idx, j);
        if (!r.ok) { errors.push(...r.errors); return; }
        if (seenIds.has(r.value.id)) {
          errors.push(`tools[${idx}].parameters duplicate parameter id: ${r.value.id}`);
        }
        seenIds.add(r.value.id);
        parameters!.push(r.value);
      });
    }
  }

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
  return { ok: true, value: { ...(t as unknown as Tool), parameters } };
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

export type { ParamValue };
