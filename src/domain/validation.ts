import type { Tool, ToolsConfig, InputType } from "./tool";

const INPUT_TYPES: InputType[] = ["file", "text", "folder", "url", "none"];

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
  if (!INPUT_TYPES.includes(t.inputType as InputType)) {
    errors.push(`tools[${idx}].inputType invalid`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: t as unknown as Tool };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
