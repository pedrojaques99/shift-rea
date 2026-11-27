import { Validate } from "@shift/validation";
import type { ToolContext } from "../../core/Behavior";
import type { DoubleClickEvent } from "../../core/GestureDetector";
import type { SelectBehavior, SelectState } from "../types";
import { objectIsKindOf } from "../../../../types/object";

export class ToggleSmooth implements SelectBehavior {
  onDoubleClick(
    state: SelectState,
    ctx: ToolContext<SelectState>,
    event: DoubleClickEvent,
  ): boolean {
    if (state.type !== "ready") return false;
    if (event.target.kind !== "point") return false;

    const object = ctx.editor.object(event.target.id);
    if (!objectIsKindOf(object, "point")) return false;

    const layer = object.layer;
    if (!layer || !ctx.editor.isEditingLayer(layer)) return false;

    const point = layer.point(object.pointId);
    if (!point || !Validate.isOnCurve(point)) return false;

    // The same point in every master being edited, and across Ink Traps while the glyph
    // is drawn the same at both ends, turns smooth or corner together.
    const smooth = !point.smooth;
    const others = ctx.editor.positionSelection([event.target.id])?.additionalLayers ?? [];
    ctx.editor.transaction(smooth ? "Make Smooth" : "Make Corner", () => {
      layer.setPointSmooth(object.pointId, smooth);
      for (const other of others) {
        const [pointId] = other.targets.points;
        if (pointId) other.layer.setPointSmooth(pointId, smooth);
      }
    });
    return true;
  }
}
