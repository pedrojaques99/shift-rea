import type { MatModel } from "@shift/geo";
import type { ComponentTransformSelectionLayer, PositionSelection } from "@shift/editor/types";

/** A point edit a scrub drives: a value per step, then one commit or discard. */
export interface PointScrub {
  preview(value: number): void;
  commit(): void;
  discard(): void;
}

/** How one sidebar field's value transforms the selection, for points and for components. */
export interface SelectionScrubPlan {
  /** The undo step's name when components are transformed. */
  readonly label: string;
  /** Opens the edit that moves the selected points with the value. */
  readonly points: (selection: PositionSelection) => PointScrub;
  /** The transform one component layer takes for `value`, about its own bounds. */
  readonly components: (value: number, layer: ComponentTransformSelectionLayer) => MatModel;
}
