import type { Parameter, ParamValue } from "../domain/tool";

function isFilled(v: ParamValue | undefined): boolean {
  if (typeof v === "string") return v !== "";
  return v !== undefined && v !== null;
}

/**
 * The first required parameter still missing a value, or null when ready.
 * Drives the diagnostic Run-button label.
 */
export function findBlocker(
  params: Parameter[],
  values: Record<string, ParamValue>,
): Parameter | null {
  return params.find(p => p.optional !== true && !isFilled(values[p.id])) ?? null;
}

export function blockerLabel(p: Parameter): string {
  const verb = p.type === "file" ? "Add" : p.type === "folder" ? "Choose" : "Enter";
  return `${verb} ${p.label.toLowerCase()} to run`;
}
