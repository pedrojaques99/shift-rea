import type { Editor } from "@shift/editor";
import { kerningValueEdit } from "@shift/editor/model";
import type { KerningPair } from "@shift/editor/tools";
import type { ScrubSession } from "@shift/ui";

/**
 * Opens a live scrub of a kerning pair's value at a source, as the
 * kerning field does: each step shows at once in the window's engine and
 * the release commits one undo step.
 *
 * @param sourceId - The source to kern at; the active source when omitted.
 * @returns null when the pair cannot be kerned there, or another edit is open.
 */
export function scrubKerning(
  editor: Editor,
  pair: KerningPair,
  sourceId = pair.source(editor),
): ScrubSession | null {
  const start = pair.editablePair(editor, sourceId ?? undefined);
  if (!sourceId || !start) return null;

  const edit = openKerningEdit(editor);
  if (!edit) return null;

  // Edits are measured from the pair as it was, since previews change what it resolves to.
  const editsFor = (value: number) => {
    const amount = Math.round(value);
    return amount === start.amount ? [] : [kerningValueEdit(sourceId, start, amount)];
  };
  return {
    preview: (value) => edit.preview(editsFor(value)),
    commit: (value) => {
      edit.preview(editsFor(value));
      edit.commit("Change kerning");
    },
    cancel: () => edit.discard(),
  };
}

/** The font's kerning edit, or null while another edit is open; the field then commits once on release. */
function openKerningEdit(editor: Editor) {
  try {
    return editor.font.beginKerningEdit();
  } catch {
    return null;
  }
}
