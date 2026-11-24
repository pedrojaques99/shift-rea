import type { Editor } from "@shift/editor";
import { useSignalState } from "@shift/editor/signals";
import { runPairs, type KerningPair } from "@shift/editor/tools";
import type { GlyphNode } from "@shift/editor/types";
import { scrubKerning } from "@/lib/kerning/kerningScrub";
import { SidebarNumberField } from "./SidebarNumberField";
import { SidebarSubsection } from "./SidebarSection";

/**
 * The kern between the edited glyph and each of its neighbours in the text, one number per pair
 * ("aV  −40", "Vi  0"): drag or type it, as the Left and Right fields, without opening the
 * Kerning tool. Nothing when the glyph stands alone.
 */
export function NeighbourKerning({ editor, node }: { editor: Editor; node: GlyphNode }) {
  // Pairs are measurements: re-measure when kerning, the style or the text changes.
  useSignalState(editor.font.kerningCell);
  useSignalState(editor.externalLocationCell);
  useSignalState(editor.activeSourceIdCell);
  useSignalState(editor.scene.cell);

  const pairs = neighbourPairs(editor, node);
  if (pairs.length === 0) return null;

  // Kerning is authored at masters: between them the numbers show but cannot change.
  const betweenMasters = editor.sessionMode === "workspace" && !editor.activeSourceId;

  return (
    <SidebarSubsection title="Pairs">
      <div className="flex flex-col gap-1.5">
        {pairs.map((pair) => {
          const edited = pair.editablePair(editor);
          const label = `${glyphText(editor, pair.first)}${glyphText(editor, pair.second)}`;
          return (
            <SidebarNumberField
              key={`${pair.gap.left.itemId}:${pair.gap.right.itemId}`}
              ariaLabel={`Kerning between ${label}`}
              // Case matters in a pair (Vi is not VI): keep the letters as typed.
              label={<span className="min-w-6 normal-case text-primary">{label}</span>}
              value={edited?.amount ?? Math.round(pair.amount)}
              disabled={!edited}
              onValueCommit={(amount) => pair.set(editor, amount)}
              onScrubStart={() => scrubKerning(editor, pair)}
            />
          );
        })}
        {betweenMasters ? (
          <p className="text-ui text-muted">
            Kerning is set on the masters. Pick one in Sources, or a Style that matches one, to
            change it.
          </p>
        ) : null}
      </div>
    </SidebarSubsection>
  );
}

/** The pairs on either side of `node` in the run it is edited in, left pair first. */
function neighbourPairs(editor: Editor, node: GlyphNode): KerningPair[] {
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
