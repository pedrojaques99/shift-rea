import type { MetricsKeySide } from "@shift/types";
import type { ScrubSession } from "@shift/ui";
import type { Editor } from "../lib/editor/Editor";
import type { SidebearingEdit } from "../lib/model/SidebearingEdit";

const UNDO_LABEL: Record<MetricsKeySide, string> = {
  left: "Set left sidebearing",
  right: "Set right sidebearing",
  width: "Set advance width",
};

/**
 * Opens a live scrub of one metric of the glyph in the scene, as its
 * sidebar field does: the left sidebearing moves the outline with the
 * advance; the right sidebearing and the advance move the advance alone.
 *
 * @remarks
 * Previews never persist; the commit is one undo step, and like a typed
 * value it first breaks the link that would pull the metric back.
 *
 * @param start - The metric's value as the field showed it when the scrub began.
 * @returns null when there is no single editable glyph layer, or it is already being edited.
 */
export function beginMetricScrub(
  editor: Editor,
  side: MetricsKeySide,
  start: number,
): ScrubSession | null {
  const links = editor.activeMetricsLinks();
  if (!links) return null;

  let edit: SidebearingEdit;
  try {
    edit = links.layer.beginSidebearingEdit(side === "left" ? "lsb" : "rsb", () =>
      links.unlinkFor(side),
    );
  } catch {
    // Another edit holds the layer; the field falls back to one commit on release.
    return null;
  }

  const delta = (value: number) => Math.round(value) - Math.round(start);
  return {
    preview: (value) => edit.preview(delta(value)),
    commit: (value) => {
      edit.preview(delta(value));
      edit.commit(UNDO_LABEL[side]);
    },
    cancel: () => edit.discard(),
  };
}
