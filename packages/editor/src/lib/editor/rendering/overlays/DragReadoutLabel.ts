import type { Point2D } from "@shift/geo";
import type { DragValue } from "../../../../types/dragReadout";
import type { Canvas } from "../Canvas";
import { drawValuePill, formatUnits } from "./valuePill";

/** Draws a drag's live value in a small pill beside the pointer, the same size at any zoom. */
export class DragReadoutLabel {
  /**
   * @param pointer - The pointer in screen pixels; the pill sits below and to its right.
   */
  draw(canvas: Canvas, value: DragValue, pointer: Point2D): void {
    const { fill, text, font, offsetPx } = canvas.theme.dragReadout;
    canvas.withScreenSpace((screen) => {
      drawValuePill(
        screen,
        { x: pointer.x + offsetPx, y: pointer.y + offsetPx },
        dragValueText(value),
        { fill, text, font },
        "corner",
      );
    });
  }
}

/**
 * The label a drag's value shows: `Δx 12  Δy −40` for a move, `120  45°` for
 * a handle (length, then angle), `320 × 540` for a resize, `30°` for a rotation.
 */
export function dragValueText(value: DragValue): string {
  switch (value.kind) {
    case "move":
      return `Δx ${formatUnits(value.delta.x)}  Δy ${formatUnits(value.delta.y)}`;
    case "handle":
      return `${formatUnits(value.length)}  ${formatUnits(value.angle)}°`;
    case "resize":
      return `${formatUnits(value.width)} × ${formatUnits(value.height)}`;
    case "rotate":
      return `${formatUnits(value.angle)}°`;
  }
}
