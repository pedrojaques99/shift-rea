import { beforeEach, describe, expect, it } from "vitest";
import { line } from "@/testing/fixtures";
import { useTestEditor } from "@/testing/fontFixture";

const editor = useTestEditor();
const ADVANCE = 600;

beforeEach(() => {
  editor.selectTool("select");
});

/** A stationary pair 80 apart on the baseline (a stem) and a lone point at 400,400 beside the dragged one. */
const STEM_AND_NEIGHBOUR = {
  contours: [
    {
      points: [[100, 0], [180, 0], [400, 400], { x: 300, y: 300, name: "moving" }],
    },
  ],
} as const;

describe("dragging a point near a metric lands it on the metric", () => {
  it("lands on the x-height and reports the metric guide", async () => {
    const { xHeight } = editor.metrics();
    if (xHeight === undefined) throw new Error("Expected the test font to author an x-height");
    const { moving } = await editor.draw(STEM_AND_NEIGHBOUR);
    const near = xHeight - editor.hitDistance() / 2;

    editor.pressAt({ x: 300, y: 300 });
    editor.movePointerTo({ x: 250, y: near });

    expect(editor.drawnSnapGuides()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "metric", metric: "xHeight", y: xHeight }),
      ]),
    );
    await editor.releaseAt({ x: 250, y: near });
    expect(await editor.point(moving)).toMatchObject({ y: xHeight });
  });
});

describe("dragging a point snaps it to the glyph's advance box", () => {
  beforeEach(async () => {
    await editor.draw({
      contours: [{ points: [[40, 60], { x: 130, y: 230, name: "p" }, [70, 420]] }],
    });
    editor.setAdvanceWidth(ADVANCE);
  });

  it.each([
    { edge: "centre", x: ADVANCE / 2 },
    { edge: "right", x: ADVANCE },
  ] as const)("lands on the advance's $edge and reports a guide", async ({ edge, x }) => {
    const near = x - editor.hitDistance() / 2;

    editor.pressAt({ x: 130, y: 230 });
    editor.movePointerTo({ x: near, y: 250 });

    expect(editor.drawnSnapGuides()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "advance", edge, x })]),
    );
    await editor.releaseAt({ x: near, y: 250 });
  });
});

describe("dragging a point snaps it to the letter's own architecture", () => {
  it("mirrors a point on its row about the advance's centre", async () => {
    const { p } = await editor.draw({
      contours: [{ points: [[150, 250], { x: 130, y: 100, name: "p" }, [80, 420]] }],
    });
    editor.setAdvanceWidth(ADVANCE);
    const near = 450 - editor.hitDistance() / 2;

    editor.pressAt({ x: 130, y: 100 });
    editor.movePointerTo({ x: near, y: 250 });

    expect(editor.drawnSnapGuides()).toEqual(
      expect.arrayContaining([
        { kind: "symmetry", mirror: { x: 150, y: 250 }, point: { x: 450, y: 250 }, centre: 300 },
      ]),
    );
    await editor.releaseAt({ x: near, y: 250 });
    expect(await editor.point(p)).toMatchObject({ x: 450, y: 250 });
  });

  it("makes a gap to its neighbour as wide as a stem already in the glyph", async () => {
    const { moving } = await editor.draw(STEM_AND_NEIGHBOUR);
    editor.setAdvanceWidth(ADVANCE);
    const near = 480 - editor.hitDistance() / 2;

    editor.pressAt({ x: 300, y: 300 });
    editor.movePointerTo({ x: near, y: 400 });

    expect(editor.drawnSnapGuides()).toEqual(
      expect.arrayContaining([
        {
          kind: "distance",
          axis: "x",
          from: { x: 400, y: 400 },
          to: { x: 480, y: 400 },
          distance: 80,
          reference: [
            { x: 100, y: 0 },
            { x: 180, y: 0 },
          ],
        },
      ]),
    );
    await editor.releaseAt({ x: near, y: 400 });
    expect(await editor.point(moving)).toMatchObject({ x: 480, y: 400 });
  });

  it("leaves the point free and draws no guide while Cmd is held", async () => {
    const { moving } = await editor.draw(STEM_AND_NEIGHBOUR);
    editor.setAdvanceWidth(ADVANCE);
    const near = 480 - editor.hitDistance() / 2;

    editor.pressAt({ x: 300, y: 300 }, { metaKey: true });
    editor.movePointerTo({ x: near, y: 400 }, { metaKey: true });

    expect(editor.drawnSnapGuides()).toEqual([]);
    await editor.releaseAt({ x: near, y: 400 }, { metaKey: true });
    expect(await editor.point(moving)).toMatchObject({ x: near, y: 400 });
  });
});

describe("a drag shows its live value beside the pointer", () => {
  it("shows how far the points moved, and hides when the drag ends", async () => {
    await editor.draw(STEM_AND_NEIGHBOUR);

    editor.pressAt({ x: 300, y: 300 }, { metaKey: true });
    editor.movePointerTo({ x: 340, y: 270 }, { metaKey: true });

    expect(editor.drawnDragReadout()).toMatchObject({
      reading: { kind: "move", delta: { x: 40, y: -30 } },
    });
    await editor.releaseAt({ x: 340, y: 270 }, { metaKey: true });
    expect(editor.drawnDragReadout()).toBeNull();
  });

  it("shows a dragged handle's length and angle from its point", async () => {
    await editor.draw({
      contours: [
        {
          points: [
            [100, 100],
            { x: 200, y: 100, off: true },
            { x: 300, y: 200, off: true },
            [400, 200],
          ],
        },
      ],
    });

    editor.pressAt({ x: 200, y: 100 }, { metaKey: true });
    editor.movePointerTo({ x: 160, y: 180 }, { metaKey: true });

    expect(editor.drawnDragReadout()).toMatchObject({
      reading: { kind: "handle", length: expect.closeTo(100), angle: expect.closeTo(53.13, 2) },
    });
    await editor.pressKey("Escape");
  });

  it("shows the new width and height while resizing through the bounding box", async () => {
    await editor.draw({ contours: [line([100, 100], [200, 200])] }, { select: true });

    editor.pressAt({ x: 200, y: 200 });
    editor.movePointerTo({ x: 250, y: 225 });

    expect(editor.drawnDragReadout()).toMatchObject({
      reading: { kind: "resize", width: expect.closeTo(150), height: expect.closeTo(125) },
    });
    await editor.pressKey("Escape");
  });
});
