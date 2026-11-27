import { beforeEach, describe, expect, it } from "vitest";
import { expectEdit } from "@/testing/expectEdit";
import type { GlyphFixture } from "@/testing/fixtures";
import { useTestEditor } from "@/testing/fontFixture";

const editor = useTestEditor();
beforeEach(() => {
  editor.selectTool("select");
});

/** A closed square with an extra corner on its bottom edge, at 200,0. */
const NOTCHED = {
  contours: [
    {
      closed: true,
      points: [
        [0, 0],
        [200, 0],
        [400, 0],
        [400, 400],
        [0, 400],
      ],
    },
  ],
} as const satisfies GlyphFixture;

describe("dropping a point on its neighbour merges the two", () => {
  it("removes the dragged point and keeps the one it landed on, as one edit", async () => {
    await editor.draw(NOTCHED);

    await expectEdit(
      editor,
      (e) => e.dragFrom({ x: 200, y: 0 }, { x: 400, y: 0 }),
      async (e) => {
        expect(await e.outline()).toMatchObject([
          {
            closed: true,
            points: [
              { x: 0, y: 0 },
              { x: 400, y: 0 },
              { x: 400, y: 400 },
              { x: 0, y: 400 },
            ],
          },
        ]);
      },
    );
  });

  it("keeps the curve that led into the dragged point, now ending at the kept one", async () => {
    await editor.draw({
      contours: [
        {
          closed: true,
          points: [
            [0, 0],
            { x: 100, y: -100, off: true },
            { x: 300, y: -100, off: true },
            [400, 0],
            [500, 0],
            [500, 400],
            [0, 400],
          ],
        },
      ],
    });

    await editor.dragFrom({ x: 400, y: 0 }, { x: 500, y: 0 });

    const points = (await editor.outline())[0]!.points;
    expect(points).toHaveLength(6);
    expect(points.slice(0, 4)).toMatchObject([
      { x: 0, y: 0 },
      { x: 100, y: -100, pointType: "offCurve" },
      { x: 400, y: -100, pointType: "offCurve" },
      { x: 500, y: 0, pointType: "onCurve" },
    ]);
  });

  it("leaves a point dropped away from its neighbours where it was dropped", async () => {
    await editor.draw(NOTCHED);

    await editor.dragFrom({ x: 200, y: 0 }, { x: 250, y: 0 });

    expect(await editor.outline()).toMatchObject([{ points: Array(5).fill({}) }]);
  });
});
