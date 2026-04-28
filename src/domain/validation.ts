import type {
  Tool, ToolsConfig, Parameter, ParamType, ParamValue,
} from "./tool";

const PARAM_TYPES: ParamType[] = [
  "file", "folder", "text", "url", "select", "boolean", "number",
  "multiselect", "slider", "date",
];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function parseStringMap(
  v: unknown,
  where: string,
  errors: string[],
): Record<string, string> | undefined {
  if (v === undefined) return undefined;
  if (!isRecord(v)) { errors.push(`${where} must be an object`); return undefined; }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") {
      errors.push(`${where}.${k} must be a string`);
      continue;
    }
    out[k] = val;
  }
  return out;
}

export function parseToolsConfig(input: unknown): ParseResult<ToolsConfig> {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["root not an object"] };
  if (input.schemaVersion !== "1.0") errors.push("schemaVersion must be '1.0'");
  if (!Array.isArray(input.tools)) errors.push("tools must be an array");
  if (errors.length) return { ok: false, errors };

  let defaults: import("./tool").Defaults | undefined;
  if ((input as Record<string, unknown>).defaults !== undefined) {
    const d = (input as Record<string, unknown>).defaults;
    if (!isRecord(d)) {
      errors.push("defaults must be an object");
    } else {
      const localErrs: string[] = [];
      if (d.cwd !== undefined && typeof d.cwd !== "string") localErrs.push("defaults.cwd must be a string");
      if (d.envFile !== undefined && typeof d.envFile !== "string") localErrs.push("defaults.envFile must be a string");
      const env = parseStringMap(d.env, "defaults.env", localErrs);
      if (localErrs.length === 0) {
        defaults = {
          cwd: d.cwd as string | undefined,
          envFile: d.envFile as string | undefined,
          env,
        };
      } else {
        errors.push(...localErrs);
      }
    }
  }

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
  return { ok: true, value: { schemaVersion: "1.0", defaults, tools } };
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

  if (t.envFile !== undefined && typeof t.envFile !== "string") {
    errors.push(`tools[${idx}].envFile must be a string`);
  }
  const env = parseStringMap(t.env, `tools[${idx}].env`, errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { ...(t as unknown as Tool), parameters, env } };
}

function parseParam(p: unknown, ti: number, pi: number): ParseResult<Parameter> {
  const where = `tools[${ti}].parameters[${pi}]`;
  if (!isRecord(p)) return { ok: false, errors: [`${where} not an object`] };
  const errors: string[] = [];
  if (typeof p.id !== "string" || !p.id) errors.push(`${where}.id required string`);
  if (typeof p.label !== "string" || !p.label) {
    errors.push(`${where}.label required string (parameter id: ${typeof p.id === "string" ? p.id : "?"})`);
  }
  if (!PARAM_TYPES.includes(p.type as ParamType)) {
    errors.push(`${where}.type must be one of ${PARAM_TYPES.join(", ")}`);
  }
  if (errors.length) return { ok: false, errors };

  const type = p.type as ParamType;
  const isSet = (v: unknown) => v !== undefined && v !== null;

  if (type === "select") {
    if (!Array.isArray(p.options) || (p.options as unknown[]).some(o => typeof o !== "string")) {
      errors.push(`${where}.options must be a string[]`);
    } else if (isSet(p.default) && !(p.options as string[]).includes(p.default as string)) {
      errors.push(`${where}.default not in options`);
    }
  }

  if (type === "number") {
    if (isSet(p.default) && typeof p.default !== "number") {
      errors.push(`${where}.default must be a number`);
    }
    for (const k of ["min", "max", "step"] as const) {
      if (isSet(p[k]) && typeof p[k] !== "number") {
        errors.push(`${where}.${k} must be a number`);
      }
    }
  }

  if (type === "boolean" && isSet(p.default) && typeof p.default !== "boolean") {
    errors.push(`${where}.default must be a boolean`);
  }

  if ((type === "text" || type === "url" || type === "file" || type === "folder")
      && isSet(p.default) && typeof p.default !== "string") {
    errors.push(`${where}.default must be a string`);
  }

  if ((type === "text" || type === "url") && isSet(p.pattern)) {
    if (typeof p.pattern !== "string") {
      errors.push(`${where}.pattern must be a string`);
    } else {
      try { new RegExp(p.pattern); }
      catch { errors.push(`${where}.pattern is not a valid regex`); }
    }
  }

  if (type === "multiselect") {
    if (!Array.isArray(p.options) || (p.options as unknown[]).some(o => typeof o !== "string")) {
      errors.push(`${where}.options must be a string[]`);
    } else if (isSet(p.default)) {
      if (!Array.isArray(p.default) || (p.default as unknown[]).some(v => typeof v !== "string")) {
        errors.push(`${where}.default must be a string[]`);
      } else {
        const opts = new Set(p.options as string[]);
        for (const v of p.default as string[]) {
          if (!opts.has(v)) errors.push(`${where}.default value "${v}" not in options`);
        }
      }
    }
  }

  if (type === "slider") {
    for (const k of ["min", "max", "step"] as const) {
      if (isSet(p[k]) && typeof p[k] !== "number") {
        errors.push(`${where}.${k} must be a number`);
      }
    }
    if (typeof p.min !== "number") errors.push(`${where}.min required for slider`);
    if (typeof p.max !== "number") errors.push(`${where}.max required for slider`);
    if (typeof p.min === "number" && typeof p.max === "number" && p.min >= p.max) {
      errors.push(`${where}.min must be less than max`);
    }
    if (isSet(p.default) && typeof p.default !== "number") {
      errors.push(`${where}.default must be a number`);
    }
  }

  if (type === "date") {
    for (const k of ["min", "max", "default"] as const) {
      if (isSet(p[k]) && typeof p[k] !== "string") {
        errors.push(`${where}.${k} must be an ISO date string (YYYY-MM-DD)`);
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: p as unknown as Parameter };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type { ParamValue };
