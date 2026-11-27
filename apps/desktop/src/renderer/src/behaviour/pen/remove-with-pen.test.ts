import { describe, expect, it } from "vitest";
import { Curve, Vec2 } from "@shift/geo";
import { expectEdit } from "@/testing/expectEdit";
import { splitCubic } from "@/testing/fixtures";
import { useTestEditor, WEIGHT } from "@/testing/fontFixture";

const ALT = { shiftKey: false, altKey: true };

/** The curve the split fixture draws: from 0,0 to 200,0, pulled up by controls at 50,100 and 200,100. */
const ORIGINAL = [
  { x: 0, y: 0 },
  { x: 50, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 0 },
] as const;

describe("Alt + click with the Pen removes a point and fits the curve", () => {
  const editor = useTestEditor();

  it("removes the clicked on-curve point and recovers the curve, as one undoable step", async () => {
    const names = await editor.draw({ contours: [splitCubic(...ORIGINAL, 0.4)] });
    const p1 = (await editor.point(names.p1))!;
    editor.selectTool("pen");

    await expectEdit(
      editor,
      (e) => e.clickAt(p1, ALT),
      async (e) => {
        const points = (await e.outline())[0]!.points;
        expect(points).toMatchObject([
          { pointType: "onCurve", id: names.p0 },
          { pointType: "offCurve" },
          { pointType: "offCurve" },
          { pointType: "onCurve", id: names.p2 },
        ]);
        const fit = Curve.cubic(points[0]!, points[1]!, points[2]!, points[3]!);
        const distances = Curve.sample(Curve.cubic(...ORIGINAL), 40).map((point, index) =>
          Vec2.dist(point, Curve.pointAt(fit, index / 40)),
        );
        expect(Math.max(...distances)).toBeLessThan(0.1);
      },
    );
  });

  it("adds a point as usual when Alt is not held", async () => {
    const names = await editor.draw({ contours: [splitCubic(...ORIGINAL, 0.4)] });
    const before = (await editor.outline())[0]!.points.length;
    const p1 = (await editor.point(names.p1))!;
    editor.selectTool("pen");

    await editor.clickAt(p1);

    const outline = await editor.outline();
    expect(outline[0]!.points).toHaveLength(before);
    expect(outline).toHaveLength(2);
  });

  it("does nothing on empty canvas", async () => {
    await editor.draw({ contours: [splitCubic(...ORIGINAL, 0.4)] });
    const before = await editor.outline();
    editor.selectTool("pen");

    await editor.clickAt({ x: 600, y: 600 }, ALT);

    expect((await editor.outline()).slice(0, 1)).toEqual(before);
  });
});

describe("removing a point while several sources are edited", () => {
  const editor = useTestEditor();

  it("removes the matching point in every edited source, so the glyph stays compatible", async () => {
    const names = await editor.draw({ contours: [splitCubic(...ORIGINAL, 0.4)] });
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });
    await editor.editSources(["Regular", "Bold"]);
    const types = async (source: string) =>
      (await editor.layerAt(source)).contours[0]!.points.map((p) => p.pointType);
    const before = await types("Bold");
    const p1 = (await editor.point(names.p1))!;
    editor.selectTool("pen");

    await editor.clickAt(p1, ALT);
    await editor.settle();

    expect(await types("Regular")).toEqual(["onCurve", "offCurve", "offCurve", "onCurve"]);
    expect(await types("Bold")).toEqual(await types("Regular"));

    await editor.undo();
    await editor.settle();
    expect(await types("Bold")).toEqual(before);
    expect(await types("Regular")).toEqual(before);
  });
});
