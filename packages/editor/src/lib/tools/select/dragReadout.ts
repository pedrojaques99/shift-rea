import { Vec2 } from "@shift/geo";
import { Point } from "@shift/glyph-state";
import type { Editor } from "../../editor/Editor";
import { objectIsKindOf } from "../../../types/object";
import type { DragReadout, HandleReadout } from "../../../types/dragReadout";
import type { SelectState } from "./types";

/**
 * The live value of the Select tool's drag in flight: how far a move went (a
 * lone off-curve handle shows its length and angle instead), a resize's new
 * width and height, or a rotation's angle; null outside a drag.
 */
export function selectDragReadout(editor: Editor, state: SelectState): DragReadout | null {
  switch (state.type) {
    case "translating": {
      const { lastPos, totalDelta } = state.translate;
      const reading = handleReadout(editor) ?? { kind: "move", delta: totalDelta };
      return { reading, at: lastPos };
    }
    case "resizing": {
      const { localBounds, scale, lastPos } = state.resize;
      const width = (localBounds.max.x - localBounds.min.x) * Math.abs(scale.x);
      const height = (localBounds.max.y - localBounds.min.y) * Math.abs(scale.y);
      return { reading: { kind: "resize", width, height }, at: lastPos };
    }
    case "rotating": {
      const { startAngle, currentAngle, lastPos } = state.rotate;
      return {
        reading: { kind: "rotate", angle: degreesBetween(startAngle, currentAngle) },
        at: lastPos,
      };
    }
    case "idle":
    case "ready":
    case "brushing":
    case "bending":
      return null;
  }
}

/** A lone selected off-curve handle's length and direction from its on-curve point, as drawn now. */
function handleReadout(editor: Editor): HandleReadout | null {
  const ids = editor.selection.ids;
  const object = ids.length === 1 ? editor.object(ids[0]!) : null;
  if (!objectIsKindOf(object, "point")) return null;

  const point = object.geometry.point(object.pointId);
  const contour = object.geometry.contour(object.contourId);
  if (!point || !contour || Point.isOnCurve(point)) return null;

  const anchor = contour.cubicHandleAnchor(point.id);
  if (!anchor) return null;

  const arm = Vec2.sub(point, anchor);
  return {
    kind: "handle",
    length: Vec2.len(arm),
    angle: (Math.atan2(arm.y, arm.x) * 180) / Math.PI,
  };
}

/** The turn from `from` to `to`, both in radians, in degrees within (-180, 180]. */
function degreesBetween(from: number, to: number): number {
  const turn = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return (turn * 180) / Math.PI;
}
