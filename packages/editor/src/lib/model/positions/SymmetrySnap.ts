import type { Point2D } from "@shift/geo";
import type {
  PositionSnap,
  PositionSnapProvider,
  SymmetryPositionGuide,
} from "../../../types/positionEdit";
import { AxisWindow } from "./AxisWindow";

/** Points closer than this to the centre are their own mirror and pull nothing. */
const ON_CENTRE = 0.5;

/**
 * Snaps a position's x onto the mirror image, about a vertical centre line, of
 * a stationary point on the same row: the left stem's edge mirrored onto the
 * right stem's, so a symmetric letter stays symmetric.
 *
 * @remarks
 * A point is on the position's row when their y coordinates are within the
 * radius; only the x coordinate snaps.
 */
export class SymmetrySnap implements PositionSnapProvider {
  readonly #centre: number;
  readonly #rows: AxisWindow;
  readonly #radius: number;

  private constructor(centre: number, rows: AxisWindow, radius: number) {
    this.#centre = centre;
    this.#rows = rows;
    this.#radius = radius;
  }

  /**
   * @param centre - Glyph-local x of the axis of symmetry, usually half the advance.
   * @param targets - Stationary positions whose mirror images pull.
   * @param radius - Font-unit distance within which x snaps and rows match.
   */
  static about(centre: number, targets: readonly Point2D[], radius: number): SymmetrySnap {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error("Symmetry snap radius must be a non-negative finite number");
    }

    return new SymmetrySnap(centre, AxisWindow.of(targets, "y"), radius);
  }

  snap(point: Point2D): PositionSnap | null {
    const centre = this.#centre;
    let best: { mirror: Point2D; x: number } | null = null;
    let bestDistance = Infinity;
    for (const target of this.#rows.within(point.y, this.#radius)) {
      if (Math.abs(target.x - centre) < ON_CENTRE) continue;

      const x = 2 * centre - target.x;
      const distance = Math.abs(x - point.x);
      if (distance > this.#radius || distance >= bestDistance) continue;

      best = { mirror: target, x };
      bestDistance = distance;
    }
    if (!best) return null;

    const guide: SymmetryPositionGuide = {
      kind: "symmetry",
      mirror: best.mirror,
      point: { x: best.x, y: point.y },
      centre,
    };
    return { x: { offset: best.x - point.x, guides: [guide] }, y: null };
  }
}
