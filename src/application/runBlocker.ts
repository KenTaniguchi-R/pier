import type { Parameter, ParamValue } from "../domain/tool";
import {
  errorMessage,
  validateValues,
  type ValidationError,
} from "../domain/paramValidation";

export type { ValidationError };

/**
 * The first parameter still failing validation, or null when ready.
 * Drives the diagnostic Run-button label.
 */
export function findBlocker(
  params: Parameter[],
  values: Record<string, ParamValue>,
): { param: Parameter; error: ValidationError } | null {
  const errs = validateValues(params, values);
  for (const p of params) {
    const e = errs.get(p.id);
    if (e) return { param: p, error: e };
  }
  return null;
}

export function blockerLabel(b: { param: Parameter; error: ValidationError }): string {
  if (b.error.kind === "required") return `${errorMessage(b.param, b.error)} to run`;
  return `Fix ${b.param.label.toLowerCase()} to run`;
}
