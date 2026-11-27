import type { Point2D } from "@shift/geo";
import { asPointId } from "@shift/types";
import type { Canvas } from "../Canvas";
import type { Editor } from "../../Editor";
import type { CraftIssue } from "../../CraftReview";
import { drawValuePill } from "./valuePill";

/** Gap between a marked point and its pill, in screen pixels. */
const LABEL_OFFSET_PX = 12;

/**
 * Marks the points the craft review flagged in the layer being edited.
 *
 * @remarks
 * A thin ring, nothing more, until the designer looks at a point: selecting
 * or hovering a marked point adds a pill that names the problem and the key
 * that fixes it. Markers step aside while a gesture runs, so they never sit
 * on top of a point being dragged.
 */
export class CraftMarkers {
  readonly #editor: Editor;

  constructor(editor: Editor) {
    this.#editor = editor;
  }

  /** Reads its inputs without tracking: the overlay layer's props track them. */
  draw(canvas: Canvas): void {
    const editor = this.#editor;
    if (editor.draggingCell.peek() || editor.isEditingCell.peek()) return;

    const issues = editor.craft.shownCell.peek();
    if (issues.length === 0) return;

    const node = editor.scene.onlyCell("glyph").peek();
    const layer = node ? editor.editableLayer(node) : null;
    if (!node || !layer) return;

    const geometry = layer.geometryCell.peek();
    const focus = new Set<string>(editor.selection.stateCell.peek().ids);
    const hovered = editor.hover.entryCell.peek();
    if (hovered) focus.add(hovered);

    const marks: { position: Point2D; issue: CraftIssue; focused: boolean }[] = [];
    for (const issue of issues) {
      for (const id of issue.points) {
        const point = geometry.point(asPointId(id));
        if (!point) continue;
        marks.push({ position: point, issue, focused: focus.has(id) });
      }
    }
    if (marks.length === 0) return;

    const { color, widthPx, ringPx, labelFill, labelText, font } = canvas.theme.craft;
    canvas.withTransform(editor.sceneTransform(node), (local) => {
      for (const mark of marks) {
        local.strokeCircle(mark.position, ringPx, color, widthPx);
      }

      const labelled = new Map<string, { position: Point2D; text: string }>();
      for (const mark of marks) {
        if (!mark.focused) continue;
        const key = `${mark.position.x},${mark.position.y}`;
        const text = mark.issue.fix ? `${mark.issue.summary} · F` : mark.issue.summary;
        const existing = labelled.get(key);
        labelled.set(key, {
          position: mark.position,
          text: existing ? `${existing.text}  ·  ${mark.issue.summary}` : text,
        });
      }
      if (labelled.size === 0) return;

      local.withScreenSpace((screen, project) => {
        for (const { position, text } of labelled.values()) {
          const at = project.point(position);
          drawValuePill(
            screen,
            { x: at.x + LABEL_OFFSET_PX, y: at.y - LABEL_OFFSET_PX - 16 },
            text,
            { fill: labelFill, text: labelText, font },
            "corner",
          );
        }
      });
    });
  }
}
