import type { Editor } from "@shift/editor";
import { PositionEdits } from "@shift/editor/model";
import { anchorToPoint } from "@shift/editor/transform";
import type { AnchorPosition } from "@shift/editor/types";
import { Bounds, Mat, Vec2, type MatModel, type Point2D, type PointAxis } from "@shift/geo";
import type { ScrubSession } from "@shift/ui";
import type { SelectionScrubPlan } from "@/types/selectionScrub";

/**
 * Opens a live scrub that transforms the editor's selection as a sidebar
 * field's value changes: the selected components when there are any,
 * otherwise the selected points.
 *
 * @remarks
 * Previews never persist; the commit is one undo step and the cancel
 * restores the selection as it was.
 *
 * @returns null when nothing selected can be transformed, or another edit holds the layer.
 */
export function beginSelectionScrub(editor: Editor, plan: SelectionScrubPlan): ScrubSession | null {
  const ids = editor.selection.ids;
  try {
    const components = editor.componentTransformSelection(ids);
    if (components && !editor.isEditing) {
      const edit = components.layer.beginComponentTransformEdit(components);
      const preview = (value: number) => edit.preview((layer) => plan.components(value, layer));
      return {
        preview,
        commit: (value) => {
          preview(value);
          edit.commit(plan.label);
        },
        cancel: () => edit.discard(),
      };
    }

    if (editor.isEditing) return null;

    const selection = editor.positionSelection(ids);
    if (!selection) return null;

    const edit = plan.points(selection);
    return {
      preview: (value) => edit.preview(value),
      commit: (value) => {
        edit.preview(value);
        edit.commit();
      },
      cancel: () => edit.discard(),
    };
  } catch {
    // Another edit holds the layer; the field falls back to one commit on release.
    return null;
  }
}

/** `matrix` applied about `origin`. */
function about(origin: Point2D, matrix: MatModel): MatModel {
  return Mat.Compose(
    Mat.Translate(origin.x, origin.y),
    Mat.Compose(matrix, Mat.Translate(-origin.x, -origin.y)),
  );
}

/**
 * Scrubs the selection's position on one axis, as the X and Y fields do.
 *
 * @param bounds - The selection's bounds when the scrub began; the field's value is their minimum.
 */
export function scrubSelectionMove(
  editor: Editor,
  bounds: Bounds,
  axis: PointAxis,
): ScrubSession | null {
  const start = bounds.min[axis];
  const deltaFor = (value: number) => Vec2.fromAxis(axis, value - start);
  return beginSelectionScrub(editor, {
    label: "Move components",
    points: (selection) => {
      const edit = PositionEdits.fromSelection(selection).move(selection.targets);
      return {
        preview: (value) => edit.preview(deltaFor(value)),
        commit: () => edit.commit("Move positions"),
        discard: () => edit.discard(),
      };
    },
    components: (value) => {
      const delta = deltaFor(value);
      return Mat.Translate(delta.x, delta.y);
    },
  });
}

/**
 * Scrubs a scale of the selection about one of its anchor points, as the
 * size and scale fields do.
 *
 * @param bounds - The selection's bounds when the scrub began.
 * @param anchor - The fixed point: of the whole selection for points, of each layer's components for components.
 * @param scaleFor - The horizontal and vertical factors a field value asks for.
 */
export function scrubSelectionScale(
  editor: Editor,
  bounds: Bounds,
  anchor: AnchorPosition,
  scaleFor: (value: number) => Point2D,
): ScrubSession | null {
  const origin = anchorToPoint(anchor, bounds);
  return beginSelectionScrub(editor, {
    label: "Scale components",
    points: (selection) => {
      const edit = PositionEdits.fromSelection(selection).scale(selection.targets, origin);
      return {
        preview: (value) => edit.preview(scaleFor(value)),
        commit: () => edit.commit(),
        discard: () => edit.discard(),
      };
    },
    components: (value, layer) => {
      const scale = scaleFor(value);
      const local = Bounds.fromXYWH(
        layer.bounds.x,
        layer.bounds.y,
        layer.bounds.width,
        layer.bounds.height,
      );
      return about(anchorToPoint(anchor, local), Mat.Scale(scale.x, scale.y));
    },
  });
}

/**
 * Scrubs a rotation of the selection about its centre, as the rotation field does.
 *
 * @param start - The field's angle in degrees when the scrub began; the selection turns by the change from it.
 */
export function scrubSelectionRotation(
  editor: Editor,
  bounds: Bounds,
  start: number,
): ScrubSession | null {
  const radiansFor = (value: number) => ((value - start) * Math.PI) / 180;
  const center = Bounds.center(bounds);
  return beginSelectionScrub(editor, {
    label: "Rotate components",
    points: (selection) => {
      const edit = PositionEdits.fromSelection(selection).rotate(selection.targets, center);
      return {
        preview: (value) => {
          edit.preview(radiansFor(value));
        },
        commit: () => edit.commit(),
        discard: () => edit.discard(),
      };
    },
    components: (value, { bounds: local }) =>
      about(
        { x: local.x + local.width / 2, y: local.y + local.height / 2 },
        Mat.Rotate(radiansFor(value)),
      ),
  });
}
