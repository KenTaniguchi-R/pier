export const FAVORITES_CAP = 8;

export function isPinned(list: readonly string[], id: string): boolean {
  return list.indexOf(id) !== -1;
}

/** Toggle pin for `id`. Removes if present; appends if absent and under cap.
 *  Returns the same reference when the call is a no-op (already at cap and
 *  trying to add) so callers can detect "nothing changed" via identity. */
export function togglePin(
  list: readonly string[],
  id: string,
  cap: number = FAVORITES_CAP,
): readonly string[] {
  if (list.indexOf(id) !== -1) return list.filter((x) => x !== id);
  if (list.length >= cap) return list;
  return [...list, id];
}

/** Drop ids no longer present in the known set, preserving order. Used for
 *  read-time filtering only — the persisted list is not mutated. */
export function pruneMissing(
  list: readonly string[],
  known: ReadonlySet<string>,
): string[] {
  return list.filter((id) => known.has(id));
}
