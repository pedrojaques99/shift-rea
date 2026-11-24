import { beforeEach, describe, expect, it } from "vitest";
import { cubic, line } from "@/testing/fixtures";
import { useTestEditor } from "@/testing/fontFixture";

const editor = useTestEditor();
beforeEach(() => {
  editor.selectTool("select");
});

/** A cubic from 100,100 to 400,100 pulled by controls at 150,250 and 350,250, and an anchor. */
const CURVE_AND_ANCHOR = {
  contours: [cubic([100, 100], [150, 250], [350, 250], [400, 100])],
  anchors: [{ name: "top", x: 250, y: 500 }],
};

describe("the Select cursor names what the pointer would grab", () => {
  beforeEach(async () => {
    await editor.draw(CURVE_AND_ANCHOR);
  });

  it.each([
    { over: "an on-curve point", at: { x: 100, y: 100 }, cursor: "point" },
    { over: "an off-curve handle", at: { x: 150, y: 250 }, cursor: "handle" },
    { over: "an anchor", at: { x: 250, y: 500 }, cursor: "anchor" },
    { over: "empty canvas", at: { x: 800, y: 800 }, cursor: "default" },
  ])("over $over", ({ at, cursor }) => {
    editor.movePointerTo(at);

    expect(editor.toolCursor()).toBe(cursor);
  });

  it("over a segment", () => {
    editor.movePointerTo({ x: 250, y: 212.5 });

    expect(editor.toolCursor()).toBe("segment");
  });

  it.each([
    { dragging: "an on-curve point", from: { x: 400, y: 100 }, cursor: "point-move" },
    { dragging: "an off-curve handle", from: { x: 350, y: 250 }, cursor: "handle-move" },
    { dragging: "an anchor", from: { x: 250, y: 500 }, cursor: "anchor-move" },
  ])(
    "fills the badge while dragging $dragging, and drops it on release",
    async ({ from, cursor }) => {
      editor.holdDragFrom(from, { x: from.x + 40, y: from.y + 40 });
      expect(editor.toolCursor()).toBe(cursor);

      await editor.releaseAt({ x: from.x + 40, y: from.y + 40 });
      expect(editor.toolCursor()).not.toBe(cursor);
    },
  );
});

describe("dragging a group keeps the move cursor", () => {
  it("when several points move together", async () => {
    const { first, last } = await editor.draw({
      contours: [line({ x: 100, y: 100, name: "first" }, { x: 300, y: 300, name: "last" })],
    });
    editor.select([first, last]);

    editor.holdDragFrom({ x: 150, y: 250 }, { x: 190, y: 290 });

    expect(editor.toolCursor()).toBe("move");
    await editor.pressKey("Escape");
  });
});
