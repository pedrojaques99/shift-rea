import { useSignalState } from "@shift/editor/signals";
import type { TextSettingsTarget } from "@/types/textSettings";
import { useEditor } from "@/workspace/WorkspaceContext";

/** The proof text the sidebar's text settings apply to, and the node that places it. */
export function useTextSettingsRun(): TextSettingsTarget | null {
  const editor = useEditor();
  const run = useSignalState(editor.text.currentRunCell);
  const node = useSignalState(editor.text.currentRunNodeCell);
  if (!run || !node) return null;

  return { run, node };
}
