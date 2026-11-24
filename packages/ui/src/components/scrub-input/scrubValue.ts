/** Rounds to `digits` places and clamps into `[min, max]`. */
export function settle(value: number, digits: number, min?: number, max?: number): number {
  const factor = 10 ** digits;
  let next = Math.round(value * factor) / factor;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  // Rounding can leave -0, which reads as "-0" once formatted.
  return Object.is(next, -0) ? 0 : next;
}

/** The number as a field shows it: no grouping, no trailing zeros. */
export function formatScrubValue(value: number, digits = 2): string {
  return String(settle(value, digits));
}
