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
  if (value === undefined || value === null || value === ""
      || (Array.isArray(value) && value.length === 0)) return "—";
  switch (param.type) {
    case "boolean": return value === true ? "on" : "off";
    case "file":
    case "folder":  return basename(String(value));
    case "select":
    case "date":
    case "number":
    case "slider":  return String(value);
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return arr.length <= 2 ? arr.join(", ") : `${arr.slice(0, 2).join(", ")} +${arr.length - 2}`;
    }
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
