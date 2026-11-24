import { describe, expect, it } from "vitest";
import { Bounds } from "@shift/geo";
import { beginMetricScrub } from "@shift/editor/ui";
import { rect } from "@/testing/fixtures";
import { useTestEditor } from "@/testing/fontFixture";
import { scrubSelectionMove } from "@/lib/editor/selectionScrub";

describe("scrubbing a sidebar field", () => {
  const editor = useTestEditor({
    glyphs: { A: { outline: { advance: 500, contours: [rect(100, 200, 50, 50)] } } },
  });

  it("previews the left sidebearing live and commits the drag as one undo step", async () => {
    const outline = await editor.outline();
    const scrub = beginMetricScrub(editor.asEditor(), "left", 100);
    if (!scrub) throw new Error("the glyph's metrics should be scrubbable");

    for (const value of [101, 105, 112, 120]) scrub.preview(value);
    expect((await editor.drawnGlyph()).sidebearings).toEqual({ lsb: 120, rsb: 350 });

    scrub.commit(125);
    await editor.settle();
    expect((await editor.drawnGlyph()).sidebearings).toEqual({ lsb: 125, rsb: 350 });
    expect(await editor.advanceWidth()).toBe(525);

    await editor.undo();
    expect((await editor.drawnGlyph()).sidebearings).toEqual({ lsb: 100, rsb: 350 });
    expect(await editor.advanceWidth()).toBe(500);
    expect(await editor.outline()).toEqual(outline);
  });

  it("restores the advance when a scrub is cancelled, adding no undo step", async () => {
    editor.setAdvanceWidth(520);
    await editor.settle();

    const scrub = beginMetricScrub(editor.asEditor(), "width", 520);
    if (!scrub) throw new Error("the glyph's metrics should be scrubbable");
    scrub.preview(560);
    expect((await editor.drawnGlyph()).advanceWidth).toBe(560);
    scrub.cancel();
    await editor.settle();
    expect(await editor.advanceWidth()).toBe(520);

    // The one undo reverts the typed width: the cancelled scrub left no step of its own.
    await editor.undo();
    expect(await editor.advanceWidth()).toBe(500);
  });

  it("moves the selection live and commits the scrub as one undo step", async () => {
    editor.selectAll();
    const before = editor.selectionLocalRect();
    if (!before) throw new Error("the outline should be selected");

    const scrub = scrubSelectionMove(
      editor.asEditor(),
      Bounds.fromXYWH(before.x, before.y, before.width, before.height),
      "x",
    );
    if (!scrub) throw new Error("the selection should be scrubbable");
    for (const value of [110, 130, 160]) scrub.preview(value);
    expect(editor.selectionLocalRect()).toMatchObject({ x: 160 });

    scrub.commit(170);
    await editor.settle();
    expect(editor.selectionLocalRect()).toMatchObject({ x: 170 });

    await editor.undo();
    expect(editor.selectionLocalRect()).toMatchObject({ x: before.x });
  });
});
