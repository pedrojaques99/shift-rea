import type { Point2D } from "@shift/geo";
import type {
  AdvanceEdge,
  AdvancePositionGuide,
  PositionSnap,
  PositionSnapProvider,
} from "../../../types/positionEdit";

/** Vertical span the advance lines are drawn across, usually descender to ascender. */
export interface AdvanceSpan {
  readonly minY: number;
  readonly maxY: number;
}

interface AdvanceLine {
  readonly edge: AdvanceEdge;
  readonly x: number;
}

/**
 * Snaps a position's x onto the glyph's advance box: its left edge at 0, its
 * horizontal centre, and its right edge at the advance width.
 */
export class AdvanceSnap implements PositionSnapProvider {
  readonly #lines: readonly AdvanceLine[];
  readonly #span: AdvanceSpan;
  readonly #radius: number;

  private constructor(lines: readonly AdvanceLine[], span: AdvanceSpan, radius: number) {
    this.#lines = lines;
    this.#span = span;
    this.#radius = radius;
  }

  /**
   * @param advance - The glyph's advance width; must be positive.
   * @param span - Vertical extent the snapped line is drawn across.
   * @param radius - Font-unit distance within which x snaps.
   */
  static of(advance: number, span: AdvanceSpan, radius: number): AdvanceSnap {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error("Advance snap radius must be a non-negative finite number");
    }
    if (!(advance > 0)) throw new Error("Advance snap needs a positive advance width");

    const lines: AdvanceLine[] = [
      { edge: "left", x: 0 },
      { edge: "centre", x: advance / 2 },
      { edge: "right", x: advance },
    ];
    return new AdvanceSnap(lines, { ...span }, radius);
  }

  snap(point: Point2D): PositionSnap | null {
    let best: AdvanceLine | null = null;
    let bestDistance = Infinity;
    for (const line of this.#lines) {
      const distance = Math.abs(line.x - point.x);
      if (distance > this.#radius || distance >= bestDistance) continue;

      best = line;
      bestDistance = distance;
    }
    if (!best) return null;

    const guide: AdvancePositionGuide = {
      kind: "advance",
      edge: best.edge,
      x: best.x,
      y: point.y,
      minY: this.#span.minY,
      maxY: this.#span.maxY,
    };
    return { x: { offset: best.x - point.x, guides: [guide] }, y: null };
  }
}
