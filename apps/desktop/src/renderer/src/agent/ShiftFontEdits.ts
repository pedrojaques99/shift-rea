import {
  FontEditPlaceholderError,
  FontEditRefusedError,
  FontEditUnavailableError,
  type FontEdit,
  type FontEditInput,
  type ShiftReadInput,
} from "@shift/runtime";
import type { Editor, WorkspaceEditCoordinator } from "@shift/editor";
import {
  mintAnchorId,
  mintAxisId,
  mintAxisLabelId,
  mintAxisMappingId,
  mintComponentId,
  mintContourId,
  mintGlyphId,
  mintKerningGroupId,
  mintLayerId,
  mintMetricId,
  mintNamedInstanceId,
  mintPointId,
  mintSourceId,
  mintSwapId,
  type FontIntent,
} from "@shift/types";

/** Mints a fresh id for each placeholder prefix an agent may write. */
const MINTERS: Readonly<Record<string, () => string>> = {
  point: mintPointId,
  contour: mintContourId,
  anchor: mintAnchorId,
  component: mintComponentId,
  glyph: mintGlyphId,
  layer: mintLayerId,
  source: mintSourceId,
  axis: mintAxisId,
  axisLabel: mintAxisLabelId,
  axisMapping: mintAxisMappingId,
  kerningGroup: mintKerningGroupId,
  namedInstance: mintNamedInstanceId,
  metric: mintMetricId,
  swap: mintSwapId,
};

const PLACEHOLDER = /^new:([A-Za-z]+):(.+)$/;

/**
 * Applies an agent's font edits as one undo step, through the window's
 * workspace edit lane: the path the editor's own tools and menus take.
 *
 * @remarks
 * Rust validates every intent; this only swaps `new:` placeholders for
 * freshly minted ids, the way the editor mints ids for what it creates.
 */
export class ShiftFontEdits {
  readonly #editor: Editor;
  readonly #coordinator: WorkspaceEditCoordinator | null;

  constructor(editor: Editor, coordinator: WorkspaceEditCoordinator | null) {
    this.#editor = editor;
    this.#coordinator = coordinator;
  }

  /**
   * @throws {FontEditUnavailableError} for a preview, which takes no edits.
   * @throws {FontEditPlaceholderError} for a `new:` prefix no id uses.
   * @throws {FontEditRefusedError} when Rust refuses an intent; nothing is kept.
   */
  async apply({ label, intents }: ShiftReadInput<FontEditInput>): Promise<FontEdit> {
    const coordinator = this.#coordinator;
    if (this.#editor.sessionMode === "preview" || !coordinator) {
      throw new FontEditUnavailableError();
    }

    const ids: Record<string, string> = {};
    const resolved = resolvePlaceholders(intents, ids) as FontIntent[];

    try {
      const change = await coordinator.apply(resolved, label);
      return {
        ids,
        layerIds: change.layers.map(({ layerId }) => layerId),
        dependentGlyphIds: [...change.dependents],
        fontChanged: change.next != null,
      };
    } catch (error) {
      throw new FontEditRefusedError(error instanceof Error ? error.message : String(error));
    }
  }
}

/** Copies `value`, swapping each `new:<prefix>:<key>` string for its minted id. */
function resolvePlaceholders(value: unknown, ids: Record<string, string>): unknown {
  if (typeof value === "string") return resolvePlaceholder(value, ids);

  if (Array.isArray(value)) return value.map((item) => resolvePlaceholders(item, ids));

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, item]) => [
      key,
      resolvePlaceholders(item, ids),
    ]);
    return Object.fromEntries(entries);
  }

  return value;
}

function resolvePlaceholder(text: string, ids: Record<string, string>): string {
  const match = PLACEHOLDER.exec(text);
  if (!match) return text;

  const existing = ids[text];
  if (existing) return existing;

  const mint = MINTERS[match[1]];
  if (!mint) {
    throw new FontEditPlaceholderError(
      `"${text}" uses the prefix "${match[1]}"; placeholders use ${Object.keys(MINTERS).join(", ")}`,
    );
  }

  const id = mint();
  ids[text] = id;
  return id;
}
