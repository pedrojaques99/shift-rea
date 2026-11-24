import type { Point2D } from "@shift/geo";
import type { MetricKind } from "@shift/types";
import type { GlyphLayer } from "../lib/model/Glyph";
import type { PositionTargets } from "../lib/model/positions/PositionTargets";

export type { PositionTargets };

/** Normalized editable position targets for one authored layer. */
export interface PositionSelectionLayer {
  readonly layer: GlyphLayer;
  readonly targets: PositionTargets;
}

/** Reference-layer position targets and their matched additional layers. */
export interface PositionSelection extends PositionSelectionLayer {
  readonly additionalLayers: readonly PositionSelectionLayer[];
}

/** Shared terminal operations exposed by every fluent position edit. */
export interface PositionEdit {
  commit(): void;
  discard(): void;
}

/** Internal lifecycle of one configured position edit. */
export type PositionEditPhase = "configuring" | "previewing" | "committed" | "discarded";

/** Optional activation predicate evaluated for each preview frame. */
export interface PositionCondition {
  readonly when: () => boolean;
}

/** Direction segment optionally emitted while a movement vector is quantized. */
export interface DirectionPositionGuide {
  readonly kind: "direction";
  readonly from: Point2D;
  readonly to: Point2D;
}

/** Horizontal metric that one snapped position, at glyph-local `(x, y)`, now sits on. */
export interface MetricPositionGuide {
  readonly kind: "metric";
  readonly metric: MetricKind;
  readonly x: number;
  readonly y: number;
  /** Whether the line is the metric's overshoot edge (position plus overshoot), not the metric itself. */
  readonly overshoot?: boolean;
}

/** Vertical line of the glyph's advance box: its left edge, its middle, or its right edge. */
export type AdvanceEdge = "left" | "centre" | "right";

/** Vertical advance-box line that one snapped position, at glyph-local `(x, y)`, now sits on. */
export interface AdvancePositionGuide {
  readonly kind: "advance";
  readonly edge: AdvanceEdge;
  readonly x: number;
  readonly y: number;
  /** Bottom of the line as drawn, usually the descender. */
  readonly minY: number;
  /** Top of the line as drawn, usually the ascender. */
  readonly maxY: number;
}

/**
 * A distance, along one axis, from a stationary point to a moving position that
 * now equals a distance already in the glyph, such as a stem's width.
 */
export interface DistancePositionGuide {
  readonly kind: "distance";
  /** Axis the distance is measured along. */
  readonly axis: "x" | "y";
  /** Stationary end of the measured distance. */
  readonly from: Point2D;
  /** The moving position, at its snapped place. */
  readonly to: Point2D;
  /** The matched distance in font units, never negative. */
  readonly distance: number;
  /** Ends of the stationary pair whose distance the move matches. */
  readonly reference: readonly [Point2D, Point2D];
}

/** A moving position that now mirrors a stationary point about the advance's vertical centre. */
export interface SymmetryPositionGuide {
  readonly kind: "symmetry";
  /** The stationary point mirrored. */
  readonly mirror: Point2D;
  /** The moving position, at its snapped place. */
  readonly point: Point2D;
  /** Glyph-local x of the axis of symmetry. */
  readonly centre: number;
}

/** Axis-aligned line from a stationary point to a moving position that now shares its x or y. */
export interface AlignmentPositionGuide {
  readonly kind: "alignment";
  readonly target: Point2D;
  readonly point: Point2D;
}

/** Grid intersection, in glyph-local units, that a moving position now sits on along one axis. */
export interface GridPositionGuide {
  readonly kind: "grid";
  readonly point: Point2D;
}

/** Semantic visual guide emitted by a position edit preview. */
export type PositionGuide =
  | DirectionPositionGuide
  | MetricPositionGuide
  | AdvancePositionGuide
  | AlignmentPositionGuide
  | DistancePositionGuide
  | SymmetryPositionGuide
  | GridPositionGuide;

/** Correction along one axis; its distance is the absolute offset. */
export interface AxisSnap {
  /** Signed font-unit offset added to the candidate coordinate on this axis. */
  readonly offset: number;
  readonly guides: readonly PositionGuide[];
}

/**
 * Candidate correction returned by a position snap provider.
 *
 * @remarks
 * Axes snap independently so a y-only target, such as a metric, never blocks
 * an x correction from another provider. A null axis leaves that coordinate free.
 */
export interface PositionSnap {
  readonly x: AxisSnap | null;
  readonly y: AxisSnap | null;
}

/** Source-neutral position snapping contract consumed by MoveEdit. */
export interface PositionSnapProvider {
  snap(point: Point2D): PositionSnap | null;
}

/** Effective movement and visual feedback produced for one preview frame. */
export interface PositionFeedback {
  readonly delta: Point2D;
  readonly guides: readonly PositionGuide[];
}
