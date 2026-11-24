import type { Point2D } from "@shift/geo";
import { ascending, comparing } from "@shift/types";

/**
 * Points sorted once along one axis, so a snap reads only the points whose
 * coordinate on that axis lies near a value rather than every point.
 */
export class AxisWindow {
  readonly #points: readonly Point2D[];
  readonly #axis: "x" | "y";

  private constructor(points: readonly Point2D[], axis: "x" | "y") {
    this.#points = points;
    this.#axis = axis;
  }

  /** Sorts copies of `points` along `axis`. */
  static of(points: readonly Point2D[], axis: "x" | "y"): AxisWindow {
    const sorted = points
      .map(({ x, y }) => ({ x, y }))
      .toSorted(comparing((point: Point2D) => point[axis], ascending));
    return new AxisWindow(sorted, axis);
  }

  /** The points whose coordinate on the axis is within `radius` of `value`, in axis order. */
  within(value: number, radius: number): Point2D[] {
    const axis = this.#axis;
    const points = this.#points;
    const min = value - radius;
    const max = value + radius;
    let low = 0;
    let high = points.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (points[middle]![axis] < min) low = middle + 1;
      else high = middle;
    }

    const found: Point2D[] = [];
    for (let slot = low; slot < points.length && points[slot]![axis] <= max; slot++) {
      found.push(points[slot]!);
    }
    return found;
  }
}
