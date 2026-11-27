//#region ../geo/src/types.d.ts
type Point2D = {
  x: number;
  y: number;
};
type Rect2D = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};
//#endregion
//#region ../geo/src/Bounds.d.ts
/**
 * Axis-aligned bounding box defined by its minimum and maximum corners.
 *
 * In screen/canvas space, `min` is the top-left corner and `max` is the
 * bottom-right. In UPM space (y-up), `min.y` is the bottom and `max.y`
 * is the top.
 */
interface Bounds {
  readonly min: {
    readonly x: number;
    readonly y: number;
  };
  readonly max: {
    readonly x: number;
    readonly y: number;
  };
}
declare const Bounds: {
  /** Create a bounds from explicit min and max corners. */
  readonly create: (min: Point2D, max: Point2D) => Bounds;
  /** Whether two bounds (or two empty results) have identical corners. */
  readonly equals: (a: Bounds | null, b: Bounds | null) => boolean;
  /** Create a zero-area bounds located at a single point. */
  readonly fromPoint: (p: Point2D) => Bounds;
  /**
   * Compute the tightest bounds enclosing all given points.
   * @returns `null` when the array is empty.
   */
  readonly fromPoints: (points: readonly Point2D[]) => Bounds | null;
  /** Create bounds from an origin and dimensions (x, y, width, height). */
  readonly fromXYWH: (x: number, y: number, w: number, h: number) => Bounds;
  /** Return the smallest bounds that contains both `a` and `b`. */
  readonly union: (a: Bounds, b: Bounds) => Bounds;
  /**
   * Merge an array of nullable bounds into one. Skips `null` entries.
   * @returns `null` when every entry is `null`.
   */
  readonly unionAll: (bounds: readonly (Bounds | null)[]) => Bounds | null;
  /** Expand bounds just enough to include the given point. */
  readonly includePoint: (b: Bounds, p: Point2D) => Bounds;
  readonly width: (b: Bounds) => number;
  readonly height: (b: Bounds) => number;
  readonly center: (b: Bounds) => Point2D;
  /** Test whether a point lies inside or on the edge of the bounds. */
  readonly containsPoint: (b: Bounds, p: Point2D) => boolean;
  /** Test whether two bounds overlap (inclusive of touching edges). */
  readonly overlaps: (a: Bounds, b: Bounds) => boolean;
  /** Grow the bounds outward by `padding` on every side. Use a negative value to shrink. */
  readonly expand: (b: Bounds, padding: number) => Bounds;
  /** Convert to a {@link Rect2D} with x/y/width/height and edge accessors. */
  readonly toRect: (b: Bounds) => Rect2D;
};
//#endregion
//#region ../types/src/ids.d.ts
/**
 * Branded ID types for type-safe identification of font entities.
 *
 * These types ensure compile-time safety when working with IDs across the
 * TS/Rust boundary. Most ids are prefixed strings (`point_<short-id>`). The
 * renderer MINTS ids for entities it creates (client-minted ids: verbs return
 * identity synchronously; Rust validates and honors them); all other ids come
 * from Rust.
 */
declare const PointIdBrand: unique symbol;
declare const ContourIdBrand: unique symbol;
declare const SwapIdBrand: unique symbol;
declare const AnchorIdBrand: unique symbol;
declare const AxisIdBrand: unique symbol;
declare const AxisLabelIdBrand: unique symbol;
declare const AxisMappingIdBrand: unique symbol;
declare const ComponentIdBrand: unique symbol;
declare const GlyphIdBrand: unique symbol;
declare const KerningGroupIdBrand: unique symbol;
declare const LayerIdBrand: unique symbol;
declare const MetricIdBrand: unique symbol;
declare const NamedInstanceIdBrand: unique symbol;
declare const NodeIdBrand: unique symbol;
declare const SegmentIdBrand: unique symbol;
declare const TextItemIdBrand: unique symbol;
declare const SourceIdBrand: unique symbol;
/**
 * A point identifier from Rust.
 * Branded string type - can't be confused with ContourId or plain strings.
 */
type PointId = string & {
  readonly [PointIdBrand]: typeof PointIdBrand;
};
/**
 * A contour identifier from Rust.
 * Branded string type - can't be confused with PointId or plain strings.
 */
type ContourId = string & {
  readonly [ContourIdBrand]: typeof ContourIdBrand;
};
/**
 * An anchor identifier from Rust.
 * Branded string type - can't be confused with PointId/ContourId or plain strings.
 */
type AnchorId = string & {
  readonly [AnchorIdBrand]: typeof AnchorIdBrand;
};
/**
 * A glyph swap identifier from Rust: one of the glyphs text draws in a
 * glyph's place where a condition holds. Unique in the font.
 */
type SwapId = string & {
  readonly [SwapIdBrand]: typeof SwapIdBrand;
};
/**
 * An axis identifier from Rust.
 * Branded string type - can't be confused with OpenType axis tags.
 */
type AxisId = string & {
  readonly [AxisIdBrand]: typeof AxisIdBrand;
};
/** A stable identifier for one user-space axis label. */
type AxisLabelId = string & {
  readonly [AxisLabelIdBrand]: typeof AxisLabelIdBrand;
};
/** A stable identifier for one font-owned axis mapping. */
type AxisMappingId = string & {
  readonly [AxisMappingIdBrand]: typeof AxisMappingIdBrand;
};
/**
 * A component identifier from Rust.
 * Branded string type - can't be confused with other IDs or plain strings.
 */
type ComponentId = string & {
  readonly [ComponentIdBrand]: typeof ComponentIdBrand;
};
/**
 * A glyph identifier from Rust.
 * Branded string type - can't be confused with names or other IDs.
 */
type GlyphId = string & {
  readonly [GlyphIdBrand]: typeof GlyphIdBrand;
};
/**
 * A kerning group identifier from Rust. Pairs reference a group by id, so a
 * group keeps its kerning when renamed.
 */
type KerningGroupId = string & {
  readonly [KerningGroupIdBrand]: typeof KerningGroupIdBrand;
};
/**
 * A layer identifier from Rust.
 * Branded string type - can't be confused with other IDs or plain strings.
 */
type LayerId = string & {
  readonly [LayerIdBrand]: typeof LayerIdBrand;
};
/** Stable identity of one font-owned metric definition. */
type MetricId = string & {
  readonly [MetricIdBrand]: typeof MetricIdBrand;
};
/** A stable identifier for one authored product preset. */
type NamedInstanceId = string & {
  readonly [NamedInstanceIdBrand]: typeof NamedInstanceIdBrand;
};
/**
 * A scene node identifier minted by the renderer.
 *
 * Node ids identify placed editor nodes. They are placement identity only;
 * commands that mutate authored glyph geometry must resolve the glyph layer
 * separately from document glyph identity and designspace location.
 */
type NodeId = string & {
  readonly [NodeIdBrand]: typeof NodeIdBrand;
};
/** Stable identity of one segment derived from its endpoint identities. */
type SegmentId = string & {
  readonly [SegmentIdBrand]: typeof SegmentIdBrand;
};
/** Identity of a glyph or linebreak within a proof text run. */
type TextItemId = string & {
  readonly [TextItemIdBrand]: typeof TextItemIdBrand;
};
/**
 * A source identifier from Rust.
 * Branded string type - can't be confused with other IDs or plain strings.
 */
type SourceId = string & {
  readonly [SourceIdBrand]: typeof SourceIdBrand;
};
/** Identifies an editor-addressable scene node or glyph object. */
type ShiftId = NodeId | PointId | AnchorId | ContourId | SegmentId | ComponentId | TextItemId;
/** Identifies objects that can be selected by the editor. */
type SelectableId = ShiftId;
/** A glyph's authored name, such as `A` or `uni0041`. */
type GlyphName = string;
//#endregion
//#region ../types/src/bridge/protocol.d.ts
interface FontMetadata {
  readonly familyName?: string | null;
  readonly styleName?: string | null;
  readonly versionMajor?: number | null;
  readonly versionMinor?: number | null;
  readonly copyright?: string | null;
  readonly trademark?: string | null;
  readonly designer?: string | null;
  readonly designerUrl?: string | null;
  readonly manufacturer?: string | null;
  readonly manufacturerUrl?: string | null;
  readonly license?: string | null;
  readonly licenseUrl?: string | null;
  readonly description?: string | null;
  readonly note?: string | null;
}
interface FontMetrics {
  readonly unitsPerEm: number;
}
type MetricKind = "ascender" | "capHeight" | "xHeight" | "baseline" | "descender" | "custom";
interface MetricDefinition {
  readonly id: MetricId;
  readonly kind: MetricKind;
  readonly name: string;
}
interface Location {
  readonly values: Readonly<Record<AxisId, number>>;
}
/**
 * One source's authored position and alignment-zone overshoot for a metric.
 *
 * Both values are expressed in font units. Overshoots are positive above a
 * metric line and negative below it.
 */
interface MetricValue {
  readonly position: number;
  readonly overshoot: number;
}
/**
 * How a source participates in the font. A `Master` is a genuine
 * designspace source: it has a design-space location and earns a
 * `<source>` entry when the font is written as a designspace. A `Layer`
 * only carries a format layer that rides along with its file's masters
 * (e.g. a plain UFO background layer) and must never gain a designspace
 * `<source>` entry on save.
 */
type SourceRole = "master" | "layer";
interface Source {
  readonly id: SourceId;
  readonly name: string;
  readonly location: Location;
  readonly metricValues: Readonly<Record<MetricId, MetricValue>>;
  readonly italicAngle?: number | null;
  readonly lineGap?: number | null;
  readonly underlinePosition?: number | null;
  readonly underlineThickness?: number | null;
  readonly filename?: string | null;
  readonly color?: string | null;
  readonly role: SourceRole;
  readonly layerName?: string | null;
}
type AxisRole = "external" | "internal";
type AxisKind =
  | {
      readonly kind: "continuous";
      readonly minimum: number;
      readonly default: number;
      readonly maximum: number;
    }
  | {
      readonly kind: "discrete";
      readonly values: readonly number[];
      readonly default: number;
    };
interface AxisLabelRange {
  readonly minimum: number;
  readonly maximum: number;
}
/**
 * One authored external-axis name and its stable identity.
 *
 * Labels describe values for authoring UI and STAT output. They do not create
 * products or reference sources.
 */
interface AxisLabel {
  readonly id: AxisLabelId;
  readonly name: string;
  readonly value: number;
  readonly range?: AxisLabelRange | null;
  readonly linkedValue?: number | null;
  readonly elidable: boolean;
}
interface Axis {
  readonly id: AxisId;
  readonly tag: string;
  readonly name: string;
  readonly role: AxisRole;
  readonly kind: AxisKind;
  readonly labels: readonly AxisLabel[];
  readonly hidden: boolean;
}
interface AxisMappingPoint {
  readonly description?: string | null;
  readonly input: Location;
  readonly output: Location;
}
interface AxisMapping {
  readonly id: AxisMappingId;
  readonly name: string;
  readonly description?: string | null;
  readonly inputs: readonly AxisId[];
  readonly outputs: readonly AxisId[];
  readonly points: readonly AxisMappingPoint[];
}
/**
 * Wire projection of an explicit named product preset.
 *
 * `location` is complete external authoring state, not a normalized or
 * compiler-owned coordinate record.
 */
interface NamedInstance {
  readonly id: NamedInstanceId;
  readonly name: string;
  readonly location: Location;
  readonly postscriptName?: string | null;
}
/**
 * The grid a font is drawn on: line spacing on each axis and how many
 * divisions each cell takes.
 *
 * Spacing is in font units, counted from a glyph's origin. Whether the grid
 * is shown or snapped to is a choice of the window, not the font, and is not
 * stored here.
 */
interface Grid {
  readonly spacingX: number;
  readonly spacingY: number;
  readonly subdivisions: number;
}
/**
 * Pair position a kerning group applies to: `First` kerns a glyph's right
 * edge, `Second` its left edge.
 */
type KerningPosition = "first" | "second";
/**
 * One side of a kerning pair: a single glyph or a group.
 *
 * A group side only resolves when the group's position matches the side it
 * occupies in the pair.
 */
type KerningSide =
  | {
      readonly kind: "glyph";
      readonly glyph: GlyphId;
    }
  | {
      readonly kind: "group";
      readonly group: KerningGroupId;
    };
type PointType = "onCurve" | "offCurve" | "qCurve";
/** Whether a component is placed by its anchors or by hand. */
type ComponentAlignment = "unset" | "anchored" | "free";
/**
 * Where a component's base glyph takes the axes its
 * [location](Component::location) doesn't set.
 */
type ComponentInheritance = "parent" | "font";
/**
 * An inclusive range on one axis, in that axis's design units. `None` on a
 * side leaves the range open there.
 */
interface ConditionRange {
  readonly axisId: AxisId;
  readonly min?: number | null;
  readonly max?: number | null;
}
/**
 * Where something applies: every one of its ranges must hold.
 *
 * The ranges are kept behind constructors so other forms (any of, not) can
 * join them without changing how callers build or evaluate a condition.
 */
interface Condition {
  readonly all: readonly ConditionRange[];
}
/**
 * One of a glyph's swaps: where its condition holds on the font's
 * axes, text draws `glyph` in the glyph's place.
 */
interface GlyphSwap {
  readonly id: SwapId;
  readonly condition: Condition;
  readonly glyph: GlyphId;
}
/**
 * One of Glyphs' twelve label colours, in Glyphs' order: a colour's
 * place in [`NamedMarkColor::ALL`] is the index a Glyphs file stores
 * for it.
 */
type NamedMarkColor =
  | "red"
  | "orange"
  | "brown"
  | "yellow"
  | "lightGreen"
  | "darkGreen"
  | "lightBlue"
  | "darkBlue"
  | "purple"
  | "magenta"
  | "lightGray"
  | "charcoal";
/**
 * A colour as red, green, blue and alpha, each from 0 to 1, as a UFO
 * writes colours.
 *
 * Its text form is the UFO one: the four channels separated by commas,
 * such as `0.5,0.09,0.79,1`.
 */
interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}
/**
 * The colour a glyph is tagged with.
 *
 * Its text form is the colour's name for [`MarkColor::Named`] and the
 * [`Rgba`] text for [`MarkColor::Custom`].
 */
type MarkColor =
  | {
      readonly kind: "named";
      readonly named: NamedMarkColor;
    }
  /** A colour outside the twelve, as another tool wrote it. */
  | {
      readonly kind: "custom";
      readonly custom: Rgba;
    };
/** A point to create, with stable identity minted by a trusted caller. */
interface PointSeed {
  readonly id: PointId;
  readonly x: number;
  readonly y: number;
  readonly pointType: PointType;
  readonly smooth: boolean;
}
interface AddPoints {
  readonly layerId: LayerId;
  /**
   * Target contour; when `None`, derived from `before` (Rust owns
   * identity resolution — the renderer never bookkeeps pending
   * point→contour maps).
   */
  readonly contourId?: ContourId | null;
  /** Insert before this point; append when `None`. */
  readonly before?: PointId | null;
  readonly points: readonly PointSeed[];
}
interface AddContour {
  readonly layerId: LayerId;
  readonly contourId: ContourId;
  readonly closed: boolean;
}
interface SetContourClosed {
  readonly layerId: LayerId;
  readonly contourId: ContourId;
  readonly closed: boolean;
}
interface MovePoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  /** Interleaved absolute coordinates: x0, y0, x1, y1, … */
  readonly coords: readonly number[];
}
interface SetPointSmooth {
  readonly layerId: LayerId;
  readonly pointId: PointId;
  readonly smooth: boolean;
}
interface RemovePoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
}
/** An anchor to create, with stable identity minted by a trusted caller. */
interface AnchorSeed {
  readonly id: AnchorId;
  readonly name?: string | null;
  readonly x: number;
  readonly y: number;
}
interface AddAnchors {
  readonly layerId: LayerId;
  readonly anchors: readonly AnchorSeed[];
}
interface MoveAnchors {
  readonly layerId: LayerId;
  readonly anchorIds: readonly AnchorId[];
  /** Interleaved absolute coordinates: x0, y0, x1, y1, … */
  readonly coords: readonly number[];
}
/**
 * Sets every point and anchor position of a layer at once: a move of many
 * points that names none of them, so it costs numbers, not ids.
 */
interface SetPositions {
  readonly layerId: LayerId;
  /**
   * Every contour point, contour after contour, then every anchor, each as
   * `x, y`.
   */
  readonly positions: Float64Array;
}
interface RemoveAnchors {
  readonly layerId: LayerId;
  readonly anchorIds: readonly AnchorId[];
}
/** Renames anchors in one layer; `names[i]` is the new name of `anchor_ids[i]`. */
interface RenameAnchors {
  readonly layerId: LayerId;
  readonly anchorIds: readonly AnchorId[];
  readonly names: readonly string[];
}
/** Adds one direct reference after rejecting direct or transitive component cycles. */
interface AddComponent {
  readonly layerId: LayerId;
  readonly componentId: ComponentId;
  readonly baseGlyphId: GlyphId;
}
/** Replaces direct component transforms without changing component identity or order. */
interface SetComponentTransforms {
  readonly layerId: LayerId;
  readonly componentIds: readonly ComponentId[];
  /** Nine decomposed values per component in interpolation order. */
  readonly transforms: readonly number[];
}
/**
 * Records whether components are placed by their anchors; anchoring one
 * also places it on its anchors now.
 */
interface SetComponentAlignment {
  readonly layerId: LayerId;
  readonly componentIds: readonly ComponentId[];
  readonly alignment: ComponentAlignment;
}
/**
 * Sets where components draw their base glyphs: the axes each one sets,
 * and where it takes the rest from.
 *
 * Each component's location replaces the one it had, so an empty location
 * removes every override. Which axes a component sets is part of its
 * layer's structure: masters that set different axes stop interpolating
 * together, so an edit meant for every master names each master's layer.
 */
interface SetComponentLocations {
  readonly layerId: LayerId;
  readonly componentIds: readonly ComponentId[];
  /** One per component, in design units of the font's axes. */
  readonly locations: readonly Location[];
  /** One per component. */
  readonly inheritances: readonly ComponentInheritance[];
}
interface RemoveComponents {
  readonly layerId: LayerId;
  readonly componentIds: readonly ComponentId[];
}
interface DecomposeComponents {
  readonly layerId: LayerId;
  readonly componentIds: readonly ComponentId[];
}
interface ReverseContour {
  readonly layerId: LayerId;
  readonly contourId: ContourId;
}
/** Rotates a closed contour to an existing on-curve point without changing its geometry. */
interface SetContourStart {
  readonly layerId: LayerId;
  readonly contourId: ContourId;
  readonly pointId: PointId;
}
/** Affine move: O(selection-ids) wire instead of O(N) coords. */
interface TranslatePoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  readonly dx: number;
  readonly dy: number;
}
/**
 * Raw 2D affine transformation matrix (6 values).
 *
 * Represents a 3x3 homogeneous matrix with implicit bottom row [0, 0, 1]:
 * ```text
 * | xx  yx  dx |
 * | xy  yy  dy |
 * | 0   0   1  | (implicit)
 * ```
 */
interface Matrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}
/**
 * Affine transform of the whole layer: every contour point, anchor, and
 * component placement. The advance width is unchanged.
 */
interface TransformLayer {
  readonly layerId: LayerId;
  readonly transform: Matrix;
}
interface SetXAdvance {
  readonly layerId: LayerId;
  readonly width: number;
}
type BooleanOp = "union" | "subtract" | "intersect" | "difference";
/**
 * Rust-only computation: the echo is the same replace-grade shape as
 * every other intent — remote changes are not a special case.
 */
interface ApplyBooleanOp {
  readonly layerId: LayerId;
  readonly contourIdA: ContourId;
  readonly contourIdB: ContourId;
  readonly operation: BooleanOp;
}
/** How deleting points reconnects the points that survive. */
type DeleteMode = "fit" | "gap";
/** Deletes points and reconnects what survives: see [`GlyphLayer::delete_points`]. */
interface DeletePoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  readonly mode: DeleteMode;
}
/** Splits a segment at `t`, keeping its shape: see [`GlyphLayer::split_segment`]. */
interface SplitSegment {
  readonly layerId: LayerId;
  readonly startId: PointId;
  readonly endId: PointId;
  readonly t: number;
  /** The new on-curve point, minted by the caller so it can keep drawing from it. */
  readonly pointId: PointId;
}
/** Raises a line to a cubic of the same shape: see [`GlyphLayer::upgrade_line_to_cubic`]. */
interface UpgradeLineToCubic {
  readonly layerId: LayerId;
  readonly startId: PointId;
  readonly endId: PointId;
}
/** Which end of an open contour. */
type ContourSide = "start" | "end";
/** One open end of a contour. */
interface ContourEnd {
  readonly contourId: ContourId;
  readonly side: ContourSide;
}
/** How [`GlyphLayer::join_contours`] connects two ends. */
type JoinMode = "merge" | "connect";
/** Closes a contour or joins two by their ends: see [`GlyphLayer::join_contours`]. */
interface JoinContours {
  readonly layerId: LayerId;
  readonly from: ContourEnd;
  readonly to: ContourEnd;
  readonly mode: JoinMode;
}
/** Moves points by one affine transform. */
interface TransformPoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  readonly transform: Matrix;
}
/** Where [`GlyphLayer::align_points`] puts the points, in their own box. */
type PointAlignment = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";
/** Lines points up on an edge or centre of their box: see [`GlyphLayer::align_points`]. */
interface AlignPoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  readonly alignment: PointAlignment;
}
/** The axis [`GlyphLayer::distribute_points`] spaces the points along. */
type DistributeAxis = "horizontal" | "vertical";
/** Spaces points evenly along an axis: see [`GlyphLayer::distribute_points`]. */
interface DistributePoints {
  readonly layerId: LayerId;
  readonly pointIds: readonly PointId[];
  readonly axis: DistributeAxis;
}
/** One sidebearing of a layer. */
type Sidebearing = "lsb" | "rsb";
/** Adds to one sidebearing: see [`GlyphLayer::shift_sidebearing`]. */
interface ShiftSidebearing {
  readonly layerId: LayerId;
  readonly sidebearing: Sidebearing;
  readonly delta: number;
}
/** The metric a key sets. */
type MetricsKeySide = "left" | "right" | "width";
/**
 * Sets or clears one of a layer's metrics keys, for its source only,
 * overriding the glyph's key for that side. `key` is kept as written; empty
 * or blank text clears it. The side then follows the key in this same edit.
 */
interface SetLayerMetricsKey {
  readonly layerId: LayerId;
  readonly side: MetricsKeySide;
  readonly key?: string | null;
}
interface Point {
  readonly id: PointId;
  readonly x: number;
  readonly y: number;
  readonly pointType: PointType;
  readonly smooth: boolean;
}
interface Contour {
  readonly id: ContourId;
  readonly points: readonly Point[];
  readonly closed: boolean;
}
interface Anchor {
  readonly id: AnchorId;
  readonly name?: string | null;
  readonly x: number;
  readonly y: number;
}
/**
 * Decomposed 2D transformation with explicit scale, rotation, skew, and translation.
 * Composition order: translate to center → rotate → scale → skew → translate back
 */
interface DecomposedTransform {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly skewX: number;
  readonly skewY: number;
  readonly tCenterX: number;
  readonly tCenterY: number;
}
interface Component {
  readonly id: ComponentId;
  readonly baseGlyphId: GlyphId;
  readonly baseGlyphName: GlyphName;
  readonly transform: DecomposedTransform;
  readonly alignment: ComponentAlignment;
  /**
   * The axes this component sets for its base glyph, in design units.
   * Empty when it sets none.
   */
  readonly location: Location;
  readonly inheritance: ComponentInheritance;
  /**
   * Where the component draws: nowhere its condition fails, evaluated
   * where it draws its base glyph ([`Self::base_location`]). Last and
   * skipped when it always holds, so components without one keep their
   * bytes in positional encodings.
   */
  readonly condition: Condition;
}
/**
 * Replaces drawing content while preserving layer identity, source, height, guidelines, and lib.
 *
 * Values use font units and supplied entity identities. The complete replacement
 * is validated before installation and refreshes component dependencies.
 */
interface ReplaceGlyphLayerContent {
  readonly layerId: LayerId;
  readonly width: number;
  readonly contours: readonly Contour[];
  readonly anchors: readonly Anchor[];
  readonly components: readonly Component[];
}
/**
 * Creates glyph identity and metadata only. Authored editable data is
 * created by explicit `CreateGlyphLayer` intents.
 */
interface CreateGlyph {
  /**
   * Caller-minted id so the verb returns identity synchronously;
   * `None` mints Rust-side.
   */
  readonly glyphId?: GlyphId | null;
  readonly name: string;
  readonly unicodes: readonly number[];
}
interface UpdateGlyph {
  /** Stable id of the existing glyph to rename. */
  readonly glyphId: GlyphId;
  readonly newName: GlyphName;
  readonly newUnicodes: readonly number[];
}
/** Replaces authored font metadata without changing font metrics. */
interface UpdateFontMetadata {
  readonly metadata: FontMetadata;
}
/**
 * Replaces the tracked language list stored under
 * [`LANGUAGES_LIB_KEY`].
 *
 * Ids are Hyperglot language ids. Blank ids are dropped and duplicates
 * keep their first position; an empty list is stored as an empty array,
 * which is distinct from the key being absent.
 */
interface SetLanguages {
  readonly languageIds: readonly string[];
}
/**
 * Replaces the grid the font is drawn on, stored under [`crate::GRID_LIB_KEY`];
 * `None` removes it, so the editor falls back to its default grid.
 */
interface SetGrid {
  readonly grid?: Grid | null;
}
interface CreateAxis {
  readonly axis: Axis;
}
interface UpdateAxis {
  readonly axis: Axis;
}
interface DeleteAxis {
  readonly axisId: AxisId;
}
interface SetAxisMappings {
  readonly mappings: readonly AxisMapping[];
}
interface SetMetricDefinitions {
  readonly definitions: readonly MetricDefinition[];
}
interface CreateNamedInstance {
  readonly instance: NamedInstance;
}
interface UpdateNamedInstance {
  readonly instance: NamedInstance;
}
interface DeleteNamedInstance {
  readonly instanceId: NamedInstanceId;
}
interface DeleteSource {
  readonly sourceId: SourceId;
}
/**
 * Creates a global source record only. Glyph layers are authored by
 * explicit `CreateGlyphLayer` intents.
 */
interface CreateSource {
  readonly sourceId: SourceId;
  readonly name: string;
  readonly location: Location;
}
/** Replaces the editable authoring values of an existing master source. */
interface UpdateSource {
  readonly sourceId: SourceId;
  readonly name: string;
  readonly location: Location;
  readonly metricValues: Readonly<Record<MetricId, MetricValue>>;
  readonly italicAngle?: number | null;
  readonly lineGap?: number | null;
  readonly underlinePosition?: number | null;
  readonly underlineThickness?: number | null;
}
/** Creates one sparse editable glyph layer at one source. */
interface CreateGlyphLayer {
  readonly layerId: LayerId;
  readonly glyphId: GlyphId;
  readonly sourceId: SourceId;
}
/** Creates one editable glyph layer by copying another layer's shape with fresh internal ids. */
interface CloneGlyphLayer {
  readonly layerId: LayerId;
  readonly glyphId: GlyphId;
  readonly sourceId: SourceId;
  readonly fromLayerId: LayerId;
}
/** An ordered kerning pair, independent of any source's value for it. */
interface KerningPair {
  readonly first: KerningSide;
  readonly second: KerningSide;
}
/** One kerning pair value to set or remove at one source. */
interface KerningValueEdit {
  readonly sourceId: SourceId;
  readonly pair: KerningPair;
  /** The new value in font units; `None` removes the pair at this source. */
  readonly value?: number | null;
}
/**
 * Sets or removes kerning pair values at sources, in order.
 *
 * Every source, glyph side, and group side must exist; groups are
 * created separately. Editing a value never changes group membership.
 */
interface SetKerningValues {
  readonly edits: readonly KerningValueEdit[];
}
/**
 * Creates an empty kerning group at a pair position, under an id the
 * caller mints. The name is trimmed, and must be non-blank, free of
 * control characters, and unique at its position.
 */
interface CreateKerningGroup {
  readonly groupId: KerningGroupId;
  readonly position: KerningPosition;
  readonly name: string;
}
/**
 * Moves a glyph into a group at the group's pair position, out of any
 * other group there, or out of its group at `position` with `None`.
 */
interface SetKerningGroupMember {
  readonly position: KerningPosition;
  readonly glyphId: GlyphId;
  readonly groupId?: KerningGroupId | null;
}
/** Renames a group. Pairs reference it by id, so its kerning is unchanged. */
interface RenameKerningGroup {
  readonly groupId: KerningGroupId;
  readonly name: string;
}
/**
 * Deletes a group. Pairs that reference it are kept and never resolve,
 * so undoing the delete restores its kerning.
 */
interface DeleteKerningGroup {
  readonly groupId: KerningGroupId;
}
/**
 * Creates one editable layer from compatible resolved numeric values.
 *
 * The source layer supplies authored structure and non-varying data. The
 * resolved values replace its advance, coordinates, and component
 * transforms after fresh internal identities are minted.
 */
interface MaterializeGlyphLayer {
  readonly layerId: LayerId;
  readonly glyphId: GlyphId;
  readonly sourceId: SourceId;
  readonly fromLayerId: LayerId;
  readonly values: Float64Array;
}
/**
 * Sets or clears one of a glyph's metrics keys, which apply in every source
 * its layers do not override. `key` is kept as written; empty or blank text
 * clears it. The side then follows the key in this same edit.
 */
interface SetGlyphMetricsKey {
  readonly glyphId: GlyphId;
  readonly side: MetricsKeySide;
  readonly key?: string | null;
}
/**
 * Links one side of a layer's glyph with `key`, as typing it does: a key
 * starting `==` is the layer's own, for its source only; any other is the
 * glyph's, for every source, and clears a key the layer had of its own for
 * the side so the glyph's applies. Blank text removes the side's key,
 * wherever it is set. The side then follows the key in this same edit.
 */
interface LinkMetricsSide {
  readonly layerId: LayerId;
  readonly side: MetricsKeySide;
  readonly key: string;
}
/**
 * Clears the keys that would pull an edit of one side of a layer's glyph
 * back, where each is set, as typing or dragging a value does: a right
 * sidebearing and a width hold each other ([`MetricsKeySide::sides_holding`]).
 * A glyph's key stops applying in every source.
 */
interface UnlinkMetricsSide {
  readonly layerId: LayerId;
  readonly side: MetricsKeySide;
}
/**
 * Tags every glyph in `glyph_ids` with `color`, or clears their tags, as
 * one edit. The colour is the glyph's in every source; a layer's lib keeps
 * whatever colour the file it came from gave it.
 */
interface SetMarkColor {
  readonly glyphIds: readonly GlyphId[];
  readonly color?: MarkColor | null;
}
/** One glyph to copy, with the identity its copy takes. */
interface GlyphCopy {
  /** The glyph copied. */
  readonly glyphId: GlyphId;
  /** Caller-minted id of the copy, so the caller can select it at once. */
  readonly copyId: GlyphId;
}
/**
 * Copies glyphs as one edit. A copy is named after its original with the
 * first free numbered suffix (`a.001`, `a.002`, …), has no code points, and
 * keeps the original's layers under new ids, its category, metrics keys,
 * mark colour and lib. It joins no kerning group.
 */
interface DuplicateGlyphs {
  readonly copies: readonly GlyphCopy[];
}
/**
 * Turns every component of the glyphs into contours, in every layer, as one
 * edit: nested components are flattened too, and each glyph keeps its own
 * anchors. A glyph with no components is left as it is.
 */
interface DecomposeGlyphs {
  readonly glyphIds: readonly GlyphId[];
}
/** Which of a glyph's layers a batch edit changes. */
type LayerScope =
  /** The glyph's layer in one source. */
  | {
      readonly kind: "source";
      readonly source: SourceId;
    }
  /** Its layer in every master. */
  | {
      readonly kind: "everyMaster";
    };
/** What a batch edit does to one sidebearing of each glyph. */
type SidebearingEdit =
  /** Leaves the side as it is. */
  | {
      readonly kind: "keep";
    }
  /**
   * Gives the side this value in font units, first clearing the keys that
   * would pull it back, as typing a value in the sidebar does.
   */
  | {
      readonly kind: "set";
      readonly set: number;
    }
  /**
   * Adds this many font units to the side, and leaves a side a key links
   * alone.
   */
  | {
      readonly kind: "adjust";
      readonly adjust: number;
    }
  /** Links the side with this key, as typing it in the sidebar does. */
  | {
      readonly kind: "link";
      readonly link: string;
    };
/**
 * Edits the left and right sidebearings of several glyphs as one edit. A
 * glyph with no outline in a layer has no sidebearings there, so setting or
 * adjusting skips it; linking does not. Glyphs are edited base before
 * composite, so a composite ends with the value asked for even when a glyph
 * it is built from moves in the same edit.
 */
interface SetSidebearings {
  readonly glyphIds: readonly GlyphId[];
  readonly scope: LayerScope;
  readonly left: SidebearingEdit;
  readonly right: SidebearingEdit;
}
/**
 * An axis's minimum, default and maximum in one coordinate space, and the
 * rule that maps a coordinate in that space to `-1..=1`.
 *
 * The space is the caller's: user coordinates for an axis's authored range,
 * design coordinates for [`DesignNormalization`].
 *
 * `minimum` is the value that normalizes to `-1` and `maximum` the one that
 * normalizes to `1`. In user space `minimum <= default <= maximum`; a design
 * range under a decreasing axis mapping runs the other way, `minimum` above
 * `maximum`, because normalized signs follow the user axis.
 */
interface AxisRange {
  readonly minimum: number;
  readonly default: number;
  readonly maximum: number;
}
/**
 * Adds an axis to one glyph, such as Spread on `dot`. Without a tag, the
 * axis gets a private one from its name (`Spread` is `SPRD`).
 */
interface CreateGlyphAxis {
  readonly glyphId: GlyphId;
  /** Caller-minted id, unique among font axes and every glyph's axes. */
  readonly axisId: AxisId;
  readonly name: string;
  /** A four-character tag; `None` picks one from the name. */
  readonly tag?: string | null;
  /** In the axis's own units. */
  readonly range: AxisRange;
}
/**
 * An edit to an existing glyph axis, applied with
 * [`Font::edit_glyph_axis`](crate::Font::edit_glyph_axis).
 */
type GlyphAxisEdit =
  /** Gives the axis a new name; its tag stays. */
  | {
      readonly kind: "name";
      readonly name: string;
    }
  /** Gives the axis a new tag. */
  | {
      readonly kind: "tag";
      readonly tag: string;
    }
  /** Gives the axis a new range; every stored value stays where it is. */
  | {
      readonly kind: "range";
      readonly range: AxisRange;
    }
  /** Gives the axis a new range and moves every stored value with it. */
  | {
      readonly kind: "rescale";
      readonly rescale: AxisRange;
    }
  /** Removes the axis. */
  | {
      readonly kind: "remove";
    };
/**
 * Renames, retags, changes the range of, rescales or removes a glyph axis:
 * see [`Font::edit_glyph_axis`]. A range edit that would leave a drawing or
 * a component outside the range is refused, rescaling moves every stored
 * value with the range, and an axis is removed only once no drawing or
 * component sets a value on it.
 */
interface EditGlyphAxis {
  readonly axisId: AxisId;
  readonly edit: GlyphAxisEdit;
}
/**
 * Creates one empty drawing of a glyph at a location: coordinates laid over
 * a base source, or coordinates alone with every axis they don't name at its
 * default. A `dot` drawn at Spread 100 on Regular and an `H` drawn at Bleed
 * 50 with no base are both made this way.
 */
interface CreateLocatedGlyphLayer {
  readonly layerId: LayerId;
  readonly glyphId: GlyphId;
  readonly baseSourceId?: SourceId | null;
  /** Values on font axes and the glyph's own axes, in each axis's units. */
  readonly coordinates: Location;
}
/**
 * Creates one drawing of a glyph at a location with what the glyph draws
 * there: a copy of `from_layer_id`, one of its drawings, with fresh ids and
 * `values`, the glyph as interpolated at that location. The editor's "Add
 * drawing here" makes a drawing this way, so it starts from the outline
 * shown.
 */
interface MaterializeLocatedGlyphLayer {
  /** The drawing and where it sits. */
  readonly layer: CreateLocatedGlyphLayer;
  readonly fromLayerId: LayerId;
  readonly values: Float64Array;
}
/** Moves one drawing to a new location, keeping its content and identity. */
interface SetGlyphLayerLocation {
  readonly layerId: LayerId;
  readonly baseSourceId?: SourceId | null;
  /** Values on font axes and the glyph's own axes, in each axis's units. */
  readonly coordinates: Location;
}
/** Removes one drawing of a glyph, wherever it sits. */
interface DeleteGlyphLayer {
  readonly layerId: LayerId;
}
/**
 * Replaces a glyph's swaps with `swaps`, tried in order: the
 * whole list at once, as a batch import writes it.
 */
interface SetGlyphSwaps {
  readonly glyphId: GlyphId;
  /** Each with a caller-minted id unique in the font. */
  readonly swaps: readonly GlyphSwap[];
}
/**
 * Adds one swap to a glyph, such as `dollar.bled` where Bleed is at
 * least 70.
 */
interface AddGlyphSwap {
  readonly glyphId: GlyphId;
  /** With a caller-minted id unique in the font. */
  readonly swap: GlyphSwap;
  /**
   * Zero-based position in the list, which is tried in order; `None`
   * adds it last, where it is tried after every other.
   */
  readonly position?: number | null;
}
/** What [`EditGlyphSwap`] does to one swap. */
type GlyphSwapEdit =
  /** Replaces where it applies. */
  | {
      readonly kind: "condition";
      readonly condition: Condition;
    }
  /** Replaces the glyph it draws. */
  | {
      readonly kind: "glyph";
      readonly glyph: GlyphId;
    }
  /**
   * Moves it to this zero-based position, counted after it leaves its
   * current one.
   */
  | {
      readonly kind: "move";
      readonly move: number;
    }
  /** Removes it; its glyph stays in the font. */
  | {
      readonly kind: "remove";
    };
/** Edits or removes one swap, wherever its glyph is. */
interface EditGlyphSwap {
  readonly swapId: SwapId;
  readonly edit: GlyphSwapEdit;
}
/**
 * Sets where one component draws, the same in every drawing of its glyph.
 *
 * The component is named by its id in one drawing; its counterparts are the
 * components at the same position in each other drawing whose components
 * draw the same glyphs in the same order, as interpolation matches them. A
 * drawing whose components differ is left as it is: it doesn't interpolate
 * with the others, and `check` reports it.
 *
 * The condition is evaluated where the glyph is drawn, before the
 * component's own location applies (skrifa's rule), so it may read font axes and the glyph's
 * own axes, never the axes of the glyph the component draws.
 */
interface SetComponentCondition {
  readonly layerId: LayerId;
  readonly componentId: ComponentId;
  /** In design units; [`Condition::always`] clears it. */
  readonly condition: Condition;
}
/** An edit a caller asks for. Each variant's struct documents it. */
type FontIntent =
  | {
      readonly kind: "addPoints";
      readonly addPoints: AddPoints;
    }
  | {
      readonly kind: "addContour";
      readonly addContour: AddContour;
    }
  | {
      readonly kind: "setContourClosed";
      readonly setContourClosed: SetContourClosed;
    }
  | {
      readonly kind: "movePoints";
      readonly movePoints: MovePoints;
    }
  | {
      readonly kind: "setPointSmooth";
      readonly setPointSmooth: SetPointSmooth;
    }
  | {
      readonly kind: "removePoints";
      readonly removePoints: RemovePoints;
    }
  | {
      readonly kind: "addAnchors";
      readonly addAnchors: AddAnchors;
    }
  | {
      readonly kind: "moveAnchors";
      readonly moveAnchors: MoveAnchors;
    }
  | {
      readonly kind: "setPositions";
      readonly setPositions: SetPositions;
    }
  | {
      readonly kind: "removeAnchors";
      readonly removeAnchors: RemoveAnchors;
    }
  | {
      readonly kind: "renameAnchors";
      readonly renameAnchors: RenameAnchors;
    }
  | {
      readonly kind: "addComponent";
      readonly addComponent: AddComponent;
    }
  | {
      readonly kind: "setComponentTransforms";
      readonly setComponentTransforms: SetComponentTransforms;
    }
  | {
      readonly kind: "setComponentAlignment";
      readonly setComponentAlignment: SetComponentAlignment;
    }
  | {
      readonly kind: "setComponentLocations";
      readonly setComponentLocations: SetComponentLocations;
    }
  | {
      readonly kind: "removeComponents";
      readonly removeComponents: RemoveComponents;
    }
  | {
      readonly kind: "decomposeComponents";
      readonly decomposeComponents: DecomposeComponents;
    }
  | {
      readonly kind: "reverseContour";
      readonly reverseContour: ReverseContour;
    }
  | {
      readonly kind: "setContourStart";
      readonly setContourStart: SetContourStart;
    }
  | {
      readonly kind: "translatePoints";
      readonly translatePoints: TranslatePoints;
    }
  | {
      readonly kind: "transformLayer";
      readonly transformLayer: TransformLayer;
    }
  | {
      readonly kind: "setXAdvance";
      readonly setXAdvance: SetXAdvance;
    }
  | {
      readonly kind: "applyBooleanOp";
      readonly applyBooleanOp: ApplyBooleanOp;
    }
  | {
      readonly kind: "deletePoints";
      readonly deletePoints: DeletePoints;
    }
  | {
      readonly kind: "splitSegment";
      readonly splitSegment: SplitSegment;
    }
  | {
      readonly kind: "upgradeLineToCubic";
      readonly upgradeLineToCubic: UpgradeLineToCubic;
    }
  | {
      readonly kind: "joinContours";
      readonly joinContours: JoinContours;
    }
  | {
      readonly kind: "transformPoints";
      readonly transformPoints: TransformPoints;
    }
  | {
      readonly kind: "alignPoints";
      readonly alignPoints: AlignPoints;
    }
  | {
      readonly kind: "distributePoints";
      readonly distributePoints: DistributePoints;
    }
  | {
      readonly kind: "shiftSidebearing";
      readonly shiftSidebearing: ShiftSidebearing;
    }
  | {
      readonly kind: "setLayerMetricsKey";
      readonly setLayerMetricsKey: SetLayerMetricsKey;
    }
  | {
      readonly kind: "replaceGlyphLayerContent";
      readonly replaceGlyphLayerContent: ReplaceGlyphLayerContent;
    }
  | {
      readonly kind: "createGlyph";
      readonly createGlyph: CreateGlyph;
    }
  | {
      readonly kind: "updateGlyph";
      readonly updateGlyph: UpdateGlyph;
    }
  | {
      readonly kind: "updateFontMetadata";
      readonly updateFontMetadata: UpdateFontMetadata;
    }
  | {
      readonly kind: "setLanguages";
      readonly setLanguages: SetLanguages;
    }
  | {
      readonly kind: "setGrid";
      readonly setGrid: SetGrid;
    }
  | {
      readonly kind: "createAxis";
      readonly createAxis: CreateAxis;
    }
  | {
      readonly kind: "updateAxis";
      readonly updateAxis: UpdateAxis;
    }
  | {
      readonly kind: "deleteAxis";
      readonly deleteAxis: DeleteAxis;
    }
  | {
      readonly kind: "setAxisMappings";
      readonly setAxisMappings: SetAxisMappings;
    }
  | {
      readonly kind: "setMetricDefinitions";
      readonly setMetricDefinitions: SetMetricDefinitions;
    }
  | {
      readonly kind: "createNamedInstance";
      readonly createNamedInstance: CreateNamedInstance;
    }
  | {
      readonly kind: "updateNamedInstance";
      readonly updateNamedInstance: UpdateNamedInstance;
    }
  | {
      readonly kind: "deleteNamedInstance";
      readonly deleteNamedInstance: DeleteNamedInstance;
    }
  | {
      readonly kind: "deleteSource";
      readonly deleteSource: DeleteSource;
    }
  | {
      readonly kind: "createSource";
      readonly createSource: CreateSource;
    }
  | {
      readonly kind: "updateSource";
      readonly updateSource: UpdateSource;
    }
  | {
      readonly kind: "createGlyphLayer";
      readonly createGlyphLayer: CreateGlyphLayer;
    }
  | {
      readonly kind: "cloneGlyphLayer";
      readonly cloneGlyphLayer: CloneGlyphLayer;
    }
  | {
      readonly kind: "setKerningValues";
      readonly setKerningValues: SetKerningValues;
    }
  | {
      readonly kind: "createKerningGroup";
      readonly createKerningGroup: CreateKerningGroup;
    }
  | {
      readonly kind: "setKerningGroupMember";
      readonly setKerningGroupMember: SetKerningGroupMember;
    }
  | {
      readonly kind: "renameKerningGroup";
      readonly renameKerningGroup: RenameKerningGroup;
    }
  | {
      readonly kind: "deleteKerningGroup";
      readonly deleteKerningGroup: DeleteKerningGroup;
    }
  | {
      readonly kind: "materializeGlyphLayer";
      readonly materializeGlyphLayer: MaterializeGlyphLayer;
    }
  | {
      readonly kind: "setGlyphMetricsKey";
      readonly setGlyphMetricsKey: SetGlyphMetricsKey;
    }
  | {
      readonly kind: "linkMetricsSide";
      readonly linkMetricsSide: LinkMetricsSide;
    }
  | {
      readonly kind: "unlinkMetricsSide";
      readonly unlinkMetricsSide: UnlinkMetricsSide;
    }
  | {
      readonly kind: "setMarkColor";
      readonly setMarkColor: SetMarkColor;
    }
  | {
      readonly kind: "duplicateGlyphs";
      readonly duplicateGlyphs: DuplicateGlyphs;
    }
  | {
      readonly kind: "decomposeGlyphs";
      readonly decomposeGlyphs: DecomposeGlyphs;
    }
  | {
      readonly kind: "setSidebearings";
      readonly setSidebearings: SetSidebearings;
    }
  | {
      readonly kind: "createGlyphAxis";
      readonly createGlyphAxis: CreateGlyphAxis;
    }
  | {
      readonly kind: "editGlyphAxis";
      readonly editGlyphAxis: EditGlyphAxis;
    }
  | {
      readonly kind: "createLocatedGlyphLayer";
      readonly createLocatedGlyphLayer: CreateLocatedGlyphLayer;
    }
  | {
      readonly kind: "materializeLocatedGlyphLayer";
      readonly materializeLocatedGlyphLayer: MaterializeLocatedGlyphLayer;
    }
  | {
      readonly kind: "setGlyphLayerLocation";
      readonly setGlyphLayerLocation: SetGlyphLayerLocation;
    }
  | {
      readonly kind: "deleteGlyphLayer";
      readonly deleteGlyphLayer: DeleteGlyphLayer;
    }
  | {
      readonly kind: "setGlyphSwaps";
      readonly setGlyphSwaps: SetGlyphSwaps;
    }
  | {
      readonly kind: "addGlyphSwap";
      readonly addGlyphSwap: AddGlyphSwap;
    }
  | {
      readonly kind: "editGlyphSwap";
      readonly editGlyphSwap: EditGlyphSwap;
    }
  | {
      readonly kind: "setComponentCondition";
      readonly setComponentCondition: SetComponentCondition;
    };
//#endregion
//#region ../types/src/domain.d.ts
/** Standard and technical metrics resolved for one authored source. */
type SourceMetrics = Readonly<
  FontMetrics & {
    metricValues: Readonly<Record<MetricId, MetricValue>>;
    ascender: number;
    descender: number;
    baseline: number;
    capHeight?: number;
    xHeight?: number;
    lineGap?: number;
    italicAngle?: number;
    underlinePosition?: number;
    underlineThickness?: number;
  }
>;
//#endregion
//#region ../types/src/workspace.d.ts
/** Immutable product mode for one live font session. */
type FontSessionMode = "preview" | "memory" | "workspace";
//#endregion
//#region src/capabilities.d.ts
export type ShiftSessionMode = FontSessionMode;
export type ShiftCaptureTarget = "window" | "editor";
/** Opaque identity of one live session's authored font state. */
export type FontRevision = string;
/** Result read entirely from one authored font revision. */
export interface ShiftObservation<Value> {
  fontRevision: FontRevision;
  value: Value;
}
/** Explicit live-window target with an optional authored-state precondition. */
export interface ShiftTarget {
  windowId: number;
  ifFontRevision?: FontRevision;
}
export interface ShiftCaptureInput extends ShiftTarget {
  target: ShiftCaptureTarget;
  /** Output multiplier relative to logical UI pixels. Defaults to 1. */
  scale?: number;
}
/** Point-in-time PNG captured from one explicitly addressed Shift window. */
export interface ShiftCapture {
  captureId: string;
  windowId: number;
  target: ShiftCaptureTarget;
  mimeType: "image/png";
  data: string;
  width: number;
  height: number;
  scale: number;
  capturedAt: string;
}
/** One open Shift window that can be addressed through runtime capabilities. */
export interface ShiftSession {
  windowId: number;
  sessionId: string;
  mode: ShiftSessionMode;
  focused: boolean;
  editorConnected: boolean;
}
/** One axis coordinate keyed by stable font-owned identity. */
export interface AxisCoordinate {
  axisId: AxisId;
  value: number;
}
/** Glyph occurrence currently placed in the editor, when a glyph route is open. */
export interface EditorGlyph {
  glyphId: GlyphId;
  name: string;
  nodeId: NodeId;
  sourceId: SourceId;
}
/** Active editor tool and its published state discriminator. */
export interface EditorTool {
  id: string;
  state: string;
}
/**
 * One of the document's pages, as the pages list shows it: the editor's
 * `PageNode` identity and name. Pages that show a single glyph, such as a
 * glyph tab's, are left out.
 */
export interface EditorPage {
  id: NodeId;
  name: string;
}
/** Renderer-owned facts for one live Shift window. */
export interface EditorView {
  route: string;
  glyph: EditorGlyph | null;
  /** The document's pages, in list order. */
  pages: EditorPage[];
  /** The page the canvas shows; null while the document has no page. */
  shownPageId: NodeId | null;
  activeSourceId: SourceId | null;
  editingSourceIds: SourceId[];
  externalLocation: AxisCoordinate[];
  selectionIds: SelectableId[];
  tool: EditorTool | null;
  /** Where the canvas looks and how close. */
  viewport: EditorViewport;
  /** The canvas grid: whether it shows, whether moves snap to it, and its cells. */
  grid: EditorGrid;
  dragging: boolean;
  editing: boolean;
  applyStatus: "idle" | "queued" | "applying" | null;
}
/**
 * The canvas grid of one window, as the zoom menu's grid items and Grid settings show it.
 *
 * @remarks
 * The cells (`spacingX`, `spacingY`, `subdivisions`) belong to the font and
 * are saved with it; `visible` and `snap` belong to the window and are not.
 * A font that stores no grid is drawn on 100-unit cells. Lines are counted from
 * the open glyph's origin in font units, and each fades out as the view zooms
 * out; snapping follows the finest lines still on screen and stops once the
 * grid has faded away.
 */
export interface EditorGrid {
  /** Whether the grid is drawn. */
  visible: boolean;
  /** Whether moved points, placed points and moved components snap to it. */
  snap: boolean;
  /** Distance between vertical grid lines, in font units. */
  spacingX: number;
  /** Distance between horizontal grid lines, in font units. */
  spacingY: number;
  /** Divisions of each cell along each axis; 1 has none. */
  subdivisions: number;
}
/** Grid settings to change; the ones left out keep their value. */
export type EditorGridChange = Partial<EditorGrid>;
/** Where an open document came from: a `.shift` package, a font file opened for editing, or a new font. */
export type DocumentSourceKind = "document" | "imported" | "untitled";
/** One window's document and whether it has edits Save has not written. */
export interface DocumentState {
  sourceKind: DocumentSourceKind;
  /** The file Save writes; null until the document has one. */
  saveTarget: string | null;
  /** The file the document was opened from or last saved to; null for a new font. */
  path: string | null;
  /** Whether the document has edits Save has not written. */
  dirty: boolean;
  /** Whether Save must first ask where to write, as for a new or imported font. */
  needsSaveAs: boolean;
}
/** Editor facts paired with the explicit window and font-session target. */
export interface EditorInspection extends EditorView {
  windowId: number;
  sessionId: string;
  mode: ShiftSessionMode;
}
/**
 * The canvas camera.
 *
 * @remarks
 * `center` is in the open glyph's units (font units, y up, as `layers.get`
 * gives points) while a glyph is open, and in the shown page's units (y down)
 * otherwise. It is null while the canvas has no size, such as before it is
 * first shown.
 */
export interface EditorViewport {
  /** Screen pixels per font unit. */
  zoom: number;
  /** The point at the middle of the canvas. */
  center: Point2D | null;
}
/** A command's stable id, as `commands.list` gives it, such as `view.zoomIn`. */
export type CommandId = string;
/** One command an agent may run in a window, as its menu item shows it. */
export interface CommandSummary {
  id: CommandId;
  /** The menu item's label. */
  title: string;
  /** Its keyboard shortcut as an Electron accelerator, such as `CmdOrCtrl+Plus`; null when it has none. */
  shortcut: string | null;
  /** Whether it can run in the window now, as its menu item is enabled. */
  enabled: boolean;
}
/** The commands an agent may run in one window. */
export interface CommandListInput {
  windowId: number;
}
/** Runs one command for a window, as choosing its menu item there does. */
export interface CommandRunInput extends ShiftTarget {
  command: CommandId;
}
/** What running a command did. */
export interface CommandRun {
  /** True once the window ran it; a command that cannot run fails instead. */
  ran: boolean;
}
/** Makes a tool the window's active tool, as its toolbar button does. */
export interface EditorSetToolInput extends ShiftTarget {
  /** The tool's id, as `EditorTool.id` gives it: `select`, `pen`, `hand`, `text`, `spacing`, `kerning`, `shape`. */
  tool: string;
}
/** Shows one of the document's pages, as clicking it in the pages list does. */
export interface EditorShowPageInput extends ShiftTarget {
  /** A page id from `EditorView.pages`. */
  pageId: NodeId;
}
/** Opens a glyph in its tab, as double-clicking it in the glyph overview does. */
export type EditorOpenGlyphInput = ShiftTarget & {
  glyph: GlyphSelector;
};
/**
 * Moves the canvas camera or changes its grid. Give at least one of `zoom`, `center` and `grid`.
 *
 * @remarks
 * `zoom` is clamped to the editor's range, 0.01 to 32. `center` is in the
 * units {@link EditorViewport.center} reports. `grid` changes only the
 * settings it names; spacing must be positive, and `subdivisions` a whole
 * number, clamped to 16. Changing the cells is a font edit, the one `setView`
 * makes: one undo step that marks the document unsaved and moves
 * `fontRevision`, refused in a read-only preview's font (where the cells
 * last for the session instead). `visible` and `snap` stay view state.
 */
export interface EditorSetViewInput extends ShiftTarget {
  zoom?: number;
  center?: Point2D;
  grid?: EditorGridChange;
}
/** Replaces the selection with these objects, in this order; an empty list clears it. */
export interface EditorSelectInput extends ShiftTarget {
  /** Ids from `layers.get` (points, contours, anchors, components) or the scene's nodes. */
  ids: SelectableId[];
}
/** Current font facts from one explicitly targeted live session, including Home. */
export interface FontOverview {
  mode: ShiftSessionMode;
  info: FontMetadata;
  metrics: FontMetrics;
  metricDefinitions: MetricDefinition[];
  glyphCount: number;
  axes: Axis[];
  /** How user coordinates on the axes map to source coordinates (`avar`), in font order. */
  axisMappings: AxisMapping[];
  /** Global designspace sources; glyph-specific layers are advertised on glyphs. */
  sources: Source[];
  instances: NamedInstance[];
}
/** Stable reference to one authored glyph layer. */
export interface GlyphLayerReference {
  layerId: LayerId;
  sourceId: SourceId;
}
/** Directory identity with optional geometry for one requested authored source. */
export interface GlyphSummary {
  id: GlyphId;
  name: string;
  unicodes: number[];
  componentBaseGlyphIds: GlyphId[];
  layers: GlyphLayerReference[];
  layer?: AuthoredLayer | null;
}
/** Select one glyph by stable ID or exact name, never by both. */
export type GlyphSelector =
  | {
      glyphId: GlyphId;
      name?: never;
    }
  | {
      name: GlyphName;
      glyphId?: never;
    };
/** Select one source by stable ID or exact name, never by both. */
export type SourceSelector =
  | {
      sourceId: SourceId;
      name?: never;
    }
  | {
      name: string;
      sourceId?: never;
    };
/** Select one named instance by stable ID or exact name, never by both. */
export type InstanceSelector =
  | {
      instanceId: NamedInstanceId;
      name?: never;
    }
  | {
      name: string;
      instanceId?: never;
    };
/** Select one axis by stable ID or tag, never by both. */
export type AxisSelector =
  | {
      axisId: AxisId;
      tag?: never;
    }
  | {
      tag: string;
      axisId?: never;
    };
/**
 * Select one authored layer by stable ID, or as a glyph's layer at a source,
 * never both. Without `source`, the glyph's layer at the default source.
 */
export type LayerSelector =
  | {
      layerId: LayerId;
      glyph?: never;
      source?: never;
    }
  | {
      glyph: GlyphSelector;
      source?: SourceSelector;
      layerId?: never;
    };
/** One bounded page of glyphs in font directory order. */
export interface GlyphPage {
  items: GlyphSummary[];
  nextCursor: string | null;
}
/** One point nested in its authored contour. */
export interface AuthoredPoint {
  id: PointId;
  x: number;
  y: number;
  pointType: PointType;
  smooth: boolean;
}
/** One directly authored contour and its ordered points. */
export interface AuthoredContour {
  id: ContourId;
  closed: boolean;
  points: AuthoredPoint[];
}
/** One directly authored anchor. */
export interface AuthoredAnchor {
  id: AnchorId;
  name: string | null;
  x: number;
  y: number;
}
/** Conventional six-value affine component transformation. */
export interface AffineTransformation {
  xx: number;
  xy: number;
  yx: number;
  yy: number;
  dx: number;
  dy: number;
}
/** One direct component reference owned by an authored layer. */
export interface AuthoredComponent {
  id: ComponentId;
  baseGlyphId: GlyphId;
  baseGlyphName: string;
  transformation: AffineTransformation;
}
/** Authored geometry of one glyph in one source, never an interpolated preview. */
export interface AuthoredLayer {
  glyphId: GlyphId;
  sourceId: SourceId;
  layerId: LayerId;
  advanceWidth: number;
  bounds: Bounds | null;
  contours: AuthoredContour[];
  components: AuthoredComponent[];
  anchors: AuthoredAnchor[];
}
/** One direct component of a resolved layer; its outline includes every resolved descendant. */
export interface ResolvedComponent {
  id: ComponentId;
  baseGlyphId: GlyphId;
  transformation: AffineTransformation;
  /** One SVG path in font units, y-up, with tight bounds. */
  outline: {
    svgPath: string;
    bounds: Bounds | null;
  };
}
/**
 * One exact authored layer with components resolved at its own source.
 *
 * The outline is the root's contours plus every component descendant; cyclic
 * component branches are skipped.
 */
export interface ResolvedLayer {
  glyphId: GlyphId;
  sourceId: SourceId;
  layerId: LayerId;
  advanceWidth: number;
  /** One SVG path in font units, y-up, with tight bounds. */
  outline: {
    svgPath: string;
    bounds: Bounds | null;
  };
  components: ResolvedComponent[];
}
/** Optional authored-layer annotations included in portable SVG output. */
export interface LayerOverlays {
  points?: boolean;
  controlLines?: boolean;
  anchors?: boolean;
  components?: boolean;
  fontMetrics?: boolean;
  advanceWidth?: boolean;
}
/** Presentation overrides for semantic elements in an authored-layer rendering. */
export interface LayerAppearance {
  outlineFill?: string;
  onCurveStroke?: string;
  offCurveStroke?: string;
  handleFill?: string;
  controlStroke?: string;
  anchorStroke?: string;
  metricStroke?: string;
  advanceStroke?: string;
  componentStroke?: string;
}
/** Structured guide positions accompanying an authored-layer rendering. */
export interface LayerGuides {
  fontMetrics: {
    ascender: number;
    capHeight?: number;
    xHeight?: number;
    baseline: number;
    descender: number;
  };
  advanceWidth: {
    origin: number;
    advance: number;
  };
}
/** Portable SVG rendering of one authored glyph layer. */
export interface LayerSvg {
  glyphId: GlyphId;
  sourceId: SourceId;
  layerId: LayerId;
  viewBox: [number, number, number, number];
  guides: LayerGuides;
  svg: string;
}
/** External and mapped coordinates with metrics resolved at that location. */
export interface ResolvedLocation {
  externalLocation: AxisCoordinate[];
  designLocation: AxisCoordinate[];
  sourceId: SourceId | null;
  metrics: SourceMetrics;
}
/** Drawable glyph output resolved at one designspace location. */
export interface ResolvedGlyph {
  glyphId: GlyphId;
  svgPath: string;
  advanceWidth: number;
}
/** Batch resolution result; unresolved identities have no drawable preview. */
export interface ResolvedGlyphs {
  items: ResolvedGlyph[];
  unresolvedGlyphIds: GlyphId[];
}
export interface GlyphListInput extends ShiftTarget {
  limit?: number;
  cursor?: string;
  /** Nests each glyph's authored layer at this source. */
  source?: SourceSelector;
}
export type GlyphGetInput = ShiftTarget & GlyphSelector;
/** One source by stable id or exact name, never by both. */
export type SourceGetInput = ShiftTarget & SourceSelector;
/** One named instance by stable id or exact name, never by both. */
export type InstanceGetInput = ShiftTarget & InstanceSelector;
export interface GlyphResolveInput extends ShiftTarget {
  glyphIds: GlyphId[];
  location: AxisCoordinate[];
}
/** Addresses one authored layer by its stable identity, or by glyph and source. */
export type LayerGetInput = ShiftTarget & LayerSelector;
export type LayerResolveInput = LayerGetInput;
export type LayerRenderInput = LayerGetInput & {
  overlays?: LayerOverlays;
  appearance?: LayerAppearance;
};
export interface LocationResolveInput extends ShiftTarget {
  location: AxisCoordinate[];
}
/** A glyph by stable identity, with its current name. */
export interface KerningGlyph {
  glyphId: GlyphId;
  /** Null when the glyph is no longer in the font. */
  name: string | null;
}
/** One font-wide kerning group and its members at one pair position. */
export interface KerningGroupSummary {
  groupId: KerningGroupId;
  name: string;
  /** `first` groups kern before the other glyph, `second` groups after it. */
  position: KerningPosition;
  members: KerningGlyph[];
}
/** One side of an authored kerning pair: a single glyph or a kerning group. */
export type KerningPairSide =
  | {
      kind: "glyph";
      glyphId: GlyphId;
      name: string | null;
    }
  | {
      kind: "group";
      groupId: KerningGroupId;
      name: string;
    };
/** One pair value authored at a source, in font units added after the first side. */
export interface AuthoredKerningPair {
  first: KerningPairSide;
  second: KerningPairSide;
  amount: number;
}
/** One bounded page of a source's authored pairs, ordered by side identities. */
export interface KerningPairPage {
  sourceId: SourceId;
  items: AuthoredKerningPair[];
  nextCursor: string | null;
}
/**
 * Which kind of authored pair applies between two glyphs: `glyph` (both sides
 * glyphs), `exception` (a glyph against a group, overriding the group pair), `group` (both sides
 * groups), or `none`. A more specific pair always beats a more general one.
 */
export type KerningRule = "glyph" | "exception" | "group" | "none";
/**
 * How a master arrives at its kerning for a pair: an `authored` pair applies;
 * the master kerns other pairs but not this one (`unkerned`, so 0); or it
 * authors no kerning and takes the blend of the masters that do (`interpolated`).
 */
export type KerningOrigin = "authored" | "unkerned" | "interpolated";
/** The kerning between two glyphs at one master. */
export interface KerningMasterValue {
  sourceId: SourceId;
  amount: number;
  origin: KerningOrigin;
  rule: KerningRule;
  /** The authored pair that applies; null unless `origin` is `authored`. */
  pair: AuthoredKerningPair | null;
}
/** The kerning between two glyphs, as the compiled font applies it. */
export interface KerningResolution {
  first: KerningGlyph;
  second: KerningGlyph;
  /** Font units at the requested source or location. */
  amount: number;
  /** Every master's value for the pair, in font source order. */
  masters: KerningMasterValue[];
}
/** Batch kerning resolution, in request order. */
export interface ResolvedKerningPairs {
  items: KerningResolution[];
}
export interface KerningGroupsInput extends ShiftTarget {
  position?: KerningPosition;
}
export interface KerningPairsInput extends ShiftTarget {
  /** The master whose pairs to list; the default source when omitted. */
  source?: SourceSelector;
  /** Only pairs that apply to this glyph, directly or through its groups. */
  glyph?: GlyphSelector;
  limit?: number;
  cursor?: string;
}
/** Two glyphs, first then second, each selected by exact name or stable glyph id. */
export interface KerningPairQuery {
  first: GlyphSelector;
  second: GlyphSelector;
}
/** Resolves at one master (`source`), an external `location`, or else the default location. */
export interface KerningResolveInput extends ShiftTarget {
  pairs: KerningPairQuery[];
  source?: SourceSelector;
  location?: AxisCoordinate[];
}
/** One pair, first glyph then second, at one master; the default source when `source` is omitted. */
export interface KerningAtInput extends ShiftTarget {
  first: GlyphSelector;
  second: GlyphSelector;
  source?: SourceSelector;
}
/** A point in a page's space, as a text run's position is given. */
export interface PagePoint {
  x: number;
  y: number;
}
/** The canvas text runs on one page; the page the canvas shows when `pageId` is omitted. */
export interface TextRunsInput extends ShiftTarget {
  pageId?: NodeId;
}
/** One canvas text run, by the id of its text run node. */
export interface TextRunGetInput extends ShiftTarget {
  runId: NodeId;
}
/**
 * A new canvas text run.
 *
 * `text` is proof text, as the Text tool reads pasted text and Glyphs writes
 * it: `/` starts a glyph name, which runs to the next space, the next `/`, or
 * the end of the text. A space that ends a name is not text, so `"/a b"` is
 * glyph `a` then `b`, and `"/a  b"` is `a`, a space, then `b`; a `/` that ends
 * one starts the next, so `"/a/b"` is glyphs `a` and `b`. `//` is a slash
 * (`"1//2"` is 1/2, `"/a//b"` is `a`, a slash, `b`) and `"\n"` a line break. A `/` that names nothing fails
 * with `ProofTextError`, and a name the font has no glyph for with
 * `UnknownGlyphNameError`.
 */
export interface TextRunCreateInput extends ShiftTarget {
  /** The page to put it on; the page the canvas shows when omitted. */
  pageId?: NodeId;
  text: string;
  /** Its origin in the page's space, y down; below the page's last run when omitted. */
  at?: PagePoint;
}
/** Replaces a run's text, read as {@link TextRunCreateInput.text} is. */
export interface TextRunSetTextInput extends ShiftTarget {
  runId: NodeId;
  text: string;
}
/**
 * Puts the Text mode caret in a run, in positions between items as
 * {@link TextRunCaret} gives them: 0 is before the first item.
 */
export interface TextRunSetCaretInput extends ShiftTarget {
  runId: NodeId;
  /** Where the caret is: `selection.start` or `selection.end` when a selection is given. */
  position: number;
  /** The positions to select, `start` to `end`; a collapsed caret at `position` when omitted. */
  selection?: {
    start: number;
    end: number;
  };
}
/** How a run's lines line up: to where their direction starts or ends, or to a side. */
export type TextRunAlign = "start" | "end" | "left" | "center" | "right";
/** How a canvas text run is shaped and set, as the Text section shows it. */
export interface TextRunOptions {
  /** Whether the font's feature code shapes the text; off sets each item as typed. */
  shaping: boolean;
  /** Features forced on (`true`) or off (`false`) by tag; a tag left out keeps the font's default. */
  features: Record<string, boolean>;
  /** The BCP 47 language it is shaped as, such as `tr`; null for the font's default. */
  language: string | null;
  /** The ISO 15924 script the whole run is shaped in, such as `Arab`; null for each stretch's own. */
  script: string | null;
  /** The distance between baselines, in ems; null for the font's own line spacing. */
  lineHeight: number | null;
  /** How lines line up; null follows each line's direction. */
  align: TextRunAlign | null;
}
/**
 * Changes some of a run's options in one undo step: a field left out keeps
 * its value. In `features`, a tag left out keeps its setting, and `null`
 * returns it to the font's default. A feature tag, language or script that
 * shaping cannot read, or a line height that is not positive, fails with
 * `TextRunOptionsError` and nothing changes.
 */
export interface TextRunSetOptionsInput extends ShiftTarget {
  runId: NodeId;
  options: {
    shaping?: boolean;
    features?: Record<string, boolean | null>;
    language?: string | null;
    script?: string | null;
    lineHeight?: number | null;
    align?: TextRunAlign | null;
  };
}
/** Removes a canvas text run. */
export interface TextRunDeleteInput extends ShiftTarget {
  runId: NodeId;
}
/** One canvas text run, as a page's list of runs shows it. */
export interface TextRunSummary {
  /** The id of its text run node. */
  id: NodeId;
  pageId: NodeId;
  /**
   * Its items as proof text, read as {@link TextRunCreateInput.text} is, so
   * creating a run from it gives the same items.
   */
  text: string;
  /** Its origin in the page's space, y down. */
  at: PagePoint;
  options: TextRunOptions;
}
/**
 * Adds an empty page after the last one, as the pages list's add button
 * does. The shown page stays shown; `editor.showPage` shows the new one.
 */
export interface PageCreateInput extends ShiftTarget {
  /** Shown in the pages list; defaults to the first unused "Page N". Surrounding spaces are dropped. */
  name?: string;
}
/**
 * Renames a page, as renaming it in the pages list does. Surrounding spaces
 * are dropped; the page's own name changes nothing and records no undo step.
 */
export interface PageRenameInput extends ShiftTarget {
  /** A page id from `EditorView.pages`. */
  pageId: NodeId;
  name: string;
}
/**
 * Deletes a page and everything on it, as the pages list does. Deleting the
 * shown page first shows its neighbour; the last page cannot be deleted.
 */
export interface PageDeleteInput extends ShiftTarget {
  /** A page id from `EditorView.pages`. */
  pageId: NodeId;
}
/** A page edit's answer: the page it touched, and the document's pages after it. */
export interface PageChange {
  /** The page created, renamed or deleted, as it is now (a deleted page as it was). */
  page: EditorPage;
  /** The document's pages in list order, as `EditorView.pages` gives them. */
  pages: EditorPage[];
}
/**
 * Where an undone or redone step was made, as the window shows it: the page
 * Shift showed for it, the glyphs it changed and the scene nodes it changed.
 */
export interface HistoryLocation {
  /** The page of the first node it changed, or the page shown when it was made; null when there was none. */
  pageId: NodeId | null;
  /** The glyphs whose records or layers it changed, in id order. */
  glyphIds: GlyphId[];
  /** The scene nodes (pages, text runs, glyph nodes) it created, changed or removed. */
  nodeIds: NodeId[];
}
/** What `history.undo` did. */
export interface HistoryUndo {
  /** False when there was nothing to undo; nothing changed. */
  undone: boolean;
  /** Where the step was made; null when nothing was undone or the step changed no document data, as a selection change. */
  location: HistoryLocation | null;
}
/** What `history.redo` did. */
export interface HistoryRedo {
  /** False when there was nothing to redo; nothing changed. */
  redone: boolean;
  /** Where the step was made; null when nothing was redone or the step changed no document data, as a selection change. */
  location: HistoryLocation | null;
}
/**
 * Runs the font checks, as `shift-cli check` and a type designer's review do:
 * interpolation compatibility, outlines (direction, open and degenerate
 * contours, curves missing a point at their extremes, points a unit or two
 * off a metric line), advances, kerning and swaps.
 */
export interface FontCheckInput extends ShiftTarget {
  /** Only these glyphs; the whole font when omitted. */
  glyphs?: GlyphSelector[];
}
/** One problem a check found. */
export interface FontCheckFinding {
  /** Stable code, such as `O008`: `D` masters, `I` interpolation, `O` outlines, `A` swaps, `K` kerning. */
  code: string;
  /** Kebab-case name, such as `missing-extreme`. */
  name: string;
  severity: "warning" | "error";
  /** The glyph concerned, by name; null for a font-wide problem. */
  glyph: string | null;
  glyphId: GlyphId | null;
  /** The master concerned, by name; null when it is not about one master. */
  source: string | null;
  sourceId: SourceId | null;
  /** Zero-based contour index, when the problem is in one contour. */
  contour: number | null;
  /** The points the problem sits at, in every layer it concerns. */
  points: PointId[];
  message: string;
  /**
   * The edit that resolves it, when one can be computed: point positions to
   * set (`setPositions`/`movePoints` per layer) and points to delete with a
   * fitted curve (`deletePoints`, mode `fit`). Apply both as one step.
   */
  fix: FontCheckFix | null;
}
/** An edit that resolves a {@link FontCheckFinding}. */
export interface FontCheckFix {
  /** What the fix does, as a menu would say it: `Line up handles`. */
  label: string;
  moves: {
    layerId: LayerId;
    pointId: PointId;
    x: number;
    y: number;
  }[];
  removals: {
    layerId: LayerId;
    pointId: PointId;
  }[];
}
/** What `font.check` found. */
export interface FontCheck {
  findings: FontCheckFinding[];
  errors: number;
  warnings: number;
}
/**
 * Applies font edits as one undo step, through the same engine path the
 * editor's own tools and menus use.
 *
 * @remarks
 * `intents` are the engine's `FontIntent`s, each `{ kind, [kind]: payload }`
 * (for example `{ kind: "setXAdvance", setXAdvance: { layerId, width } }`).
 * Rust validates every intent; one it refuses fails the call with its
 * message, and nothing is kept.
 *
 * New entities need ids. Write a placeholder `"new:<prefix>:<key>"` wherever
 * an id goes (`"new:glyph:a"`, `"new:layer:a"`, `"new:contour:a/0"`,
 * `"new:point:a/0/3"`); each distinct placeholder becomes one fresh id, the
 * same everywhere it appears in this call, and `FontEdit.ids` maps it back.
 * Prefixes: point, contour, anchor, component, glyph, layer, source, axis,
 * axisLabel, axisMapping, kerningGroup, namedInstance, metric, swap.
 */
export interface FontEditInput extends ShiftTarget {
  /** The undo step's name, as Edit › Undo shows it. */
  label: string;
  /** Applied in order, as one undo step. */
  intents: FontIntent[];
}
/** What `edits.apply` did. */
export interface FontEdit {
  /** Each `new:` placeholder the call used, to the id it became. */
  ids: Record<string, string>;
  /** The layers the edit changed, in the engine's order. */
  layerIds: LayerId[];
  /** Glyphs that use a changed glyph as a component, so their drawing changed too. */
  dependentGlyphIds: GlyphId[];
  /** True when the edit replaced a font-level collection (glyphs, axes, sources, kerning, metadata). */
  fontChanged: boolean;
}
/** Live application capabilities shared by protocol and plugin hosts. */
export interface ShiftCapabilities {
  capture(input: ShiftCaptureInput): Promise<ShiftObservation<ShiftCapture>>;
  sessions: {
    list(): Promise<ShiftSession[]>;
  };
  /**
   * The app commands an agent may run: those that change only what a window
   * shows or its session state, never font data or files. Close Tab closes a
   * tab only while another is open; with only the glyph overview left it fails
   * with `LastTabError` instead of closing the window.
   */
  commands: {
    list(input: CommandListInput): Promise<CommandSummary[]>;
    run(input: CommandRunInput): Promise<CommandRun>;
  };
  /**
   * Inspects the editor, and changes what it shows: the tool, page, open
   * glyph, camera and selection. None of these change font data, mark the
   * document unsaved or move `fontRevision`; opening a glyph that has no tab
   * yet adds a glyph page, as the glyph overview does, and the document stays
   * saved.
   */
  editor: {
    inspect(input: ShiftTarget): Promise<ShiftObservation<EditorInspection>>;
    setTool(input: EditorSetToolInput): Promise<ShiftObservation<EditorInspection>>;
    showPage(input: EditorShowPageInput): Promise<ShiftObservation<EditorInspection>>;
    openGlyph(input: EditorOpenGlyphInput): Promise<ShiftObservation<EditorInspection>>;
    setView(input: EditorSetViewInput): Promise<ShiftObservation<EditorInspection>>;
    select(input: EditorSelectInput): Promise<ShiftObservation<EditorInspection>>;
  };
  font: {
    get(input: ShiftTarget): Promise<ShiftObservation<FontOverview>>;
    /** Runs the font checks on the whole font or some glyphs; fix what they find with `edits.apply`. */
    check(input: FontCheckInput): Promise<ShiftObservation<FontCheck>>;
  };
  locations: {
    resolve(input: LocationResolveInput): Promise<ShiftObservation<ResolvedLocation>>;
  };
  glyphs: {
    list(input: GlyphListInput): Promise<ShiftObservation<GlyphPage>>;
    get(input: GlyphGetInput): Promise<ShiftObservation<GlyphSummary>>;
    resolve(input: GlyphResolveInput): Promise<ShiftObservation<ResolvedGlyphs>>;
  };
  sources: {
    get(input: SourceGetInput): Promise<ShiftObservation<Source>>;
  };
  instances: {
    get(input: InstanceGetInput): Promise<ShiftObservation<NamedInstance>>;
  };
  layers: {
    get(input: LayerGetInput): Promise<ShiftObservation<AuthoredLayer>>;
    resolve(input: LayerResolveInput): Promise<ShiftObservation<ResolvedLayer>>;
    render(input: LayerRenderInput): Promise<ShiftObservation<LayerSvg>>;
  };
  kerning: {
    groups(input: KerningGroupsInput): Promise<ShiftObservation<KerningGroupSummary[]>>;
    pairs(input: KerningPairsInput): Promise<ShiftObservation<KerningPairPage>>;
    resolve(input: KerningResolveInput): Promise<ShiftObservation<ResolvedKerningPairs>>;
    at(input: KerningAtInput): Promise<ShiftObservation<KerningMasterValue>>;
  };
  /**
   * The canvas text runs (proof text) and the Text mode caret: view state
   * beside the font, never font data.
   *
   * @remarks
   * Each write is one edit through the path the Text tool uses: `create`,
   * `setText` and `delete` are one undo step each and mark the document
   * unsaved, as typing does. `setCaret` is session state: no undo step, no
   * unsaved change. No write changes the font, so none advances
   * `fontRevision`; with `ifFontRevision`, a write fails with
   * `FontChangedError` before changing anything when the font has moved on.
   * A run or page that is not there fails with `TextRunNotFoundError` or
   * `PageNotFoundError`, and a caret outside the run with `TextCaretError`.
   */
  text: {
    runs(input: TextRunsInput): Promise<ShiftObservation<TextRunSummary[]>>;
    get(input: TextRunGetInput): Promise<ShiftObservation<TextRunView>>;
    create(input: TextRunCreateInput): Promise<ShiftObservation<TextRunView>>;
    setText(input: TextRunSetTextInput): Promise<ShiftObservation<TextRunView>>;
    /** Shows the caret in Text mode, switching to the run's page and to the Text tool when needed. */
    setCaret(input: TextRunSetCaretInput): Promise<ShiftObservation<TextRunView>>;
    /** Changes some of a run's options, as the Text section does, in one undo step. */
    setOptions(input: TextRunSetOptionsInput): Promise<ShiftObservation<TextRunView>>;
    delete(input: TextRunDeleteInput): Promise<ShiftObservation<null>>;
  };
  /**
   * The document's pages, edited as the pages list edits them.
   *
   * @remarks
   * `create`, `rename` and `delete` are one undo step each and mark the
   * document unsaved; none shows a page (`editor.showPage` does), except that
   * deleting the shown page shows its neighbour. Pages are scene data, not
   * font data, so none advances `fontRevision`; with `ifFontRevision`, an edit
   * fails with `FontChangedError` before changing anything when the font has
   * moved on. An unknown page fails with `PageNotFoundError`, and deleting the
   * last page with `LastPageError`.
   */
  pages: {
    create(input: PageCreateInput): Promise<ShiftObservation<PageChange>>;
    rename(input: PageRenameInput): Promise<ShiftObservation<PageChange>>;
    delete(input: PageDeleteInput): Promise<ShiftObservation<PageChange>>;
  };
  /**
   * The window's undo and redo, as Edit › Undo and Edit › Redo run them.
   *
   * @remarks
   * Each reverses or reapplies one step of the window's history, whoever made
   * it (the user or an agent): font edits, page edits and proof text alike,
   * showing the page the step was made on as the menu items do. A step that
   * changed the font moves `fontRevision`. Nothing to undo or redo answers
   * false, not an error. A preview of a font file has no undo history, and
   * both fail with `HistoryUnavailableError`.
   */
  history: {
    undo(input: HistoryInput): Promise<ShiftObservation<HistoryUndo>>;
    redo(input: HistoryInput): Promise<ShiftObservation<HistoryRedo>>;
  };
  /**
   * Font edits: glyphs, outlines, components, anchors, metrics, axes,
   * sources, instances and kerning, as the editor makes them.
   *
   * @remarks
   * Each call is one undo step (`history.undo` reverses it), marks the
   * document unsaved and moves `fontRevision`; read again afterwards. With
   * `ifFontRevision`, it fails with `FontChangedError` and changes nothing when
   * the font has moved on. A preview of a font file cannot be edited and fails
   * with `FontEditUnavailableError`; an intent Rust refuses fails with
   * `FontEditRefusedError`, and nothing is kept.
   */
  edits: {
    apply(input: FontEditInput): Promise<ShiftObservation<FontEdit>>;
  };
}
/** Undoes or redoes the window's latest step. */
export type HistoryInput = ShiftTarget;
/** A capability input without the window and revision a read scope binds. */
export type ShiftReadInput<Input> = Input extends unknown ? Omit<Input, keyof ShiftTarget> : never;
/**
 * `active` while the bound revision is current; `stale` once a call saw the
 * font change; `closed` once the scope's callback settled. Both are terminal.
 */
export type ShiftReadState = "active" | "stale" | "closed";
/**
 * Revision-bound reads of one window's font, valid only inside `shift.read`.
 *
 * Calls return plain values. The first call that sees a newer font revision
 * moves the scope to `stale` and throws an error named `FontChangedError`;
 * every later call fails the same way. Nothing is retried, and other errors
 * leave the scope `active`.
 */
export interface ShiftRead {
  readonly state: ShiftReadState;
  /** The revision every call in this scope requires. */
  readonly fontRevision: FontRevision;
  font: {
    get(): Promise<FontOverview>;
  };
  locations: {
    resolve(input: ShiftReadInput<LocationResolveInput>): Promise<ResolvedLocation>;
  };
  glyphs: {
    list(input?: ShiftReadInput<GlyphListInput>): Promise<GlyphPage>;
    get(input: ShiftReadInput<GlyphGetInput>): Promise<GlyphSummary>;
    resolve(input: ShiftReadInput<GlyphResolveInput>): Promise<ResolvedGlyphs>;
  };
  sources: {
    get(input: ShiftReadInput<SourceGetInput>): Promise<Source>;
  };
  instances: {
    get(input: ShiftReadInput<InstanceGetInput>): Promise<NamedInstance>;
  };
  layers: {
    get(input: ShiftReadInput<LayerGetInput>): Promise<AuthoredLayer>;
    resolve(input: ShiftReadInput<LayerResolveInput>): Promise<ResolvedLayer>;
    render(input: ShiftReadInput<LayerRenderInput>): Promise<LayerSvg>;
  };
  kerning: {
    groups(input?: ShiftReadInput<KerningGroupsInput>): Promise<KerningGroupSummary[]>;
    pairs(input: ShiftReadInput<KerningPairsInput>): Promise<KerningPairPage>;
    resolve(input: ShiftReadInput<KerningResolveInput>): Promise<ResolvedKerningPairs>;
    at(input: ShiftReadInput<KerningAtInput>): Promise<KerningMasterValue>;
  };
  /** The canvas text runs, read at the bound revision; writes are not part of a read scope. */
  text: {
    runs(input?: ShiftReadInput<TextRunsInput>): Promise<TextRunSummary[]>;
    get(input: ShiftReadInput<TextRunGetInput>): Promise<TextRunView>;
  };
}
/** The `shift` global in scripts: raw capabilities plus revision-bound reads. */
export interface ShiftScript extends ShiftCapabilities {
  /**
   * Runs `callback` against one revision of a window's font.
   *
   * @returns The callback's result; the callback is never retried.
   */
  read<Result>(
    target: {
      windowId: number;
    },
    callback: (read: ShiftRead) => Result | Promise<Result>,
  ): Promise<Result>;
}
/** One item of a canvas text run: a typed character, a glyph picked by name, or a line break. */
export interface TextRunItem {
  id: string;
  /** The character, `"\n"` for a line break, or `/name` for a glyph picked by name. */
  text: string;
}
/** One glyph a canvas text run shows, in the order its line shows them. */
export interface TextRunGlyph {
  /** The glyph shown; null for a character the font has no glyph for. */
  glyphId: GlyphId | null;
  name: string;
  /** The items it shows: one for most glyphs, several for a ligature. */
  itemIds: string[];
  line: number;
  /** Left edge of its advance box, in the run's units. */
  left: number;
  baseline: number;
  /** Where its outline is drawn: `left` and `baseline` plus a mark's attachment offset. */
  origin: {
    x: number;
    y: number;
  };
  advance: number;
  /** Kerning with the next glyph, added after `advance`. */
  kern: number;
}
/** The Text mode caret, as positions between items: 0 is before the first item. */
export interface TextRunCaret {
  position: number;
  /** The selected positions, `start` to `end`; equal when nothing is selected. */
  selection: {
    start: number;
    end: number;
  };
  /** Where the caret is drawn, in the run's units. */
  x: number;
  y: number;
}
/** The canvas text run as it shows now. */
export interface TextRunView {
  /** The id of its text run node. */
  id: NodeId;
  pageId: NodeId;
  /** Its origin in the page's space, y down. */
  at: PagePoint;
  options: TextRunOptions;
  items: TextRunItem[];
  glyphs: TextRunGlyph[];
  /** The run's total advance, in its units. */
  advance: number;
  /** Each line's baseline, top line first. */
  baselines: number[];
  /** The item whose glyph is open on the canvas, showing its outline; null when none is. */
  openItemId: string | null;
  /**
   * The name of the glyph open on the canvas: the item's glyph, or one part
   * of it, such as a dot, when the font draws the item with several.
   */
  openGlyph: string | null;
  /** The item whose glyph is being edited in place, its points editable; null when none is. */
  editedItemId: string | null;
  /** The item under the pointer, highlighted as text; null when none is. */
  hoveredItemId: string | null;
  /** The caret while Text mode shows one; null otherwise. */
  caret: TextRunCaret | null;
}
/** One glyph's side of a spacing gap. */
export interface SpacingGapSide {
  itemId: string;
  glyph: string;
  sidebearing: number;
  /** X of its outline's edge facing the gap. */
  edge: number;
}
/** The space between two neighbouring glyphs, or before or after a line. */
export interface SpacingGapView {
  left: SpacingGapSide | null;
  right: SpacingGapSide | null;
  /** End of the left glyph's advance box. */
  leftBoundary: number;
  /** Start of the right glyph's advance box; differs from `leftBoundary` by the kern. */
  rightBoundary: number;
  baseline: number;
  top: number;
  bottom: number;
}
/** One sidebearing the Spacing tool shows: a gap's left or right half. */
export interface SpacingHalfView {
  side: "left" | "right";
  /** `gap` when reached through its gap; `glyph` when drawn alone beside its glyph. */
  scope: "gap" | "glyph";
  gap: SpacingGapView;
}
/** What the Spacing tool shows. */
export interface SpacingToolView {
  hovered: SpacingHalfView | null;
  /** The half arrow keys nudge. */
  selected: SpacingHalfView | null;
  /** The half whose value field is open. */
  editing: SpacingHalfView | null;
  /** Every other place the hovered half's glyph shows the same sidebearing. */
  sameAsHovered: SpacingHalfView[];
  /** Whether the pointer is on the hovered half's value. */
  overValue: boolean;
  /** Whether a nudge hid the overlay until the pointer moves. */
  quiet: boolean;
}
/** One side of the kerning pair that applies between two glyphs. */
export interface KerningPairSideView {
  /** The glyph's name, or the group's name when the pair kerns a group. */
  name: string;
  group: boolean;
  /** Whether this side is locked to its glyph, an exception to its group. */
  locked: boolean;
  /** Whether the lock can be toggled: false for a glyph with no group on that side. */
  toggleable: boolean;
}
/** One kern the Kerning tool shows between two neighbouring glyphs. */
export interface KerningGapView {
  firstItemId: string;
  secondItemId: string;
  amount: number;
  /** X of the middle of the kern, in the run's units. */
  center: number;
  baseline: number;
  bottom: number;
  /** The pair an edit here changes; null where the location is interpolated. */
  pair: {
    first: KerningPairSideView;
    second: KerningPairSideView;
    amount: number;
  } | null;
}
/** What the Kerning tool shows. */
export interface KerningToolView {
  hovered: KerningGapView | null;
  /** The kern arrow keys nudge, which the sidebar shows. */
  selected: KerningGapView | null;
  /** The kern whose value field is open. */
  editing: KerningGapView | null;
  /** Every other place in the text the hovered kern applies to. */
  sameAsHovered: KerningGapView[];
}
//#endregion

declare global {
  const shift: ShiftScript;
}
