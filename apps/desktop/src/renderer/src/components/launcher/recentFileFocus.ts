import type { Rect2D } from "@shift/geo";
import { ascending, comparing } from "@shift/types";

/**
 * Which recent file an arrow key moves focus to, from where each item sits on
 * screen.
 *
 * @remarks
 * Left and Right step through the files in order; Up and Down go to the row
 * above or below, landing on the file whose centre is closest to the current
 * one, so the wide first tile still lines up with the two below it. Home and
 * End jump to the first and last file. Reading positions rather than a column
 * count keeps grid and list on one rule.
 *
 * @param rects - each file's box, in display order.
 * @param current - index of the focused file.
 * @param key - the `KeyboardEvent.key` pressed.
 * @returns the index to focus, or null when the key does not move focus.
 */
export function nextRecentFileIndex(
  rects: readonly Rect2D[],
  current: number,
  key: string,
): number | null {
  const last = rects.length - 1;
  if (last < 0) return null;

  switch (key) {
    case "ArrowLeft":
      return Math.max(0, current - 1);
    case "ArrowRight":
      return Math.min(last, current + 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "ArrowUp":
      return nearestInNextRow(rects, current, -1);
    case "ArrowDown":
      return nearestInNextRow(rects, current, 1);
    default:
      return null;
  }
}

/** The file in the adjacent row (above for -1, below for 1) closest to the current one's centre. */
function nearestInNextRow(
  rects: readonly Rect2D[],
  current: number,
  direction: -1 | 1,
): number | null {
  const from = rects[current];
  if (!from) return null;

  const isPast = (rect: Rect2D) =>
    direction > 0 ? rect.top >= from.bottom - 1 : rect.bottom <= from.top + 1;
  const rowGap = (rect: Rect2D) => Math.abs(rect.top - from.top);
  const centreGap = (rect: Rect2D) =>
    Math.abs(rect.left + rect.width / 2 - (from.left + from.width / 2));

  const candidates = rects
    .map((rect, index) => ({ rect, index }))
    .filter(({ rect }) => isPast(rect));
  if (candidates.length === 0) return current;

  const rowTop = Math.min(...candidates.map(({ rect }) => rowGap(rect)));
  const row = candidates.filter(({ rect }) => rowGap(rect) === rowTop);
  row.sort(comparing(({ rect }) => centreGap(rect), ascending));

  return row[0]?.index ?? current;
}
