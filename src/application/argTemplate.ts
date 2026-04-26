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

export type { Parameter };
