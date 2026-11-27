import { describe, expect, it } from "vitest";
import { expectEdit } from "@/testing/expectEdit";
import { useTestEditor, WEIGHT } from "@/testing/fontFixture";

const editor = useTestEditor();

const SQUARE = {
  contours: [
    {
      closed: true,
      points: [
        { name: "a", x: 0, y: 0, pointType: "onCurve" as const },
        { name: "b", x: 400, y: 0, pointType: "onCurve" as const },
        { name: "c", x: 400, y: 400, pointType: "onCurve" as const },
        { name: "d", x: 0, y: 400, pointType: "onCurve" as const },
      ],
    },
  ],
};

describe("corner radius", () => {
  it("rounds a selected corner into a quarter circle, as one undo step", async () => {
    const names = await editor.draw(SQUARE);
    editor.select([names.b]);

    await expectEdit(
      editor,
      async (e) => {
        expect(e.roundSelectedCorners(40)).toBe(1);
        await e.settle();
      },
      async (e) => {
        const points = (await e.outline())[0]!.points;
        expect(points).toHaveLength(7);
        expect(points[1]).toMatchObject({ x: 360, y: 0, pointType: "onCurve", smooth: true });
        expect(points[4]).toMatchObject({ x: 400, y: 40, pointType: "onCurve", smooth: true });
      },
    );
  });

  it("rounds the same corner in every master being edited, so the glyph stays compatible", async () => {
    const names = await editor.draw(SQUARE);
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });
    await editor.editSources(["Regular", "Bold"]);
    editor.select([names.b]);

    expect(editor.roundSelectedCorners(40)).toBe(1);
    await editor.settle();

    const sevenPoints = { contours: [{ points: Array(7).fill(expect.anything()) }] };
    expect(await editor.layerAt("Regular")).toMatchObject(sevenPoints);
    expect(await editor.layerAt("Bold")).toMatchObject(sevenPoints);
  });

  it("leaves a selection without corners alone", async () => {
    await editor.draw(SQUARE);
    editor.select([]);
    expect(editor.roundSelectedCorners(40)).toBe(0);
  });
});
