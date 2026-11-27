import { Vec2 } from "@shift/geo";
import type { Contour } from "@shift/glyph-state";
import type { PointId } from "@shift/types";
import type { Editor } from "../../editor/Editor";
import type { GlyphLayer } from "../../model/Glyph";
import { objectIsKindOf } from "../../../types/object";
import type { GlyphNode } from "../../../types/node";

/**
 * A lone selected on-curve point being dragged, which may land on the on-curve
 * point next to it along its contour: dropped there, the two become one.
 */
export class PointMerge {
  /** The glyph node the point is edited in; hit radii are measured in its units. */
  readonly node: GlyphNode;
  /** The dragged point. */
  readonly pointId: PointId;
  readonly #layer: GlyphLayer;

  private constructor(node: GlyphNode, layer: GlyphLayer, pointId: PointId) {
    this.node = node;
    this.#layer = layer;
    this.pointId = pointId;
  }

  /** The merge candidate when the selection is exactly one on-curve point. */
  static fromSelection(editor: Editor): PointMerge | null {
    const [id, ...rest] = editor.selection.ids;
    if (!id || rest.length > 0) return null;

    const object = editor.object(id);
    if (!objectIsKindOf(object, "point") || !object.layer) return null;
    if (!object.layer.point(object.pointId)?.isOnCurve) return null;

    return new PointMerge(object.node, object.layer, object.pointId);
  }

  /** The neighbouring on-curve point within `radius` of the dragged point, the nearer one first. */
  targetWithin(radius: number): PointId | null {
    const point = this.#layer.point(this.pointId);
    const contour = point ? contourOf(this.#layer, this.pointId) : null;
    if (!point || !contour) return null;

    let best: { id: PointId; distance: number } | null = null;
    for (const step of [1, -1] as const) {
      const neighbour = onCurveNeighbour(contour, this.pointId, step);
      if (!neighbour) continue;
      const distance = Vec2.dist(neighbour.position, point.position);
      if (distance > radius || (best && best.distance <= distance)) continue;
      best = { id: neighbour.id, distance };
    }
    return best?.id ?? null;
  }
}

/** The contour holding `pointId` in `layer`. */
export function contourOf(layer: GlyphLayer, pointId: PointId): Contour | null {
  return layer.contours.find((contour) => contour.points.some((p) => p.id === pointId)) ?? null;
}

/** The first on-curve point from `pointId` in direction `step`, or null at an open end or when it is the point itself. */
export function onCurveNeighbour(contour: Contour, pointId: PointId, step: 1 | -1) {
  const span = spanTo(contour, pointId, step);
  return span ? span.target : null;
}

/**
 * Walks from `pointId` in direction `step` to the next on-curve point.
 *
 * @returns That point and the off-curve handles passed on the way, or null at an
 *   open end, or when the walk comes back to the point (a contour of one on-curve).
 */
export function spanTo(contour: Contour, pointId: PointId, step: 1 | -1) {
  const points = contour.points;
  const start = points.findIndex((p) => p.id === pointId);
  if (start < 0) return null;

  const handles: PointId[] = [];
  for (let k = 1; k < points.length; k++) {
    const raw = start + step * k;
    if (!contour.closed && (raw < 0 || raw >= points.length)) return null;
    const point = points[(raw + points.length) % points.length]!;
    if (point.id === pointId) return null;
    if (point.isOnCurve) return { target: point, handles };
    handles.push(point.id);
  }
  return null;
}
