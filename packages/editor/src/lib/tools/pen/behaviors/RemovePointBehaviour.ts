import type { ToolContext } from "../../core/Behavior";
import type { ClickEvent, DragStartEvent } from "../../core/GestureDetector";
import type { PenState, PenBehavior } from "../types";
import type { Pen } from "../Pen";

/**
 * Alt + press on an on-curve point removes it, fitting one curve across the gap it leaves
 * (Figma's pen). The point goes in every source being edited, as one undo step.
 *
 * @remarks
 * A press that turns into a drag removes too, so a hand that slips while clicking does not
 * start a new point on top of the one it meant to remove.
 */
export class RemovePointBehavior implements PenBehavior {
  onClick(state: PenState, ctx: ToolContext<PenState, Pen>, event: ClickEvent): boolean {
    return this.#remove(state, ctx, event);
  }

  onDragStart(state: PenState, ctx: ToolContext<PenState, Pen>, event: DragStartEvent): boolean {
    return this.#remove(state, ctx, event);
  }

  #remove(
    state: PenState,
    ctx: ToolContext<PenState, Pen>,
    event: ClickEvent | DragStartEvent,
  ): boolean {
    if (state.type !== "ready" || !event.altKey) return false;

    const pointId = ctx.tool.removablePointAt(event.coords.scene);
    if (!pointId) return false;

    if (pointId === ctx.tool.activeEndpointCell.peek()?.pointId) ctx.tool.clearActiveContour();
    ctx.editor.deletePoints([pointId], "fit");
    ctx.setState({ type: "ready" });
    return true;
  }
}
