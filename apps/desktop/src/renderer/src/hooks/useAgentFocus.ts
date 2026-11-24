import type { Editor } from "@shift/editor";
import { useSignalState } from "@shift/editor/signals";
import {
  isAnchorId,
  isComponentId,
  isContourId,
  isPointId,
  type GlyphId,
  type NodeId,
} from "@shift/types";
import { useLocation } from "react-router";
import { tagTargetsOf } from "@/lib/glyph-grid/tagTargets";
import { useEditor, useFontSession } from "@/workspace/WorkspaceContext";

/** The glyph grid's route. */
const GRID_PATH = "/home";

/** What the user has open, for the agent: `label` shows in the chat, `focus` reaches the agent. */
export interface AgentFocus {
  readonly label: string;
  readonly focus: string;
}

/** The most selection ids named to the agent; past this it gets a count. */
const MAX_IDS = 24;

const KINDS = [
  { is: isPointId, one: "point", many: "points" },
  { is: isContourId, one: "contour", many: "contours" },
  { is: isAnchorId, one: "anchor", many: "anchors" },
  { is: isComponentId, one: "component", many: "components" },
] as const;

/**
 * The glyph being edited and what is selected in it, so "make these rounder" reaches the
 * agent with the points it means. Null when no glyph is being edited.
 */
export function useAgentFocus(): AgentFocus | null {
  const editor = useEditor();
  const session = useFontSession();
  const { pathname } = useLocation();
  const selection = useSignalState(editor.selection.stateCell);
  const editing = useSignalState(editor.editing.stateCell);
  const gridSelection = useSignalState(session.tabs.gridSelectionCell);
  useSignalState(editor.activeSourceIdCell);

  // On the glyph grid the grid's selection is what "these" means, not the last edited glyph.
  if (pathname === GRID_PATH)
    return gridFocus(editor, tagTargetsOf(pathname, gridSelection.ids, null));

  return agentFocus(editor, editing.nodeIds, selection.ids);
}

/** The glyphs selected in the grid, named; null with none, so the agent works on the font. */
function gridFocus(editor: Editor, glyphIds: readonly GlyphId[]): AgentFocus | null {
  if (glyphIds.length === 0) return null;

  const names = glyphIds.map((id) => editor.font.glyphName(id) ?? id);
  const count = `${names.length} ${names.length === 1 ? "glyph" : "glyphs"}`;
  const shown = names.slice(0, 4).join(", ");
  const label = names.length > 4 ? `${count}: ${shown}…` : `${count}: ${shown}`;
  const listed = names.slice(0, MAX_IDS).join(", ");
  const more = names.length > MAX_IDS ? `, and ${names.length - MAX_IDS} more` : "";
  return { label, focus: `the glyph grid; selected glyphs: ${listed}${more}` };
}

function agentFocus(
  editor: Editor,
  nodeIds: readonly NodeId[],
  selected: readonly unknown[],
): AgentFocus | null {
  const glyphId = editedGlyphId(editor, nodeIds);
  if (!glyphId) return null;

  const name = editor.font.glyphName(glyphId) ?? glyphId;
  const sourceId = editor.activeSourceIdCell.peek();
  const source = sourceId ? (editor.font.source(sourceId)?.name ?? null) : null;
  const counts = KINDS.flatMap(({ is, one, many }) => {
    const count = selected.filter(is).length;
    if (count === 0) return [];
    return [`${count} ${count === 1 ? one : many}`];
  });

  const label = [name, ...counts].join(" · ");
  const where = source ? `glyph ${name}, source ${source}` : `glyph ${name}`;
  if (counts.length === 0) return { label, focus: `${where}; nothing selected` };

  const ids = selected.slice(0, MAX_IDS).map(String).join(", ");
  const more = selected.length > MAX_IDS ? `, and ${selected.length - MAX_IDS} more` : "";
  return { label, focus: `${where}; selected: ${counts.join(", ")} (${ids}${more})` };
}

/** The glyph of the first edited glyph node, in a text run or alone. */
function editedGlyphId(editor: Editor, nodeIds: readonly NodeId[]): GlyphId | null {
  for (const id of nodeIds) {
    const node = editor.scene.nodeOfKind(id, "glyph");
    if (node) return node.glyphId;
  }
  return editor.editedGlyphCell.peek()?.glyphId ?? null;
}
