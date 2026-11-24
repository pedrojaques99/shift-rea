import type { Point2D } from "@shift/geo";

/** Points or a selection moved by `delta`, in glyph units. */
export interface MoveReadout {
  readonly kind: "move";
  readonly delta: Point2D;
}

/** An off-curve handle dragged: its length from its on-curve point, and its direction. */
export interface HandleReadout {
  readonly kind: "handle";
  readonly length: number;
  /** Direction from the on-curve point to the handle in degrees, counter-clockwise from +x in glyph units. */
  readonly angle: number;
}

/** A selection resized through its bounding box: its new width and height, in glyph units. */
export interface ResizeReadout {
  readonly kind: "resize";
  readonly width: number;
  readonly height: number;
}

/** A selection rotated: the angle turned since the drag began, in degrees, counter-clockwise. */
export interface RotateReadout {
  readonly kind: "rotate";
  readonly angle: number;
}

/** What a drag in flight changes, shown live beside the pointer and hidden when it ends. */
export type DragValue = MoveReadout | HandleReadout | ResizeReadout | RotateReadout;

/** A drag's live value and where the pointer is, in scene units. */
export interface DragReadout {
  readonly reading: DragValue;
  /** The pointer's scene position; the label sits just beside it. */
  readonly at: Point2D;
}
