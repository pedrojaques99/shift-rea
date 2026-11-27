import type { FindingFix, FontFinding, GlyphId, LayerId, PointId, SourceId } from "@shift/types";
import { computed, effect, signal, track, type Effect, type Signal } from "../signals/index";
import type { GlyphLayer } from "../model/Glyph";
import type { Editor } from "./Editor";

/**
 * Codes of the craft checks: what a type designer's review catches in an
 * outline that compiles and interpolates, but reads as unfinished.
 */
const CRAFT_CODES: ReadonlySet<string> = new Set([
  "I009",
  "O011",
  "O012",
  "O013",
  "O014",
  "O015",
  "O016",
  "O017",
]);

/** How long the glyph must sit still before it is reviewed again. */
const SETTLE_MS = 350;

/** One craft problem in the glyph being edited, with the edit that resolves it. */
export interface CraftIssue {
  readonly code: string;
  readonly name: string;
  /** The full sentence, for a tooltip or the agent. */
  readonly message: string;
  /** A few words for a pill beside the point: `Kink 15°`. */
  readonly summary: string;
  /** Points the problem sits at, in every layer it concerns. */
  readonly points: ReadonlySet<PointId>;
  /** The master it is in; null for a problem between masters, such as a kink. */
  readonly sourceId: SourceId | null;
  readonly fix: FindingFix | null;
}

/**
 * Reviews the open glyph for craft problems in the background and keeps the
 * result for the canvas to mark and the commands to fix.
 *
 * @remarks
 * Quiet by design. A review runs only once the glyph has sat still for
 * {@link SETTLE_MS}, never during a gesture, and a result that arrives after
 * the glyph changed again is dropped. Nothing interrupts the designer: the
 * canvas marks the points, the selected point shows what is wrong, and a
 * fix waits for a command (F, the context menu, or Glyph › Fix).
 */
export class CraftReview {
  readonly #editor: Editor;
  readonly #issues = signal<readonly CraftIssue[]>([], { name: "craft.issues" });
  readonly #glyph = signal<GlyphId | null>(null, { name: "craft.glyph" });
  readonly #visible = signal(true, { name: "craft.visible" });
  readonly #revision = signal(0, { name: "craft.revision" });
  readonly #effect: Effect;
  #request = 0;

  /** The issues whose points lie in the layer being edited. */
  readonly shownCell: Signal<readonly CraftIssue[]>;

  constructor(editor: Editor) {
    this.#editor = editor;

    this.shownCell = computed(
      () => {
        if (!this.#visible.value) return [];
        const layer = this.#activeLayer();
        if (!layer) return [];
        const ids = new Set(layer.geometryCell.value.allPoints.map((point) => point.id));
        return this.#issues.value.filter((issue) => [...issue.points].some((id) => ids.has(id)));
      },
      { name: "craft.shown" },
    );

    this.#effect = effect(
      () => {
        track(this.#revision);
        const nodeCell = this.#editor.scene.onlyCell("glyph");
        track(nodeCell);
        const node = nodeCell.peek();
        if (!node) {
          this.#glyph.set(null);
          this.#issues.set([]);
          return;
        }
        // Rerun on every edit of the shown layer (at a master), but review only
        // once it settles. Between masters there is no layer to edit, but the
        // glyph's masters still have their problems.
        const layer = this.#activeLayer();
        if (layer) track(layer.geometryCell);
        if (this.#editor.draggingCell.value || this.#editor.isEditingCell.value) return;

        const glyphId = this.#editor.drawnGlyphId(node);
        if (this.#glyph.peek() !== glyphId) {
          this.#glyph.set(glyphId);
          this.#issues.set([]);
        }

        const request = ++this.#request;
        const timer = setTimeout(() => void this.#review(glyphId, request), SETTLE_MS);
        return () => clearTimeout(timer);
      },
      { name: "craft.review" },
    );
  }

  /** Every craft issue in the open glyph, in every master. */
  get issuesCell(): Signal<readonly CraftIssue[]> {
    return this.#issues;
  }

  /** Whether the canvas marks the issues. */
  get visibleCell(): Signal<boolean> {
    return this.#visible;
  }

  setVisible(visible: boolean): void {
    this.#visible.set(visible);
  }

  toggleVisible(): void {
    this.#visible.set(!this.#visible.peek());
  }

  /** Reviews the open glyph again now, as after an edit made outside the canvas. */
  refresh(): void {
    this.#revision.set(this.#revision.peek() + 1);
  }

  /**
   * Reviews the open glyph now, without waiting for it to settle, and resolves
   * once the result is in.
   */
  async reviewNow(): Promise<readonly CraftIssue[]> {
    const node = this.#editor.scene.only("glyph");
    if (!node) return [];
    const glyphId = this.#editor.drawnGlyphId(node);
    this.#glyph.set(glyphId);
    await this.#editor.font.editCoordinator.settled();
    await this.#review(glyphId, ++this.#request);
    return this.#issues.peek();
  }

  /**
   * Shows `issue` on the canvas: stays on the master being edited when the
   * problem is there, otherwise switches to the first master that has it, and
   * selects its point.
   *
   * @returns false when no master of the open glyph has the issue's points.
   */
  reveal(issue: CraftIssue): boolean {
    const editor = this.#editor;
    const active = this.#activeLayer();
    const inActive = active ? [...issue.points].filter((id) => active.geometry.point(id)) : [];
    if (inActive.length > 0) {
      editor.selection.select(inActive);
      return true;
    }

    const glyphId = this.#glyph.peek();
    const glyph = glyphId ? editor.glyphForId(glyphId) : null;
    if (!glyph) return false;
    const sources = issue.sourceId
      ? editor.font.sources.filter((source) => source.id === issue.sourceId)
      : editor.font.sources;
    for (const source of sources) {
      const layer = glyph.layerForSource(source.id);
      const ids = layer ? [...issue.points].filter((id) => layer.geometry.point(id)) : [];
      if (ids.length === 0) continue;
      editor.selectSource(source.id);
      editor.selection.select(ids);
      return true;
    }
    return false;
  }

  /** The issues at any of `ids`, in the order the review found them. */
  issuesAt(ids: Iterable<string>): readonly CraftIssue[] {
    const wanted = new Set(ids);
    return this.#issues.peek().filter((issue) => [...issue.points].some((id) => wanted.has(id)));
  }

  /**
   * Applies the fixes of `issues` as one undo step.
   *
   * @remarks
   * Fixes that touch the same point are applied once: the first wins, as
   * lining up a smooth point's handles and evening them out across masters
   * both move the same handles. Removals run after the moves.
   *
   * @returns The number of issues fixed.
   */
  async fix(issues: readonly CraftIssue[]): Promise<number> {
    const fixes = issues.flatMap((issue) => (issue.fix ? [issue.fix] : []));
    if (fixes.length === 0) return 0;

    const moved = new Set<string>();
    const moves = new Map<LayerId, { kind: "point"; id: PointId; x: number; y: number }[]>();
    const removals = new Map<LayerId, PointId[]>();
    let applied = 0;
    for (const fix of fixes) {
      const touched = [...fix.moves.map((m) => m.pointId), ...fix.removals.map((r) => r.pointId)];
      if (touched.some((id) => moved.has(id))) continue;
      for (const id of touched) moved.add(id);
      applied += 1;
      for (const step of fix.moves) {
        const list = moves.get(step.layerId) ?? [];
        list.push({ kind: "point", id: step.pointId, x: step.x, y: step.y });
        moves.set(step.layerId, list);
      }
      for (const removal of fix.removals) {
        const list = removals.get(removal.layerId) ?? [];
        list.push(removal.pointId);
        removals.set(removal.layerId, list);
      }
    }

    const glyphId = this.#glyph.peek();
    const glyph = glyphId ? this.#editor.glyphForId(glyphId) : null;
    if (!glyph) return 0;

    const label = applied === 1 ? fixes[0]!.label : `Fix ${applied} Outline Issues`;
    this.#editor.transaction(label, () => {
      for (const [layerId, positions] of moves) {
        glyph.layerForId(layerId)?.applyPositionPatch(positions);
      }
      for (const [layerId, ids] of removals) {
        glyph.layerForId(layerId)?.deletePoints(ids, "fit");
      }
      if (removals.size > 0) this.#editor.selection.clear();
    });
    await this.#editor.font.editCoordinator.settled();
    this.refresh();
    return applied;
  }

  dispose(): void {
    this.#effect.dispose();
  }

  /** The layer being edited; tracks the glyph and the source when called reactively. */
  #activeLayer(): GlyphLayer | null {
    track(this.#editor.activeSourceIdCell);
    const nodeCell = this.#editor.scene.onlyCell("glyph");
    track(nodeCell);
    const node = nodeCell.peek();
    return node ? this.#editor.editableLayer(node) : null;
  }

  async #review(glyphId: GlyphId, request: number): Promise<void> {
    let findings: readonly FontFinding[];
    try {
      findings = await this.#editor.font.checkFont([glyphId]);
    } catch {
      return;
    }
    // A newer edit or another glyph arrived meanwhile: its own review follows.
    if (request !== this.#request || this.#glyph.peek() !== glyphId) return;
    this.#issues.set(
      findings
        .filter((finding) => CRAFT_CODES.has(finding.code) && finding.points.length > 0)
        .map(toIssue),
    );
  }
}

function toIssue(finding: FontFinding): CraftIssue {
  return {
    code: finding.code,
    name: finding.name,
    message: finding.message,
    summary: summarize(finding),
    points: new Set(finding.points),
    sourceId: finding.sourceId ?? null,
    fix: finding.fix ?? null,
  };
}

/** A few words for the pill: what, and how much when the message says. */
function summarize(finding: FontFinding): string {
  const degrees = /(\d+(?:\.\d+)?)°/.exec(finding.message)?.[1];
  const amount = degrees ? ` ${Math.round(Number(degrees) * 10) / 10}°` : "";
  switch (finding.name) {
    case "interpolation-kink":
      return `Kink between masters${amount}`;
    case "broken-smooth":
      return `Smooth point breaks${amount}`;
    case "almost-smooth":
      return `Almost smooth${amount}`;
    case "retracted-handle":
      return "Retracted handle";
    case "short-segment":
      return "Tiny segment";
    case "near-axis-line":
      return `Line off axis${amount}`;
    case "near-axis-handle":
      return `Handle off axis${amount}`;
    case "redundant-point":
      return "Point does nothing";
    default:
      return finding.name;
  }
}
