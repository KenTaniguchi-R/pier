import type { Parameter, ParamValue } from "./tool";

export type ValidationError =
  | { kind: "required" }
  | { kind: "regex"; pattern: string }
  | { kind: "min"; min: number | string }
  | { kind: "max"; max: number | string }
  | { kind: "enum" };

const isFilled = (v: ParamValue | undefined): boolean => {
  if (typeof v === "string") return v !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return v !== undefined && v !== null;
};

export function validateParam(
  p: Parameter,
  v: ParamValue | undefined,
): ValidationError | null {
  if (!isFilled(v)) return p.optional ? null : { kind: "required" };

  switch (p.type) {
    case "text":
    case "url":
      if (p.pattern) {
        try {
          if (!new RegExp(p.pattern).test(String(v))) return { kind: "regex", pattern: p.pattern };
        } catch {
          // Malformed regex was already rejected by the config parser; treat as no-op here.
        }
      }
      return null;

    case "number":
    case "slider": {
      const n = typeof v === "number" ? v : Number(v);
      if (typeof p.min === "number" && n < p.min) return { kind: "min", min: p.min };
      if (typeof p.max === "number" && n > p.max) return { kind: "max", max: p.max };
      return null;
    }

    case "date": {
      const s = String(v);
      if (p.min && s < p.min) return { kind: "min", min: p.min };
      if (p.max && s > p.max) return { kind: "max", max: p.max };
      return null;
    }

    case "select":
      return p.options.includes(String(v)) ? null : { kind: "enum" };

    case "multiselect": {
      const arr = Array.isArray(v) ? v : [];
      const opts = new Set(p.options);
      return arr.every(x => opts.has(x)) ? null : { kind: "enum" };
    }

    default:
      return null;
  }
}

export function validateValues(
  params: Parameter[],
  values: Record<string, ParamValue>,
): Map<string, ValidationError> {
  const out = new Map<string, ValidationError>();
  for (const p of params) {
    const err = validateParam(p, values[p.id]);
    if (err) out.set(p.id, err);
  }
  return out;
}

export function errorMessage(p: Parameter, e: ValidationError): string {
  switch (e.kind) {
    case "required": {
      const verb =
        p.type === "file" ? "Add" :
        p.type === "folder" ? "Choose" :
        p.type === "select" || p.type === "multiselect" ? "Select" :
        p.type === "date" ? "Pick" :
        "Enter";
      return `${verb} ${p.label.toLowerCase()}`;
    }
    case "regex":   return `Doesn't match required format`;
    case "min":     return `Must be ${e.min} or more`;
    case "max":     return `Must be ${e.max} or less`;
    case "enum":    return `Not a valid choice`;
  }
}
