import { Point } from "@shift/glyph-state";
import type { CursorType } from "../../../types/editor";
import type { ShiftObject, ShiftObjectOf } from "../../../types/object";

export type BoundingRectEdge =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

/**
 * Resolves the resize cursor for an original handle and its current axis reflections.
 *
 * @param edge - Handle chosen at drag start, or the currently hovered handle.
 * @param flipX - Whether the current X scale is negative; zero is unflipped.
 * @param flipY - Whether the current Y scale is negative; zero is unflipped.
 * @returns The reflected diagonal cursor, unchanged axis cursor, or default for no handle.
 */
export function edgeToCursor(edge: BoundingRectEdge, flipX = false, flipY = false): CursorType {
  switch (edge) {
    case "left":
    case "right":
      return { type: "ew-resize" };
    case "top":
    case "bottom":
      return { type: "ns-resize" };
    case "top-left":
    case "bottom-right":
      return { type: flipX !== flipY ? "nesw-resize" : "nwse-resize" };
    case "top-right":
    case "bottom-left":
      return { type: flipX !== flipY ? "nwse-resize" : "nesw-resize" };
    default:
      return { type: "default" };
  }
}

/**
 * Resolves the badge cursor for hovering one object with the Select tool.
 *
 * @param object - The hovered object, resolved by the caller to an editable one.
 * @returns A hollow badge naming what a press would grab, or null for objects without one.
 */
export function hoverCursor(object: ShiftObject): CursorType | null {
  switch (object.kind) {
    case "point":
      return isOffCurve(object) ? { type: "handle" } : { type: "point" };
    case "anchor":
      return { type: "anchor" };
    case "segment":
      return { type: "segment" };
    case "component":
      return { type: "component" };
    default:
      return null;
  }
}

/**
 * Resolves the cursor for dragging a selection that is exactly one object.
 *
 * @param object - The single dragged object; segments and components move as a selection.
 * @returns The filled badge of the hover cursor, or null when the plain move cursor fits.
 */
export function dragCursor(object: ShiftObject): CursorType | null {
  switch (object.kind) {
    case "point":
      return isOffCurve(object) ? { type: "handle-move" } : { type: "point-move" };
    case "anchor":
      return { type: "anchor-move" };
    default:
      return null;
  }
}

function isOffCurve(object: ShiftObjectOf<"point">): boolean {
  const point = object.geometry.point(object.pointId);
  return point !== null && !Point.isOnCurve(point);
}
