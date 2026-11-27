import { Bounds, type Rect2D } from "@shift/geo";
import type { AxisId, ComponentId, GlyphId, SourceId } from "@shift/types";
import type { ExternalAxisLocation } from "../../types/variation";
import type { Font } from "../model/Font";
import type { Glyph, GlyphLayer } from "../model/Glyph";
import { signal, type Signal } from "../signals";
import type {
  ComponentTransformSelection,
  ComponentTransformSelectionLayer,
} from "../../types/componentTransform";
import type { ComponentLayerTargets, ComponentTargets } from "../../types/componentTargets";
import type { PositionSelection, PositionSelectionLayer } from "../../types/positionEdit";
import type { SourceRenderInputs } from "../../types/glyphRender";
import { externalAxisLocationsEqual } from "../variation/location";
import { PositionTargets } from "../model/positions/PositionTargets";

/**
 * Tags of the axes whose masters mirror each other glyph by glyph: Ink Traps. A glyph with
 * no traps is drawn the same at both ends of the axis, so an edit at one end goes to the
 * other while the two still match.
 */
export const MIRRORED_AXIS_TAGS: ReadonlySet<string> = new Set(["INKT"]);

/** One layer and the layer across a mirrored axis from it. */
export interface MirroredPair {
  readonly layer: GlyphLayer;
  readonly twin: GlyphLayer;
}

/** Maps the active source's selection onto every other source selected for editing. */
export class MultiSourceEditing {
  readonly #font: Font;
  readonly #glyphForId: (glyphId: GlyphId) => Glyph | null;
  readonly #activeSourceIdCell: Signal<SourceId | null>;
  readonly #editingSourceIdsCell: Signal<ReadonlySet<SourceId>>;
  readonly #activeDrawingCell: Signal<GlyphLayer | null>;
  readonly #mirrorPairsCell: Signal<boolean>;
  // non-reactive: reuses each source's render-model input cells so Glyph's cell-keyed render-model cache hits.
  readonly #sourceRenderInputs = new Map<SourceId, SourceRenderInputs>();

  /**
   * @param font - Font whose engine matches the layers.
   * @param glyphForId - Synchronous lookup for completely loaded glyphs.
   * @param activeSourceIdCell - Reference source selected for direct editing.
   * @param editingSourceIdsCell - Complete source set transformed together.
   * @param activeDrawingCell - The located drawing edited alone, off the font's sources.
   * @param mirrorPairsCell - Whether edits reach the matching master across a mirrored axis.
   */
  constructor(
    font: Font,
    glyphForId: (glyphId: GlyphId) => Glyph | null,
    activeSourceIdCell: Signal<SourceId | null>,
    editingSourceIdsCell: Signal<ReadonlySet<SourceId>>,
    activeDrawingCell: Signal<GlyphLayer | null>,
    mirrorPairsCell: Signal<boolean>,
  ) {
    this.#activeDrawingCell = activeDrawingCell;
    this.#mirrorPairsCell = mirrorPairsCell;
    this.#font = font;
    this.#glyphForId = glyphForId;
    this.#activeSourceIdCell = activeSourceIdCell;
    this.#editingSourceIdsCell = editingSourceIdsCell;
  }

  /**
   * Returns a glyph's layer at each source selected for editing, in source
   * order, or the located drawing being edited, alone.
   *
   * @returns `null` when the glyph is not loaded or lacks a layer at one of them.
   */
  layersFor(glyphId: GlyphId): GlyphLayer[] | null {
    const glyph = this.#glyphForId(glyphId);
    if (!glyph) return null;

    const drawing = this.#activeDrawingCell.peek();
    if (drawing) return glyph.layerForId(drawing.id) === drawing ? [drawing] : null;

    const editingSourceIds = this.#editingSourceIdsCell.peek();
    const layers: GlyphLayer[] = [];
    for (const source of this.#font.sources) {
      if (!editingSourceIds.has(source.id)) continue;
      const layer = glyph.layerForSource(source.id);
      if (!layer) return null;
      layers.push(layer);
    }
    return layers.length === editingSourceIds.size ? layers : null;
  }

  /**
   * Maps one reference-layer selection onto every selected source layer.
   *
   * @param reference - Normalized targets owned by the active source layer.
   * @returns The complete multi-layer selection, or `null` when any source layer is missing or
   * does not match the reference layer completely.
   */
  resolve(reference: PositionSelectionLayer): PositionSelection | null {
    const targetLayers = this.#targetLayers(reference.layer);
    if (!targetLayers) return null;

    const { points, anchors } = reference.targets;
    const ids = { points, anchors, components: [] };
    const additionalLayers: PositionSelectionLayer[] = [];
    for (const targetLayer of targetLayers) {
      const counterparts = this.#font.counterparts(reference.layer.id, targetLayer.id, ids);
      if (!counterparts) return null;

      additionalLayers.push({
        layer: targetLayer,
        targets: new PositionTargets(counterparts.points, counterparts.anchors),
      });
    }

    const glyph = this.#glyphForLayer(reference.layer);
    const edited = [reference.layer, ...additionalLayers.map(({ layer }) => layer)];
    for (const twin of glyph ? this.#twinsOf(glyph, edited) : []) {
      const counterparts = this.#font.counterparts(reference.layer.id, twin.id, ids);
      if (!counterparts) continue;

      additionalLayers.push({
        layer: twin,
        targets: new PositionTargets(counterparts.points, counterparts.anchors),
      });
    }

    return { ...reference, additionalLayers };
  }

  /**
   * The glyph's layers across a mirrored axis (Ink Traps) from `layers`: each at the
   * source sitting where one of `layers` does except on that axis.
   *
   * @param matching - Only the pairs drawn the same (a glyph without traps); a pair
   *   already drawn differently, as a glyph with traps is, is left out.
   */
  pairsOf(
    glyph: Glyph,
    layers: readonly GlyphLayer[],
    { matching }: { readonly matching: boolean },
  ): MirroredPair[] {
    const mirrored = new Set(
      this.#font.externalAxesCell
        .peek()
        .filter((axis) => MIRRORED_AXIS_TAGS.has(axis.tag))
        .map((axis) => axis.id),
    );
    if (mirrored.size === 0) return [];

    const taken = new Set(layers.map(({ id }) => id));
    const pairs: MirroredPair[] = [];
    for (const layer of layers) {
      const here = this.#font.externalLocationForSource(layer.sourceId);
      if (!here) continue;

      for (const source of this.#font.sources) {
        const twin = glyph.layerForSource(source.id);
        if (!twin || taken.has(twin.id)) continue;

        const there = this.#font.externalLocationForSource(source.id);
        if (!there || !differsOnlyOn(here, there, mirrored)) continue;
        if (matching && !sameOutline(layer, twin)) continue;

        taken.add(twin.id);
        pairs.push({ layer, twin });
      }
    }
    return pairs;
  }

  /**
   * The glyph's layers on the same side of the mirrored axes as `layer`: at every source
   * with the same Ink Traps value, whatever its weight or width.
   */
  sameSideOf(glyph: Glyph, layer: GlyphLayer): GlyphLayer[] {
    const mirrored = this.#font.externalAxesCell
      .peek()
      .filter((axis) => MIRRORED_AXIS_TAGS.has(axis.tag))
      .map((axis) => axis.id);
    const here = this.#font.externalLocationForSource(layer.sourceId);
    if (!here || mirrored.length === 0) return [];

    const layers: GlyphLayer[] = [];
    for (const source of this.#font.sources) {
      const there = this.#font.externalLocationForSource(source.id);
      const other = glyph.layerForSource(source.id);
      if (!there || !other) continue;
      if (mirrored.every((axisId) => there.get(axisId) === here.get(axisId))) layers.push(other);
    }
    return layers;
  }

  /** The matching twins of `layers` an edit should also reach; none while mirroring is off. */
  #twinsOf(glyph: Glyph, layers: readonly GlyphLayer[]): GlyphLayer[] {
    if (!this.#mirrorPairsCell.peek() || this.#activeDrawingCell.peek()) return [];
    return this.pairsOf(glyph, layers, { matching: true }).map(({ twin }) => twin);
  }

  /**
   * Maps one reference-layer selection onto the glyph's layer at every other source, for
   * edits that change the outline's structure (deleting, merging or adding points): those
   * must reach every master, or the glyph stops interpolating.
   *
   * @remarks
   * A source whose layer no longer matches the reference (already incompatible) is left
   * out, since there is nothing there to keep in step. A located drawing edited alone has
   * no other layers.
   *
   * @param reference - Normalized targets owned by the active source layer.
   */
  resolveStructural(reference: PositionSelectionLayer): PositionSelection {
    const none = { ...reference, additionalLayers: [] };
    if (this.#activeDrawingCell.peek()) return none;

    const glyph = this.#glyphForLayer(reference.layer);
    if (!glyph) return none;

    const { points, anchors } = reference.targets;
    const ids = { points, anchors, components: [] };
    const additionalLayers: PositionSelectionLayer[] = [];
    for (const source of this.#font.sources) {
      const layer = glyph.layerForSource(source.id);
      if (!layer || layer.id === reference.layer.id) continue;

      const counterparts = this.#font.counterparts(reference.layer.id, layer.id, ids);
      if (!counterparts) continue;

      additionalLayers.push({
        layer,
        targets: new PositionTargets(counterparts.points, counterparts.anchors),
      });
    }
    return { ...reference, additionalLayers };
  }

  /**
   * Matches direct component targets across every selected editing source.
   *
   * @param reference - Active-source component identities to match in every other source.
   * @returns Complete source-layer targets, or `null` when any selected source cannot participate.
   */
  matchComponentTargets(reference: ComponentLayerTargets): ComponentTargets | null {
    const targetLayers = this.#targetLayers(reference.layer);
    if (!targetLayers) return null;

    const ids = { points: [], anchors: [], components: reference.componentIds };
    const additionalLayers: ComponentLayerTargets[] = [];
    for (const targetLayer of targetLayers) {
      const counterparts = this.#font.counterparts(reference.layer.id, targetLayer.id, ids);
      if (!counterparts) return null;

      additionalLayers.push({ layer: targetLayer, componentIds: counterparts.components });
    }

    const glyph = this.#glyphForLayer(reference.layer);
    const edited = [reference.layer, ...additionalLayers.map(({ layer }) => layer)];
    for (const twin of glyph ? this.#twinsOf(glyph, edited) : []) {
      const counterparts = this.#font.counterparts(reference.layer.id, twin.id, ids);
      if (!counterparts) continue;

      additionalLayers.push({ layer: twin, componentIds: counterparts.components });
    }

    return { ...reference, additionalLayers };
  }

  /**
   * Maps direct components onto every selected source layer and resolves transform pivots.
   *
   * @param reference - Active-source component identities and resolved local bounds.
   * @returns The complete matched selection, or `null` when any source cannot participate.
   */
  resolveComponents(
    reference: ComponentTransformSelectionLayer,
  ): ComponentTransformSelection | null {
    const targets = this.matchComponentTargets(reference);
    if (!targets) return null;

    const glyph = this.#glyphForLayer(reference.layer);
    if (!glyph) return null;

    const additionalLayers: ComponentTransformSelectionLayer[] = [];
    for (const target of targets.additionalLayers) {
      const bounds = this.#componentBounds(
        glyph,
        target.layer.sourceId,
        target.layer,
        target.componentIds,
      );
      if (!bounds) return null;

      additionalLayers.push({ ...target, bounds });
    }

    return { ...reference, additionalLayers };
  }

  #componentBounds(
    glyph: Glyph,
    sourceId: SourceId,
    layer: GlyphLayer,
    componentIds: readonly ComponentId[],
  ): Rect2D | null {
    const location = this.#font.externalLocationForSource(sourceId);
    if (!location) return null;

    const inputs = this.#renderInputsFor(sourceId, location);
    const view = glyph.renderModelAt(inputs.locationCell, inputs.sourceIdCell);
    // Render paths keep projection-stable identities even when exact-source authored IDs differ.
    // Resolve the authored target IDs to their Rust-matched direct-component slots.
    const directComponents = view.components.filter(
      (component) => component.parentPath.length === 0,
    );
    const bounds = Bounds.unionAll(
      componentIds.map((componentId) => {
        const componentIndex = layer.components.findIndex(({ id }) => id === componentId);
        return componentIndex === -1 ? null : (directComponents[componentIndex]?.bounds ?? null);
      }),
    );
    return bounds ? Bounds.toRect(bounds) : null;
  }

  /** Returns this source's render-model cells, new only when its location changed. */
  #renderInputsFor(sourceId: SourceId, location: ExternalAxisLocation): SourceRenderInputs {
    const cached = this.#sourceRenderInputs.get(sourceId);
    if (cached && externalAxisLocationsEqual(cached.location, location)) return cached;

    const inputs: SourceRenderInputs = {
      location,
      locationCell: signal(location),
      sourceIdCell: signal<SourceId | null>(sourceId),
    };
    this.#sourceRenderInputs.set(sourceId, inputs);
    return inputs;
  }

  /**
   * The reference layer's glyph's layers at the other sources selected for editing, in source
   * order; empty when only the active source is; null when the glyph is not loaded, there is no
   * active source, or the glyph lacks a layer at one of them.
   */
  #targetLayers(reference: GlyphLayer): GlyphLayer[] | null {
    const editingSourceIds = this.#editingSourceIdsCell.peek();
    if (editingSourceIds.size <= 1) return [];

    const glyph = this.#glyphForLayer(reference);
    const activeSourceId = this.#activeSourceIdCell.peek();
    if (!glyph || !activeSourceId) return null;

    const targetLayers: GlyphLayer[] = [];
    for (const source of this.#font.sources) {
      if (source.id === activeSourceId || !editingSourceIds.has(source.id)) continue;

      const targetLayer = glyph.layerForSource(source.id);
      if (!targetLayer) return null;

      targetLayers.push(targetLayer);
    }
    return targetLayers;
  }

  #glyphForLayer(layer: GlyphLayer): Glyph | null {
    const glyphId = this.#font.glyphIdForLayer(layer.id);
    return glyphId ? this.#glyphForId(glyphId) : null;
  }
}

/** Whether two locations differ on at least one of `axes` and nowhere else. */
function differsOnlyOn(
  here: ExternalAxisLocation,
  there: ExternalAxisLocation,
  axes: ReadonlySet<AxisId>,
): boolean {
  if (here.size !== there.size) return false;

  let differs = false;
  for (const [axisId, value] of here) {
    if (there.get(axisId) === value) continue;
    if (!axes.has(axisId)) return false;
    differs = true;
  }
  return differs;
}

/** Closer than this, in font units, two points count as the same. */
const SAME_POINT = 0.01;

/**
 * Whether two layers draw the same: the same points in the same places, and the same
 * components placed the same way.
 */
export function sameOutline(a: GlyphLayer, b: GlyphLayer): boolean {
  if (a.contours.length !== b.contours.length) return false;
  if (a.components.length !== b.components.length) return false;

  const componentsMatch = a.components.every((component, i) => {
    const other = b.components[i]!;
    const [m, n] = [component.matrix, other.matrix];
    return (
      component.baseGlyphId === other.baseGlyphId &&
      [m.a - n.a, m.b - n.b, m.c - n.c, m.d - n.d, m.e - n.e, m.f - n.f].every(
        (delta) => Math.abs(delta) < SAME_POINT,
      )
    );
  });
  if (!componentsMatch) return false;

  return a.contours.every((contour, c) => {
    const other = b.contours[c]!;
    if (contour.closed !== other.closed || contour.points.length !== other.points.length) {
      return false;
    }
    return contour.points.every((point, p) => {
      const twin = other.points[p]!;
      return (
        point.isOnCurve === twin.isOnCurve &&
        Math.abs(point.position.x - twin.position.x) < SAME_POINT &&
        Math.abs(point.position.y - twin.position.y) < SAME_POINT
      );
    });
  });
}
