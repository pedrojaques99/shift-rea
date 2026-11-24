import type { Point2D } from "@shift/geo";
import { ascending, comparing } from "@shift/types";
import type {
  AxisSnap,
  DistancePositionGuide,
  PositionSnap,
  PositionSnapProvider,
} from "../../../types/positionEdit";
import { AxisWindow } from "./AxisWindow";

/** A distance already in the glyph, between two neighbours on a row or a column. */
interface Measure {
  readonly distance: number;
  readonly reference: readonly [Point2D, Point2D];
}

/** Distances shorter than this, in font units, are coincident points, not a measure. */
const MIN_DISTANCE = 1;
/** At most this many equal reference pairs are reported for one snap. */
const MAX_REFERENCES = 8;

/**
 * Snaps a position so its distance to its neighbour on the same row (or
 * column) equals a distance already in the glyph: a stem's width, a counter,
 * a bar's thickness.
 *
 * @remarks
 * The glyph's distances are the gaps between neighbouring stationary points
 * that share a y (for widths) or an x (for heights), measured once when the
 * snap is built. A frame then looks only at the position's nearest
 * stationary neighbour on each side within the radius of its row or column,
 * and at the measures within the radius of its distance to them.
 */
export class EqualDistanceSnap implements PositionSnapProvider {
  readonly #rows: AxisWindow;
  readonly #columns: AxisWindow;
  readonly #widths: readonly Measure[];
  readonly #heights: readonly Measure[];
  readonly #radius: number;

  private constructor(
    rows: AxisWindow,
    columns: AxisWindow,
    widths: readonly Measure[],
    heights: readonly Measure[],
    radius: number,
  ) {
    this.#rows = rows;
    this.#columns = columns;
    this.#widths = widths;
    this.#heights = heights;
    this.#radius = radius;
  }

  /**
   * @param targets - Stationary positions, such as on-curve points that stay put.
   * @param radius - Font-unit distance within which a distance matches and rows align.
   */
  static among(targets: readonly Point2D[], radius: number): EqualDistanceSnap {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error("Equal distance snap radius must be a non-negative finite number");
    }

    return new EqualDistanceSnap(
      AxisWindow.of(targets, "y"),
      AxisWindow.of(targets, "x"),
      neighbourGaps(targets, "x"),
      neighbourGaps(targets, "y"),
      radius,
    );
  }

  snap(point: Point2D): PositionSnap | null {
    const x = this.#axisSnap(point, "x", this.#rows, this.#widths);
    const y = this.#axisSnap(point, "y", this.#columns, this.#heights);
    if (!x && !y) return null;

    return { x, y };
  }

  /** The nearest equal-distance correction along `axis`, against neighbours across it. */
  #axisSnap(
    point: Point2D,
    axis: "x" | "y",
    lines: AxisWindow,
    measures: readonly Measure[],
  ): AxisSnap | null {
    if (measures.length === 0) return null;

    const across = axis === "x" ? "y" : "x";
    const radius = this.#radius;
    let before: Point2D | null = null;
    let after: Point2D | null = null;
    for (const neighbour of lines.within(point[across], radius)) {
      const gap = neighbour[axis] - point[axis];
      if (gap < 0 && (!before || neighbour[axis] > before[axis])) before = neighbour;
      if (gap > 0 && (!after || neighbour[axis] < after[axis])) after = neighbour;
    }

    let best: { offset: number; guides: DistancePositionGuide[] } | null = null;
    for (const neighbour of [before, after]) {
      if (!neighbour) continue;

      const gap = Math.abs(point[axis] - neighbour[axis]);
      const matches = nearestMeasures(measures, gap, radius);
      const match = matches[0];
      if (!match) continue;

      const side = Math.sign(point[axis] - neighbour[axis]);
      const offset = side * (match.distance - gap);
      if (best && Math.abs(best.offset) <= Math.abs(offset)) continue;

      const to = { ...point, [axis]: point[axis] + offset };
      best = {
        offset,
        guides: matches.map((measure) => ({
          kind: "distance",
          axis,
          from: { x: neighbour.x, y: neighbour.y },
          to,
          distance: measure.distance,
          reference: measure.reference,
        })),
      };
    }

    return best;
  }
}

/**
 * Gaps along `axis` between neighbouring points that share the other
 * coordinate exactly, sorted by length.
 */
function neighbourGaps(points: readonly Point2D[], axis: "x" | "y"): Measure[] {
  const across = axis === "x" ? "y" : "x";
  const lines = Map.groupBy(points, (point) => point[across]);
  const measures: Measure[] = [];
  for (const line of lines.values()) {
    const sorted = line.toSorted(comparing((point: Point2D) => point[axis], ascending));
    for (let index = 1; index < sorted.length; index++) {
      const start = sorted[index - 1]!;
      const end = sorted[index]!;
      const distance = end[axis] - start[axis];
      if (distance < MIN_DISTANCE) continue;

      measures.push({
        distance,
        reference: [
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
        ],
      });
    }
  }

  return measures.toSorted(comparing((measure: Measure) => measure.distance, ascending));
}

/**
 * The measures of the length nearest `gap` within `radius`, in their sorted
 * order and at most {@link MAX_REFERENCES} of them; empty when none is near.
 */
function nearestMeasures(measures: readonly Measure[], gap: number, radius: number): Measure[] {
  let low = 0;
  let high = measures.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (measures[middle]!.distance < gap - radius) low = middle + 1;
    else high = middle;
  }

  let best: number | null = null;
  for (let slot = low; slot < measures.length; slot++) {
    const distance = measures[slot]!.distance;
    if (distance > gap + radius) break;
    if (best === null || Math.abs(distance - gap) < Math.abs(best - gap)) best = distance;
  }
  if (best === null) return [];

  return measures.filter((measure) => measure.distance === best).slice(0, MAX_REFERENCES);
}
