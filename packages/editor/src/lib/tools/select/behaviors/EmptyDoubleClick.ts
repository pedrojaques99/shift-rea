import type { ToolContext } from "../../core/Behavior";
import type { DoubleClickEvent } from "../../core/GestureDetector";
import type { SelectBehavior, SelectState } from "../types";

/** Double-click on empty canvas leaves the edited glyph, as Figma leaves vector editing. */
export class EmptyDoubleClick implements SelectBehavior {
  onDoubleClick(
    state: SelectState,
    ctx: ToolContext<SelectState>,
    event: DoubleClickEvent,
  ): boolean {
    if (state.type !== "ready" || event.target.kind !== "canvas") return false;
    if (!ctx.editor.editing.hasScope()) return false;

    // Pointer gestures already run inside a capture: join it, as `doubleClickNode` does.
    return ctx.editor.history.captureOrJoin("Exit glyph", () => {
      ctx.editor.exitNodes();
      return true;
    });
  }
}
