import type { Tool, ParamValue } from "../domain/tool";

const PLACEHOLDER = /^\{([a-zA-Z_][\w-]*)\}$/;

const isEmpty = (v: ParamValue | undefined) =>
  v === undefined || v === null || v === ""
  || (typeof v === "number" && Number.isNaN(v))
  || (Array.isArray(v) && v.length === 0);

const stringify = (v: ParamValue | undefined): string => {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(",");
  return String(v);
};

export function buildArgs(tool: Tool, values: Record<string, ParamValue>): string[] {
  const params = tool.parameters ?? [];
  const paramById = new Map(params.map(p => [p.id, p]));
  const out: string[] = [];

  // Pass 1: positional args with {id} substitution.
  for (const raw of tool.args ?? []) {
    const m = raw.match(PLACEHOLDER);
    if (!m) { out.push(raw); continue; }
    const name = m[1];
    const v = values[name];
    if (isEmpty(v)) {
      if (paramById.get(name)?.optional) continue;
      out.push("");
    } else {
      out.push(stringify(v));
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
    // Multiselect: repeat the flag once per value.
    if (Array.isArray(v)) {
      for (const item of v) out.push(p.flag, String(item));
      continue;
    }
    out.push(p.flag, stringify(v));
  }

  return out;
}
