import { describe, expect, it } from "vitest";
import { cubic } from "@/testing/fixtures";
import { useTestEditor, WEIGHT } from "@/testing/fontFixture";

const editor = useTestEditor();

const NOTCHED = {
  contours: [
    {
      closed: true,
      points: [
        { x: 0, y: 0, name: "a" },
        { x: 200, y: 0, name: "b" },
        { x: 400, y: 0, name: "c" },
        { x: 400, y: 400, name: "d" },
        { x: 0, y: 400, name: "e" },
      ],
    },
  ],
};

/** The number of points in the first contour at each source. */
async function pointCounts(sources: readonly string[]): Promise<number[]> {
  const counts: number[] = [];
  for (const source of sources) {
    counts.push((await editor.layerAt(source)).contours[0]?.points.length ?? 0);
  }
  return counts;
}

describe("structural edits reach every master, so the glyph keeps interpolating", () => {
  it("deletes a point in every master, though only one is being edited", async () => {
    await editor.draw(NOTCHED);
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });

    editor.select([(await editor.pointAt({ x: 200, y: 0 }))!.id]);
    expect(await editor.deleteSelection()).toBe(true);
    await editor.settle();

    expect(await pointCounts(["Regular", "Bold"])).toEqual([4, 4]);
  });

  it("merges a point dropped on its neighbour in every master", async () => {
    await editor.draw(NOTCHED);
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });
    editor.selectTool("select");

    await editor.dragFrom({ x: 200, y: 0 }, { x: 400, y: 0 });
    await editor.settle();

    expect(await pointCounts(["Regular", "Bold"])).toEqual([4, 4]);
  });

  it("adds a point with the pen in every master", async () => {
    await editor.draw({ contours: [cubic([0, 0], [0, 100], [200, 100], [200, 0])] });
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });
    editor.selectTool("pen");

    await editor.clickAt({ x: 100, y: 75 });
    await editor.settle();

    expect(await pointCounts(["Regular", "Bold"])).toEqual([7, 7]);
  });
});
