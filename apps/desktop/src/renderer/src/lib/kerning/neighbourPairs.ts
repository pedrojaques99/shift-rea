import type { Editor } from "@shift/editor";
import { runPairs, type KerningPair } from "@shift/editor/tools";
import type { GlyphNode } from "@shift/editor/types";

/** The pairs on either side of `node` in the run it is edited in, left pair first. */
export function neighbourPairs(editor: Editor, node: GlyphNode): KerningPair[] {
  const run = editor.scene.nodeOfKind(editor.scene.parent(node.id)?.id ?? null, "textRun");
  if (!run) return [];

  const itemId = editor.nodeDefinition("textRun").childGlyph(run)?.itemId ?? null;
  if (!itemId) return [];

  return runPairs(editor, run).filter(
    (pair) => pair.gap.left.itemId === itemId || pair.gap.right.itemId === itemId,
  );
}

/** A glyph as the pair label shows it: its character, else its name. */
function glyphText(editor: Editor, glyphId: KerningPair["first"]): string {
  const unicode = editor.font.entryForId(glyphId)?.unicodes[0];
  return unicode === undefined
    ? `/${editor.font.glyphName(glyphId) ?? glyphId} `
    : String.fromCodePoint(unicode);
}

/** A pair as the sidebar labels it: its two characters, as typed ("Vi", not "VI"). */
export function pairLabel(editor: Editor, pair: KerningPair): string {
  return `${glyphText(editor, pair.first)}${glyphText(editor, pair.second)}`;
}
